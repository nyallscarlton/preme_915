import { NextRequest, NextResponse } from "next/server"
import { createZentrxClient } from "@/lib/supabase/admin"
import Retell from "retell-sdk"

// GET /api/pipeline/leads/[id] — Full lead detail with timeline
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createZentrxClient()

  // Get lead with relationships
  const { data: lead, error } = await supabase
    .from("zx_leads")
    .select("*, zx_verticals(slug, name), zx_buyers(name)")
    .eq("id", params.id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  // Get events, notes, tasks, enrollments, interactions, and Retell calls in parallel
  const phoneDigits = lead.phone ? lead.phone.replace(/\D/g, "").slice(-10) : ""
  const e164Phone = phoneDigits ? (phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`) : ""

  const [eventsRes, notesRes, tasksRes, enrollmentsRes, interactionsRes, retellCalls, applicationRes] = await Promise.all([
    supabase
      .from("zx_lead_events")
      .select("*")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("zx_lead_notes")
      .select("*")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("zx_tasks")
      .select("*")
      .eq("lead_id", params.id)
      .order("due_at", { ascending: true }),
    supabase
      .from("zx_sequence_enrollments")
      .select("*, zx_sequences(slug, name, zx_sequence_steps(step_number, channel, delay_minutes, active, zx_message_templates(slug, name, body)))")
      .eq("lead_id", params.id),
    // Get SMS/call interactions by phone
    phoneDigits
      ? supabase
          .from("zx_contact_interactions")
          .select("*")
          .like("phone", `%${phoneDigits}`)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    // Fetch actual call data from Retell API (includes recordings)
    fetchRetellCalls(e164Phone),
    // Fetch loan application by lead_id or phone match
    (async () => {
      // Try by lead_id first
      const { data: byLeadId } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("lead_id", params.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (byLeadId) return byLeadId
      // Fallback: match by last 10 digits of phone
      if (phoneDigits) {
        const { data: byPhone } = await supabase
          .from("loan_applications")
          .select("*")
          .like("applicant_phone", `%${phoneDigits}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        return byPhone || null
      }
      return null
    })(),
  ])

  // Fetch email events if we found an application
  const application = applicationRes || null
  let emailEvents: Record<string, unknown>[] = []
  if (application) {
    const orFilters: string[] = []
    if (application.applicant_email) orFilters.push(`recipient_email.eq.${application.applicant_email}`)
    if (application.application_number) orFilters.push(`application_number.eq.${application.application_number}`)
    if (orFilters.length > 0) {
      const { data: events } = await supabase
        .from("email_events")
        .select("*")
        .or(orFilters.join(","))
        .order("event_timestamp", { ascending: true })
        .limit(100)
      emailEvents = events || []
    }
  }

  // Merge Retell calls into interactions so recordings always show up
  const interactions = interactionsRes.data || []
  const existingCallIds = new Set(
    interactions
      .filter((i: Record<string, unknown>) => i.channel === "voice")
      .map((i: Record<string, unknown>) => ((i.metadata || {}) as Record<string, unknown>).call_id)
      .filter(Boolean)
  )

  for (const call of retellCalls) {
    if (!existingCallIds.has(call.call_id)) {
      // Add Retell call as a synthetic interaction
      interactions.push({
        id: `retell-${call.call_id}`,
        phone: e164Phone,
        channel: "voice",
        direction: call.direction || "outbound",
        content: call.transcript || null,
        summary: call.call_analysis?.call_summary || null,
        metadata: {
          call_id: call.call_id,
          recording_url: call.recording_url || null,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
          duration_ms: call.end_timestamp && call.start_timestamp
            ? call.end_timestamp - call.start_timestamp
            : 0,
          disconnection_reason: call.disconnection_reason || null,
          temperature: call.call_analysis?.custom_analysis_data?.lead_temperature?.toLowerCase() || null,
          score: call.call_analysis?.custom_analysis_data?.score || null,
        },
        created_at: call.start_timestamp
          ? new Date(call.start_timestamp).toISOString()
          : new Date().toISOString(),
      })
    } else {
      // Update existing interaction with recording URL if missing
      const existing = interactions.find(
        (i: Record<string, unknown>) =>
          i.channel === "voice" &&
          ((i.metadata || {}) as Record<string, unknown>).call_id === call.call_id
      )
      if (existing && call.recording_url) {
        const meta = (existing.metadata || {}) as Record<string, unknown>
        if (!meta.recording_url) {
          meta.recording_url = call.recording_url
          existing.metadata = meta
        }
      }
    }
  }

  return NextResponse.json({
    lead,
    events: eventsRes.data || [],
    notes: notesRes.data || [],
    tasks: tasksRes.data || [],
    enrollments: enrollmentsRes.data || [],
    interactions,
    application,
    emailEvents,
  })
}

/** Fetch calls from Retell API for a given phone number */
async function fetchRetellCalls(phone: string): Promise<any[]> {
  if (!phone || !process.env.RETELL_API_KEY) return []

  try {
    const retell = new Retell({ apiKey: process.env.RETELL_API_KEY })

    // Fetch calls where this number was the to_number (outbound to lead)
    const outbound = await retell.call.list({
      filter_criteria: { to_number: [phone] },
      sort_order: "descending",
      limit: 20,
    })

    // Also fetch calls where this number was the from_number (inbound from lead)
    const inbound = await retell.call.list({
      filter_criteria: { from_number: [phone] },
      sort_order: "descending",
      limit: 20,
    })

    // Deduplicate by call_id
    const allCalls = [...(outbound || []), ...(inbound || [])]
    const seen = new Set<string>()
    return allCalls.filter((c: any) => {
      if (seen.has(c.call_id)) return false
      seen.add(c.call_id)
      return true
    })
  } catch (err) {
    console.error("[retell-fetch] Failed to fetch calls:", err)
    return []
  }
}

// PATCH /api/pipeline/leads/[id] — Update lead status, notes, etc.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createZentrxClient()
  const body = await request.json()

  const allowedFields = ["status", "temperature", "score", "first_name", "last_name", "email", "phone"]
  const updates: Record<string, unknown> = {}

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("zx_leads")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log status change + auto-enroll in appropriate sequence
  if (body.status) {
    await supabase.from("zx_lead_events").insert({
      lead_id: params.id,
      event_type: "status_changed",
      event_data: { new_status: body.status, source: "admin" },
    })

    // Trigger auto-enrollment based on new status
    const { autoEnrollByStatus } = await import("@/lib/sequences")
    const enrolled = await autoEnrollByStatus(params.id, body.status)
    if (enrolled) {
      await supabase.from("zx_lead_events").insert({
        lead_id: params.id,
        event_type: "auto_enrolled",
        event_data: { sequence: enrolled, trigger: `status_changed_to_${body.status}` },
      })
    }
  }

  return NextResponse.json({ lead: data })
}

// POST /api/pipeline/leads/[id] — Add note
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createZentrxClient()
  const body = await request.json()

  if (body.action === "add_note") {
    const { data, error } = await supabase
      .from("zx_lead_notes")
      .insert({
        lead_id: params.id,
        content: body.content,
        author: body.author || "admin",
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ note: data })
  }

  if (body.action === "add_task") {
    const { data, error } = await supabase
      .from("zx_tasks")
      .insert({
        lead_id: params.id,
        type: body.type || "call",
        title: body.title,
        description: body.description,
        due_at: body.due_at,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data })
  }

  if (body.action === "send_sms") {
    if (!body.message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }
    // Get lead phone
    const { data: lead } = await supabase
      .from("zx_leads")
      .select("phone")
      .eq("id", params.id)
      .single()
    if (!lead?.phone) {
      return NextResponse.json({ error: "Lead has no phone number" }, { status: 400 })
    }
    const phone = lead.phone.replace(/\D/g, "")
    const e164 = phone.startsWith("1") ? `+${phone}` : `+1${phone}`

    const { sendSms } = await import("@/lib/twilio")
    const { storeInteraction } = await import("@/lib/memory")
    const sid = await sendSms(e164, body.message.trim())

    // Log the interaction
    await storeInteraction(e164, {
      channel: "sms",
      direction: "outbound",
      content: body.message.trim(),
      metadata: { twilio_sid: sid, source: "admin" },
    })

    // Log event on lead
    await supabase.from("zx_lead_events").insert({
      lead_id: params.id,
      event_type: "admin_sms_sent",
      event_data: { message: body.message.trim() },
    })

    return NextResponse.json({ success: true, sid })
  }

  if (body.action === "disqualify") {
    const { pauseSequence, cancelSequences, enrollLead } = await import("@/lib/sequences")
    const reason = body.reason || "not_qualified"

    // Cancel all aggressive sequences
    await cancelSequences(params.id)

    // Update lead status + log reason
    await supabase.from("zx_leads").update({
      status: "not_qualified",
      temperature: "cold",
    }).eq("id", params.id)

    // Store the disqualification reason in custom_fields
    const { data: currentLead } = await supabase.from("zx_leads").select("custom_fields").eq("id", params.id).single()
    const cf = (currentLead?.custom_fields as Record<string, unknown>) || {}
    await supabase.from("zx_leads").update({
      custom_fields: { ...cf, dq_reason: reason, dq_date: new Date().toISOString(), dq_notes: body.notes || "" },
    }).eq("id", params.id)

    await supabase.from("zx_lead_events").insert({
      lead_id: params.id,
      event_type: "disqualified",
      event_data: { reason, notes: body.notes || "", source: "admin" },
    })

    // Auto-add a note
    await supabase.from("zx_lead_notes").insert({
      lead_id: params.id,
      content: `Lead disqualified: ${reason}${body.notes ? ` — ${body.notes}` : ""}`,
      author: "admin",
    })

    // Enroll in reason-specific DQ nurture sequence
    const DQ_SEQUENCE_MAP: Record<string, string> = {
      bad_credit: "dq-bad-credit-90day",
      not_ready: "dq-not-ready-30day",
      no_budget: "dq-no-budget-180day",
      wrong_market: "dq-wrong-market",
      no_interest: "dq-not-interested-30day",
      other: "dq-other-60day",
    }
    const sequenceSlug = DQ_SEQUENCE_MAP[reason]
    if (sequenceSlug) {
      try {
        await enrollLead(params.id, sequenceSlug)
      } catch (enrollErr) {
        console.error("[disqualify] Nurture enrollment failed:", enrollErr)
      }
    }

    return NextResponse.json({ success: true })
  }

  if (body.action === "cancel_sequences") {
    const { cancelSequences } = await import("@/lib/sequences")
    await cancelSequences(params.id)
    // Log it
    await supabase.from("zx_lead_events").insert({
      lead_id: params.id,
      event_type: "sequences_cancelled",
      event_data: { reason: body.reason || "manual", source: "admin" },
    })
    return NextResponse.json({ success: true })
  }

  if (body.action === "pause_sequence") {
    const { pauseSequence } = await import("@/lib/sequences")
    await pauseSequence(params.id, body.reason || "manual_pause")
    return NextResponse.json({ success: true })
  }

  if (body.action === "resume_sequence") {
    const { enrollLead } = await import("@/lib/sequences")
    await enrollLead(params.id, body.sequence_slug || "7day-dscr-followup")
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
