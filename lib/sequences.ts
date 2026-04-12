import { createZentrxClient } from "@/lib/supabase/admin"
import { sendSms } from "@/lib/twilio"
import { triggerDoubleDialCall } from "@/lib/retell-sms"
import { storeInteraction } from "@/lib/memory"
// Telegram notifications removed — all sequence steps are automated (Riley handles calls + SMS)
import type { SequenceEnrollment, SequenceStep } from "@/lib/types"

const BRAND_PHONE = "(470) 942-5787"

// ─── Enroll a lead into a sequence ───
export async function enrollLead(leadId: string, sequenceSlug: string): Promise<string | null> {
  const supabase = createZentrxClient()

  // Find the sequence
  const { data: seq } = await supabase
    .from("sequences")
    .select("id")
    .eq("slug", sequenceSlug)
    .eq("active", true)
    .single()

  if (!seq) {
    console.error(`[sequences] Sequence not found: ${sequenceSlug}`)
    return null
  }

  // Check if already enrolled
  const { data: existing } = await supabase
    .from("sequence_enrollments")
    .select("id, status")
    .eq("lead_id", leadId)
    .eq("sequence_id", seq.id)
    .single()

  if (existing) {
    if (existing.status === "active") return existing.id
    // Re-activate if paused/cancelled
    await supabase
      .from("sequence_enrollments")
      .update({ status: "active", paused_at: null, current_step: 0 })
      .eq("id", existing.id)
    return existing.id
  }

  // Create enrollment
  const { data: enrollment, error } = await supabase
    .from("sequence_enrollments")
    .insert({
      lead_id: leadId,
      sequence_id: seq.id,
      status: "active",
      current_step: 0,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[sequences] Enrollment error:", error)
    return null
  }

  // Update lead status to contacting
  await supabase
    .from("leads")
    .update({ status: "contacting" })
    .eq("id", leadId)
    .in("status", ["new"])

  return enrollment.id
}

// ─── Pause a sequence (lead replied, qualified, etc.) ───
export async function pauseSequence(leadId: string, reason: string): Promise<void> {
  const supabase = createZentrxClient()
  await supabase
    .from("sequence_enrollments")
    .update({
      status: "paused",
      paused_at: new Date().toISOString(),
      pause_reason: reason,
    })
    .eq("lead_id", leadId)
    .eq("status", "active")
}

// ─── Pause sequences by phone number (for SMS replies) ───
export async function pauseSequenceByPhone(phone: string, reason: string): Promise<void> {
  const supabase = createZentrxClient()
  const normalized = phone.replace(/\D/g, "")

  // Find leads with this phone number
  const { data: leads } = await supabase
    .from("leads")
    .select("id")
    .or(`phone.like.%${normalized.slice(-10)}`)
    .limit(5)

  if (!leads || leads.length === 0) return

  for (const lead of leads) {
    await pauseSequence(lead.id, reason)
  }
}

// ─── Auto-enroll lead based on status change ───
// These are the triggers that move leads into the right follow-up flow
export async function autoEnrollByStatus(leadId: string, newStatus: string): Promise<string | null> {
  const supabase = createZentrxClient()

  // Check if lead has a draft application (for Segment C)
  const { data: app } = await supabase
    .from("loan_applications")
    .select("id, status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const TRIGGERS: Record<string, string> = {
    // Status → Sequence slug
    "not_qualified": "", // handled by DQ button with specific reason
    "application": "nurture-started-app", // app was sent, hasn't submitted
  }

  // If 7-day sequence completed or cancelled and lead is still contacted/new
  if (newStatus === "contacted" || newStatus === "calling") {
    // Check if 7-day sequence is done
    const { data: enrollment } = await supabase
      .from("sequence_enrollments")
      .select("status, sequences(slug)")
      .eq("lead_id", leadId)
      .single()

    const seqSlug = (enrollment?.sequences as any)?.slug
    const seqStatus = enrollment?.status

    if (seqSlug === "7day-dscr-followup" && (seqStatus === "completed" || seqStatus === "cancelled")) {
      // 7-day is done — figure out which nurture segment
      if (app && app.status === "sent") {
        // Started app but didn't finish
        await enrollLead(leadId, "nurture-started-app")
        await enrollLead(leadId, "weekly-newsletter")
        return "nurture-started-app"
      } else {
        // Talked but not ready
        await enrollLead(leadId, "nurture-talked-not-ready")
        await enrollLead(leadId, "weekly-newsletter")
        return "nurture-talked-not-ready"
      }
    }
  }

  // Application status — enroll in app follow-up
  if (newStatus === "application") {
    await enrollLead(leadId, "nurture-started-app")
    return "nurture-started-app"
  }

  return null
}

// ─── Cancel all sequences for a lead ───
export async function cancelSequences(leadId: string): Promise<void> {
  const supabase = createZentrxClient()
  await supabase
    .from("sequence_enrollments")
    .update({ status: "cancelled" })
    .eq("lead_id", leadId)
    .in("status", ["active", "paused"])
}

// ─── Check if phone is opted out ───
async function isOptedOut(phone: string): Promise<boolean> {
  const supabase = createZentrxClient()
  const normalized = phone.replace(/\D/g, "")
  const e164 = normalized.startsWith("1") ? `+${normalized}` : `+1${normalized}`

  const { data } = await supabase
    .from("opt_outs")
    .select("id")
    .or(`phone.eq.${e164},phone.eq.${normalized}`)
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ─── Check quiet hours (8 AM - 9 PM ET) ───
function isQuietHours(sendAfterHour: number, sendBeforeHour: number): boolean {
  // Get current hour in Eastern time
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const hour = et.getHours()
  return hour < sendAfterHour || hour >= sendBeforeHour
}

// ─── Callable-window check for SCHEDULED FOLLOW-UP CALLS only ───
//
// Sequence-step re-dial calls (steps 3, 5, 7, 10 — auto_call channel) are
// gated to specific ET hours that historically produce the best connect rate
// based on Retell call analytics:
//
//   ALLOWED hours (ET):  10, 11           (10am–12pm "morning settle-in")
//                        16, 17, 18, 19, 20  (4pm–9pm "after-work catch-up")
//
//   BLOCKED hours (ET):  before 10am  (commute / morning meetings)
//                        11am–12pm wait — actually 11 IS allowed; blocked: 12pm–4pm (lunch + meetings)
//                        9pm–10am next day (too late / too early)
//
// Per the 7-day Retell data: 9am ET had 34 calls / 0 connects (worst hour),
// while 5pm ET had a 50% connect rate. This gate only applies to scheduled
// follow-up calls — the immediate first-contact call (triggerOutboundCall in
// preme-portal/lib/lead-followup.ts) is NOT affected. Speed-to-lead is absolute.
//
// When blocked, the step is left pending. The sequence cron runs every 5 min
// and will pick the lead back up as soon as the window opens, no scheduled_at
// rewrite required.
const ALLOWED_CALL_HOURS = new Set([10, 11, 16, 17, 18, 19, 20])
function isInCallableWindow(): boolean {
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  return ALLOWED_CALL_HOURS.has(et.getHours())
}

// ─── Render template with lead data ───
function renderTemplate(body: string, lead: Record<string, unknown>): string {
  const cf = (lead.custom_fields as Record<string, unknown>) || {}

  // Mortgage-specific
  const loanType = (cf.loan_type as string) || "investment property loan"
  const loanTypeLabel = loanType
    .replace("dscr", "DSCR loan")
    .replace("fix-flip", "fix & flip loan")
    .replace("bridge", "bridge loan")
    .replace("commercial", "commercial loan")
    .replace("business-credit", "business credit line")

  // Water-damage-specific
  const damageType = ((cf.damage_type as string) || "water damage").replace(/_/g, " ")
  const address = (cf.address as string) || ""
  const city = (cf.city as string) || (cf.market as string) || ""

  // App link for Segment C (started app, didn't finish)
  const appToken = (cf.app_guest_token as string) || ""
  const appLink = appToken
    ? `https://premerealestate.com/apply?guest=1&token=${appToken}`
    : "https://premerealestate.com/apply"

  return body
    .replace(/\{\{first_name\}\}/g, (lead.first_name as string) || "there")
    .replace(/\{\{last_name\}\}/g, (lead.last_name as string) || "")
    .replace(/\{\{loan_type\}\}/g, loanTypeLabel)
    .replace(/\{\{brand_phone\}\}/g, BRAND_PHONE)
    .replace(/\{\{damage_type\}\}/g, damageType)
    .replace(/\{\{address\}\}/g, address)
    .replace(/\{\{city\}\}/g, city)
    .replace(/\{\{zip_code\}\}/g, (cf.zip_code as string) || "")
    .replace(/\{\{market\}\}/g, city)
    .replace(/\{\{app_link\}\}/g, appLink)
}

// ─── Sequence Definitions (for DB seeding reference) ───
// Slug: "3day-water-damage-followup"
// Name: "3-Day Water Damage Emergency Follow-Up"
// Steps:
//   1. auto_sms    @ 0 min     — instant confirmation
//   2. auto_call   @ 2 min     — Retell qualification call
//   3. auto_sms    @ 15 min    — missed call recovery
//   4. manual_call @ 120 min   — first human attempt
//   5. auto_sms    @ 360 min   — urgency reminder
//   6. manual_call @ 1440 min  — day 2 attempt
//   7. auto_sms    @ 2880 min  — final follow-up
//   8. manual_call @ 4320 min  — final attempt
//
// Message Templates:
//   wd-instant-confirm:
//     "{{first_name}}, we received your water damage request for {{address}}. A restoration specialist will call you within minutes. Water damage gets worse every hour — we're on it. Reply STOP to opt out."
//   wd-missed-call:
//     "{{first_name}}, we just tried reaching you about the {{damage_type}} at your property. Every hour of delay increases damage & cost. Call us back at {{brand_phone}} or reply YES for a callback."
//   wd-urgency-reminder:
//     "{{first_name}}, following up on your {{damage_type}} report. Standing water causes mold within 24-48hrs. Our {{city}} team is ready to help — call {{brand_phone}} or reply CALL. Reply STOP to opt out."
//   wd-final-followup:
//     "{{first_name}}, last check-in about the water damage at {{address}}. If you've handled it, great! If not, we still have {{city}} crews available. Call {{brand_phone}} anytime. Reply STOP to opt out."

// ─── Process pending double-dial calls ───
export async function processPendingDials(): Promise<{ dialed: number; dialErrors: number }> {
  const supabase = createZentrxClient()
  let dialed = 0
  let dialErrors = 0

  const { data: pendingDials } = await supabase
    .from("zx_pending_dials")
    .select("*")
    .eq("fired", false)
    .lte("scheduled_for", new Date().toISOString())
    .limit(20)

  if (!pendingDials || pendingDials.length === 0) return { dialed: 0, dialErrors: 0 }

  for (const dial of pendingDials) {
    try {
      // GUARD: Check daily call cap before firing double-dial
      if (dial.lead_id) {
        const todayStart = new Date()
        todayStart.setUTCHours(0, 0, 0, 0)
        const { count: todayCallCount } = await supabase
          .from("lead_events")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", dial.lead_id)
          .in("event_type", ["sequence_call_triggered", "double_dial_triggered", "retell_call_initiated"])
          .gte("created_at", todayStart.toISOString())

        if ((todayCallCount ?? 0) >= 6) {
          console.warn(`[pending-dials] Lead ${dial.lead_id} hit daily call cap (${todayCallCount}), skipping double-dial`)
          await supabase.from("zx_pending_dials").update({ fired: true }).eq("id", dial.id)
          continue
        }
      }

      const callId = await triggerDoubleDialCall(dial.to_number, dial.agent_id, {
        ...(dial.metadata as Record<string, string>),
        double_dial: "second_attempt",
      })

      await supabase.from("zx_pending_dials").update({ fired: true }).eq("id", dial.id)

      if (dial.lead_id) {
        await supabase.from("lead_events").insert({
          lead_id: dial.lead_id,
          event_type: "double_dial_triggered",
          event_data: { second_call_id: callId, original_call_id: dial.metadata?.original_call_id },
        })
      }

      dialed++
    } catch (err) {
      console.error(`[pending-dials] Failed for ${dial.to_number}:`, err)
      // Mark as fired anyway to prevent infinite retries on bad numbers
      await supabase.from("zx_pending_dials").update({ fired: true }).eq("id", dial.id)
      dialErrors++
    }
  }

  return { dialed, dialErrors }
}

// ─── Process all due sequence steps ───
export async function processDueSteps(): Promise<{ processed: number; errors: number; dialed?: number; dialErrors?: number }> {
  const supabase = createZentrxClient()
  let processed = 0
  let errors = 0

  // Get all active enrollments with their sequence steps
  const { data: enrollments, error: fetchErr } = await supabase
    .from("sequence_enrollments")
    .select(`
      id, lead_id, sequence_id, current_step, enrolled_at,
      leads!inner (id, first_name, last_name, phone, email, custom_fields, status),
      sequences!inner (id, slug, name)
    `)
    .eq("status", "active")

  if (fetchErr || !enrollments) {
    console.error("[sequences] Fetch error:", fetchErr)
    return { processed: 0, errors: 1 }
  }

  const MAX_CALLS_PER_LEAD_PER_DAY = 6 // absolute cap: 3 sequence calls × 2 (double-dial)

  for (const enrollment of enrollments) {
    try {
      const lead = (enrollment as unknown as { leads: Record<string, unknown> }).leads
      const phone = lead.phone as string

      // Check opt-out
      if (await isOptedOut(phone)) {
        await cancelSequences(lead.id as string)
        continue
      }

      // Only pause for leads that are truly done
      const leadStatus = lead.status as string
      const seqSlug = (enrollment as any).sequences?.slug || ""

      // "application" status should NOT pause Segment C (that's the whole point of Segment C)
      const pauseStatuses = ["contacted", "qualified", "not_qualified", "processing", "closed_won", "closed_lost", "dead", "handed_off", "converted"]
      if (seqSlug !== "nurture-started-app") {
        pauseStatuses.push("application") // Only pause non-Segment-C sequences for "application" status
      }
      if (pauseStatuses.includes(leadStatus)) {
        await pauseSequence(lead.id as string, `lead_status_${leadStatus}`)
        continue
      }

      // SAFETY NET: Check if Riley already had a real conversation with this lead
      // This catches cases where the webhook failed to cancel the sequence
      const { count: connectedCalls } = await supabase
        .from("lead_events")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id as string)
        .eq("event_type", "call_ended")
        .gt("event_data->>duration", "30000")
      if (connectedCalls && connectedCalls > 0) {
        console.log(`[safety-net] Caught orphaned follow-up for lead ${lead.id} (${lead.first_name} ${lead.last_name}) — already contacted. Cancelling.`)
        await cancelSequences(lead.id as string)
        await supabase.from("leads").update({ status: "contacted", updated_at: new Date().toISOString() }).eq("id", lead.id as string).in("status", ["new", "calling", "contacting"])
        continue
      }

      // For Segment C: check if the application was actually submitted — if so, exit the sequence
      if (seqSlug === "nurture-started-app") {
        const phoneDigits = (phone as string).replace(/\D/g, "").slice(-10)
        const { data: app } = await supabase
          .from("loan_applications")
          .select("status")
          .or(`applicant_phone.like.%${phoneDigits},lead_id.eq.${lead.id}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (app?.status === "submitted") {
          await supabase.from("sequence_enrollments")
            .update({ status: "completed", completed_at: new Date().toISOString(), pause_reason: "app_submitted" })
            .eq("id", enrollment.id)
          await supabase.from("lead_events").insert({
            lead_id: lead.id,
            event_type: "sequence_completed",
            event_data: { sequence: seqSlug, reason: "application_submitted" },
          })
          continue
        }
      }

      // GUARD: Max calls per lead per day — counts ALL call attempts including failures
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)
      const { count: todayCallCount } = await supabase
        .from("lead_events")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id as string)
        .in("event_type", ["sequence_call_triggered", "sequence_call_failed", "double_dial_triggered", "retell_call_initiated"])
        .gte("created_at", todayStart.toISOString())

      if ((todayCallCount ?? 0) >= MAX_CALLS_PER_LEAD_PER_DAY) {
        console.warn(`[sequences] Lead ${lead.id} hit daily call cap (${todayCallCount}/${MAX_CALLS_PER_LEAD_PER_DAY}), skipping`)
        continue
      }

      // Get next step
      const { data: nextStep } = await supabase
        .from("sequence_steps")
        .select("*, message_templates(*)")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_number", enrollment.current_step + 1)
        .eq("active", true)
        .single()

      if (!nextStep) {
        // No more steps — mark complete
        await supabase
          .from("sequence_enrollments")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", enrollment.id)

        // Auto-enroll into nurture segment when 7-day DSCR sequence completes
        const seqSlug = (enrollment as any).sequences?.slug
        if (seqSlug === "7day-dscr-followup") {
          const leadId = lead.id as string
          const hasApp = (lead.custom_fields as Record<string, unknown>)?.app_guest_token

          // Check if lead has a loan application
          const { data: app } = await supabase
            .from("loan_applications")
            .select("id, status")
            .eq("lead_id", leadId)
            .maybeSingle()

          let nurtureSlug = "nurture-never-talked" // Segment A default
          if (app && app.status === "sent") {
            nurtureSlug = "nurture-started-app" // Segment C: started but didn't finish
          } else if (leadStatus === "contacted" || leadStatus === "calling") {
            nurtureSlug = "nurture-talked-not-ready" // Segment B: talked but not ready
          }

          // Enroll in nurture + weekly newsletter
          await enrollLead(leadId, nurtureSlug)
          await enrollLead(leadId, "weekly-newsletter")

          await supabase.from("lead_events").insert({
            lead_id: leadId,
            event_type: "nurture_enrolled",
            event_data: { segment: nurtureSlug, reason: "7day_sequence_completed" },
          })
        }

        continue
      }

      // Check if this step has failed repeatedly today — pause and flag for investigation
      const { count: stepFailCount } = await supabase
        .from("lead_events")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", lead.id as string)
        .in("event_type", ["sequence_call_failed", "sequence_sms_failed", "sequence_email_failed"])
        .gte("created_at", todayStart.toISOString())

      if ((stepFailCount ?? 0) >= 3) {
        // Pause the sequence — something is broken, needs investigation
        console.error(`[sequences] Step ${nextStep.step_number} failed ${stepFailCount}x for lead ${lead.id} — PAUSING for investigation`)
        await pauseSequence(lead.id as string, `step_${nextStep.step_number}_failed_${stepFailCount}x`)
        await supabase.from("lead_events").insert({
          lead_id: lead.id,
          event_type: "sequence_paused_for_investigation",
          event_data: {
            step_number: nextStep.step_number,
            channel: nextStep.channel,
            failures: stepFailCount,
            reason: "Step failed 3+ times today. Sequence paused until root cause is fixed.",
          },
        })
        continue
      }

      // Check if delay has elapsed
      const enrolledAt = new Date(enrollment.enrolled_at).getTime()
      const dueAt = enrolledAt + nextStep.delay_minutes * 60 * 1000
      const now = Date.now()

      if (now < dueAt) continue // Not yet due

      // Check quiet hours
      if (isQuietHours(nextStep.send_after_hour, nextStep.send_before_hour)) continue

      // Track per-step success
      let stepSucceeded = false

      // Execute the step
      if (nextStep.channel === "auto_sms") {
        // SMS via Retell Chat API (A2P approved)
        {
        const template = nextStep.message_templates
        if (!template) {
          console.error(`[sequences] No template for step ${nextStep.step_number}`)
          errors++
          continue
        }

        const message = renderTemplate(template.body, lead)
        const normalizedPhone = (phone as string).replace(/\D/g, "")
        const e164 = normalizedPhone.startsWith("1") ? `+${normalizedPhone}` : `+1${normalizedPhone}`

        try {
          // Send via Retell SMS Chat API (A2P approved, carrier-compliant)
          const { sendRetellSms } = await import("@/lib/retell-sms")
          const fromNumber = process.env.RETELL_SMS_NUMBER || process.env.RETELL_PHONE_NUMBER || "+14709425787"
          const Retell = (await import("retell-sdk")).default
          const retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY! })
          const chat = await retellClient.chat.createSMSChat({
            from_number: fromNumber,
            to_number: e164,
            retell_llm_dynamic_variables: {
              initial_message: message,
            },
            metadata: {
              lead_id: lead.id as string,
              sequence_step: String(nextStep.step_number),
              template: template.slug,
            },
          })
          const chatId = chat.chat_id || "sent"

          // Log in contact interactions
          await storeInteraction(e164, {
            channel: "sms",
            direction: "outbound",
            content: message,
            metadata: { retell_chat_id: chatId, sequence_step: nextStep.step_number, template: template.slug },
          })

          // Log lead event
          await supabase.from("lead_events").insert({
            lead_id: lead.id,
            event_type: "sequence_sms_sent",
            event_data: {
              step_number: nextStep.step_number,
              template: template.slug,
              retell_chat_id: chatId,
            },
          })

          processed++
          stepSucceeded = true
        } catch (smsErr) {
          console.error(`[sequences] SMS send error for ${lead.id}:`, smsErr)
          errors++

          await supabase.from("lead_events").insert({
            lead_id: lead.id,
            event_type: "sequence_sms_failed",
            event_data: { step_number: nextStep.step_number, error: String(smsErr) },
          })
        }
        }
      } else if (nextStep.channel === "auto_call") {
        // Gate scheduled follow-up calls to high-connect-rate ET windows
        // (10am–12pm + 4pm–9pm). The first-contact call is NOT routed through
        // here — it goes through preme-portal/lib/lead-followup.ts which has no
        // time gating, preserving speed-to-lead. See isInCallableWindow().
        if (!isInCallableWindow()) {
          console.log(
            `[sequences] Lead ${lead.id} step ${nextStep.step_number} (auto_call) deferred — outside callable window (current ET hour outside {10,11,16,17,18,19,20}). Will retry next cron tick.`
          )
          continue
        }

        // Trigger Riley outbound call via Retell with number rotation
        const normalizedPhone = (phone as string).replace(/\D/g, "")
        const e164 = normalizedPhone.startsWith("1") ? `+${normalizedPhone}` : `+1${normalizedPhone}`
        const agentId = process.env.RETELL_AGENT_ID || "agent_a6b1d2e882775997b0c4e286b2"

        // Pick outbound number — same number for same lead, rotates across pool
        const { pickOutboundNumber } = await import("@/lib/retell")
        const fromNumber = await pickOutboundNumber(lead.id as string)

        try {
          const callId = await triggerDoubleDialCall(e164, agentId, {
            lead_id: lead.id as string,
            lead_name: `${lead.first_name} ${lead.last_name}`,
            sequence_step: String(nextStep.step_number),
          }, fromNumber)

          await storeInteraction(e164, {
            channel: "voice",
            direction: "outbound",
            content: null,
            summary: `Automated sequence call (step ${nextStep.step_number})`,
            metadata: { retell_call_id: callId, sequence_step: nextStep.step_number },
          })

          await supabase.from("lead_events").insert({
            lead_id: lead.id,
            event_type: "sequence_call_triggered",
            event_data: {
              step_number: nextStep.step_number,
              retell_call_id: callId,
              from_number: fromNumber,
              double_dial: true,
            },
          })

          processed++
          stepSucceeded = true
        } catch (callErr) {
          console.error(`[sequences] Call trigger error for ${lead.id}:`, callErr)
          errors++

          await supabase.from("lead_events").insert({
            lead_id: lead.id,
            event_type: "sequence_call_failed",
            event_data: { step_number: nextStep.step_number, error: String(callErr) },
          })
        }
      } else if (nextStep.channel === "auto_email") {
        // Send nurture email via Resend
        const template = nextStep.message_templates
        if (!template) {
          console.error(`[sequences] No template for email step ${nextStep.step_number}`)
          errors++
          continue
        }

        const email = lead.email as string
        if (!email) {
          console.warn(`[sequences] Lead ${lead.id} has no email, skipping email step`)
          // Still advance — don't retry on leads without email
          stepSucceeded = true
        } else {
          try {
            const message = renderTemplate(template.body, lead)
            const templateName = (template.name as string) || "Follow-Up"

            // Use Resend API directly
            const resendKey = process.env.RESEND_API_KEY
            const fromEmail = process.env.RESEND_FROM_EMAIL || "Preme Home Loans <noreply@premerealestate.com>"

            if (!resendKey) {
              console.error("[sequences] RESEND_API_KEY not configured")
              errors++
              continue
            }

            // Wrap plain text in HTML for open/click tracking
            const htmlMessage = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;"><tr><td style="padding:32px 24px;"><p style="font-size:16px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap;">${message}</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="font-size:12px;color:#999;">Preme Home Loans | <a href="https://premerealestate.com" style="color:#999;">premerealestate.com</a></p></td></tr></table></body></html>`

            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: fromEmail,
                to: [email],
                reply_to: ["riley@premerealestate.com"],
                subject: templateName,
                html: htmlMessage,
                text: message,
              }),
            })

            const result = await res.json()

            if (res.ok && result.id) {
              await supabase.from("lead_events").insert({
                lead_id: lead.id,
                event_type: "sequence_email_sent",
                event_data: {
                  step_number: nextStep.step_number,
                  template: template.slug,
                  resend_id: result.id,
                  subject: templateName,
                },
              })
              processed++
              stepSucceeded = true
            } else {
              console.error(`[sequences] Email send error for ${lead.id}:`, result)
              errors++
              await supabase.from("lead_events").insert({
                lead_id: lead.id,
                event_type: "sequence_email_failed",
                event_data: { step_number: nextStep.step_number, error: JSON.stringify(result) },
              })
            }
          } catch (emailErr) {
            console.error(`[sequences] Email error for ${lead.id}:`, emailErr)
            errors++
          }
        }
      }

      // Only advance enrollment to next step on success (not failure)
      // Failed steps will be retried on the next cron run
      if (stepSucceeded) {
        await supabase
          .from("sequence_enrollments")
          .update({ current_step: nextStep.step_number })
          .eq("id", enrollment.id)
      }

    } catch (err) {
      console.error(`[sequences] Error processing enrollment ${enrollment.id}:`, err)
      errors++
    }
  }

  // Process any pending double-dial calls
  const dialResult = await processPendingDials()

  return { processed, errors, ...dialResult }
}
