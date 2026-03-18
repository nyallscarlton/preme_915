/**
 * Preme Home Loans — Retell Webhook Handler
 *
 * Receives call events from Retell AI voice agent:
 * - call_started: Log call initiation
 * - call_ended: Store transcript & recording
 * - call_analyzed: Extract qualification data, create lead, notify LO
 */

import { NextRequest, NextResponse } from "next/server"

// Allow up to 120s — recording downloads from Retell can be slow
export const maxDuration = 120

const MC_URL = process.env.MC_WEBHOOK_URL || "http://localhost:3000"
const MC_AUTH = "Basic YWRtaW46Mll1bmdueWFsbHMh"
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

const NO_ANSWER_REASONS = [
  "dial_busy",
  "dial_failed",
  "dial_no_answer",
  "invalid_destination",
  "voicemail_reached",
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, call } = body

    const leadId = call?.metadata?.lead_id || null
    const callerPhone = call?.from_number || call?.to_number || ""

    switch (event) {
      case "call_started": {
        logToMC("call_started", {
          call_id: call.call_id,
          lead_id: leadId,
          phone: callerPhone,
          direction: call.direction || "outbound",
          timestamp: new Date().toISOString(),
        })
        break
      }

      case "call_ended": {
        const transcript = call.transcript || null
        const recordingUrl = call.recording_url || null
        const callSummary = call.call_analysis?.call_summary || null
        const noAnswer = NO_ANSWER_REASONS.includes(call.disconnection_reason)

        logToMC("call_ended", {
          call_id: call.call_id,
          lead_id: leadId,
          duration_ms: call.duration_ms,
          disconnection_reason: call.disconnection_reason,
          no_answer: noAnswer,
          has_transcript: !!transcript,
          has_recording: !!recordingUrl,
        })

        // Persist recording to Supabase Storage (fire-and-forget)
        if (recordingUrl) {
          persistRecording(call.call_id, recordingUrl).catch((err) =>
            console.error("[retell-preme] Recording persistence failed (call_ended):", err)
          )
        }
        break
      }

      case "call_analyzed": {
        const analysis = call.call_analysis?.custom_analysis_data || {}

        // Extract mortgage-specific post-call analysis fields
        const leadTemperature: string | null = analysis.lead_temperature || null
        const creditScoreRange: string | null = analysis.credit_score_range || null
        const propertyType: string | null = analysis.property_type || null
        const propertyAddress: string | null = analysis.property_address || null
        const loanType: string | null = analysis.loan_type_confirmed || null
        const loanAmount: string | null = analysis.estimated_loan_amount || null
        const propertyValue: string | null = analysis.estimated_value || null
        const timeline: string | null = analysis.timeline || null
        const hasEntity: boolean = analysis.has_entity === true || analysis.has_entity === "true"
        const experienceLevel: string | null = analysis.experience_level || null
        const wantsCallback = analysis.wants_callback === true || analysis.wants_callback === "true"
        const objections: string | null = analysis.objections || null
        const score: number | null = analysis.score ? parseInt(analysis.score) : null
        const isPreApproved = analysis.is_pre_approved === true
        const existingApplication = analysis.existing_application || null
        const callerIntent: string | null = analysis.caller_intent || null

        const isQualified =
          leadTemperature === "Hot" || (leadTemperature === "Warm" && wantsCallback)

        // Caller name
        const callerName = [
          call.metadata?.first_name || analysis.first_name || "",
          call.metadata?.last_name || analysis.last_name || "",
        ].filter(Boolean).join(" ") || "Unknown Caller"

        // --- Create/update lead in Preme DB ---
        if (isQualified) {
          try {
            const { createClient } = await import("@supabase/supabase-js")
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY
            if (url && key) {
              const supabase = createClient(url, key)

              // Check if we already have an application from this phone
              const digits = callerPhone.replace(/\D/g, "").slice(-10)
              const { data: existingApp } = await supabase
                .from("loan_applications")
                .select("id, status, application_number")
                .or(`applicant_phone.ilike.%${digits}%`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()

              if (!existingApp) {
                // Create a new draft application from call data
                const nameParts = callerName.split(" ")
                const appNumber = `PREME-CALL-${Date.now().toString(36).toUpperCase()}`

                await supabase.from("loan_applications").insert({
                  applicant_name: callerName,
                  applicant_phone: callerPhone,
                  applicant_email: analysis.email || `${callerPhone.replace(/\D/g, "").slice(-10)}@placeholder.preme`,
                  application_number: appNumber,
                  status: "submitted",
                  loan_type: propertyType || loanType || null,
                  loan_amount: loanAmount ? parseFloat(loanAmount.replace(/[^0-9.]/g, "")) : null,
                  property_address: propertyAddress || null,
                  property_value: propertyValue ? parseFloat(propertyValue.replace(/[^0-9.]/g, "")) : null,
                  credit_score_range: creditScoreRange || null,
                  submitted_at: new Date().toISOString(),
                })
              }
            }
          } catch (err) {
            console.error("[retell-preme] DB error (non-fatal):", err)
          }
        }

        // --- MC Pipeline sync ---
        if (isQualified) {
          logToMC("lead_qualified", {
            name: callerName,
            phone: callerPhone,
            property_address: propertyAddress || "",
            loan_type: loanType || "",
            source: "retell_voice",
            status: "warm",
            entity: "preme",
          })
        }

        // --- Telegram notification for qualified leads ---
        if (isQualified) {
          sendTelegramAlert({
            callerName,
            callerPhone,
            temperature: leadTemperature,
            score,
            loanType,
            propertyType,
            propertyAddress,
            loanAmount,
            propertyValue,
            creditScoreRange,
            timeline,
            hasEntity,
            experienceLevel,
            wantsCallback,
            objections,
            callerIntent,
            recordingUrl: call.recording_url || null,
            callSummary: call.call_analysis?.call_summary || null,
          })
        }

        // --- Memory system: store interaction ---
        try {
          if (callerPhone) {
            const { createClient } = await import("@supabase/supabase-js")
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY
            if (url && key) {
              const supabase = createClient(url, key)
              // Store in shared contact interactions table if it exists
              await supabase.from("zx_contact_interactions").insert({
                phone: callerPhone,
                channel: "voice",
                direction: call.direction || "inbound",
                entity: "preme",
                content: call.transcript || null,
                summary: call.call_analysis?.call_summary || null,
                metadata: {
                  call_id: call.call_id,
                  duration_ms: call.duration_ms,
                  temperature: leadTemperature?.toLowerCase(),
                  score,
                  loan_type: loanType,
                  recording_url: call.recording_url,
                },
              }) // Silently fail if table doesn't exist
            }
          }
        } catch {
          // Non-fatal
        }

        // Log to MC
        logToMC("call_analyzed", {
          call_id: call.call_id,
          lead_id: leadId,
          caller_name: callerName,
          temperature: leadTemperature,
          score,
          qualified: isQualified,
          loan_type: loanType,
          property_address: propertyAddress,
          caller_intent: callerIntent,
        })

        // Persist recording to Supabase Storage (fire-and-forget)
        if (call.recording_url) {
          persistRecording(call.call_id, call.recording_url).catch((err) =>
            console.error("[retell-preme] Recording persistence failed (call_analyzed):", err)
          )
        }

        // --- Auto Sales Coach: review every call ---
        await triggerCallReview({
          callId: call.call_id,
          agentId: call.agent_id || "",
          direction: call.direction || "inbound",
          callerPhone,
          callerName,
          durationSeconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : 0,
          recordingUrl: call.recording_url || null,
          transcript: call.transcript || "",
          disconnectReason: call.disconnection_reason || "",
          leadTemperature,
          leadScore: score,
          loanType,
          callerIntent,
          callSummary: call.call_analysis?.call_summary || null,
          callAt: new Date().toISOString(),
          analysis: analysis,
        })

        break
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[retell-preme] Webhook error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/** Fire-and-forget log to Mission Control */
function logToMC(eventType: string, data: Record<string, unknown>) {
  fetch(`${MC_URL}/api/pipeline/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: MC_AUTH,
    },
    body: JSON.stringify({
      entity: "preme",
      event_type: eventType,
      ...data,
    }),
  }).catch(() => {})
}

/** Send Telegram alert for qualified leads */
function sendTelegramAlert(data: {
  callerName: string
  callerPhone: string
  temperature: string | null
  score: number | null
  loanType: string | null
  propertyType: string | null
  propertyAddress: string | null
  loanAmount: string | null
  propertyValue: string | null
  creditScoreRange: string | null
  timeline: string | null
  hasEntity: boolean
  experienceLevel: string | null
  wantsCallback: boolean
  objections: string | null
  callerIntent: string | null
  recordingUrl: string | null
  callSummary: string | null
}) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return

  const lines = [
    `🏦 *PREME — New Qualified Lead*`,
    ``,
    `*${data.callerName}*`,
    `📞 ${data.callerPhone}`,
    `🌡️ ${data.temperature || "Unknown"} ${data.score ? `(Score: ${data.score}/100)` : ""}`,
    ``,
    `*Loan Details:*`,
    data.loanType ? `• Type: ${data.loanType}` : null,
    data.propertyType ? `• Property: ${data.propertyType}` : null,
    data.loanAmount ? `• Amount: ${data.loanAmount}` : null,
    data.propertyValue ? `• Value: ${data.propertyValue}` : null,
    data.creditScoreRange ? `• Credit: ${data.creditScoreRange}` : null,
    data.timeline ? `• Timeline: ${data.timeline}` : null,
    data.hasEntity ? `• Entity: Yes` : null,
    data.experienceLevel ? `• Experience: ${data.experienceLevel}` : null,
    ``,
    data.callerIntent ? `*Intent:* ${data.callerIntent}` : null,
    data.objections ? `*Objections:* ${data.objections}` : null,
    data.wantsCallback ? `✅ *Wants callback*` : null,
    ``,
    data.callSummary ? `*Summary:* ${data.callSummary}` : null,
    data.recordingUrl ? `[🎧 Listen to recording](${data.recordingUrl})` : null,
    ``,
    `_Reply to assign to LO_`,
  ].filter(Boolean).join("\n")

  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: lines,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  }).catch((err) => console.error("[retell-preme] Telegram error:", err))
}

/**
 * Download a Retell recording and persist it to Supabase Storage.
 * Stores at path: call-recordings/{YYYY-MM}/{callId}.wav
 * Updates the zx_contact_interactions metadata with the permanent storage URL.
 */
async function persistRecording(callId: string, recordingUrl: string) {
  const { createClient } = await import("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn("[retell-preme] Missing Supabase credentials, skipping recording persistence")
    return
  }

  const supabase = createClient(url, key)

  // 1. Fetch the recording audio from Retell
  const res = await fetch(recordingUrl)
  if (!res.ok) {
    console.error(`[retell-preme] Failed to fetch recording: ${res.status} ${res.statusText}`)
    return
  }
  const audioBuffer = Buffer.from(await res.arrayBuffer())

  // 2. Upload to Supabase Storage bucket "call-recordings"
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const storagePath = `${yearMonth}/${callId}.wav`

  const { error: uploadError } = await supabase.storage
    .from("call-recordings")
    .upload(storagePath, audioBuffer, {
      contentType: "audio/wav",
      upsert: true,
    })

  if (uploadError) {
    console.error("[retell-preme] Storage upload failed:", uploadError.message)
    return
  }

  // 3. Get the permanent URL
  const { data: urlData } = supabase.storage
    .from("call-recordings")
    .getPublicUrl(storagePath)
  const permanentUrl = urlData?.publicUrl || null

  // 4. Update zx_contact_interactions metadata with the storage URL
  try {
    const { data: rows } = await supabase
      .from("zx_contact_interactions")
      .select("id, metadata")
      .filter("metadata->>call_id", "eq", callId)
      .eq("channel", "voice")
      .order("created_at", { ascending: false })
      .limit(1)

    if (rows && rows.length > 0) {
      const meta = (rows[0].metadata as Record<string, unknown>) || {}
      await supabase
        .from("zx_contact_interactions")
        .update({
          metadata: {
            ...meta,
            recording_storage_url: permanentUrl,
            recording_storage_path: storagePath,
          },
        })
        .eq("id", rows[0].id)
    }
  } catch (err) {
    // Non-fatal — recording is already saved in storage
    console.error("[retell-preme] Failed to update interaction metadata:", err)
  }

  console.log(`[retell-preme] Recording persisted: ${storagePath}`)
}

/** Auto sales coach review — awaited so Vercel doesn't kill it */
async function triggerCallReview(params: {
  callId: string
  agentId: string
  direction: string
  callerPhone: string
  callerName: string
  durationSeconds: number
  recordingUrl: string | null
  transcript: string
  disconnectReason: string
  leadTemperature: string | null
  leadScore: number | null
  loanType: string | null
  callerIntent: string | null
  callSummary: string | null
  callAt: string
  analysis: Record<string, unknown>
}) {
  // Skip review for very short calls (no-answer, voicemail, etc.)
  if (params.durationSeconds < 30 || !params.transcript) return

  try {
    const { reviewCall, storeReview, applyPromptPatch } = await import("@/lib/call-reviewer")

    const review = await reviewCall({
      transcript: params.transcript,
      direction: params.direction,
      duration_seconds: params.durationSeconds,
      disconnect_reason: params.disconnectReason,
      analysis: params.analysis,
    })

    if (!review) {
      console.error("[call-reviewer] No review generated for", params.callId)
      return
    }

    // Store in Supabase
    await storeReview({
      callId: params.callId,
      agentId: params.agentId,
      direction: params.direction,
      callerPhone: params.callerPhone,
      callerName: params.callerName,
      durationSeconds: params.durationSeconds,
      recordingUrl: params.recordingUrl,
      transcript: params.transcript,
      disconnectReason: params.disconnectReason,
      leadTemperature: params.leadTemperature,
      leadScore: params.leadScore,
      loanType: params.loanType,
      callerIntent: params.callerIntent,
      callSummary: params.callSummary,
      callAt: params.callAt,
      review,
    })

    // Auto-patch prompt for critical/high issues
    await applyPromptPatch(review, params.callId)

    console.log(`[call-reviewer] Review complete: ${params.callId} — ${review.total}/110 (${review.severity})`)
  } catch (err) {
    console.error("[call-reviewer] Review failed:", err)
  }
}
