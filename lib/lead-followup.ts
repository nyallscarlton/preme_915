/**
 * Preme Home Loans -- Lead Follow-Up Cadence Engine
 *
 * Two paths:
 *
 * PATH 1 — Application submitted (triggerApplicationFollowUp):
 *   Step 1: Welcome SMS +1 min
 *   Step 2: Call +3 min
 *   Step 3: Missed call SMS +5 min
 *   Step 4: Call +60 min
 *   Step 5: Missed call SMS +90 min
 *   Step 6: Day 1 email +24 hr
 *   Step 7: Day 3 email +72 hr
 *
 * PATH 2 — Lead form / Retell inbound (triggerLeadFollowUp):
 *   Step 1: Immediate call (inline)
 *   Step 2: SMS +1 min
 *   Step 3: Call +5 min
 *   Step 4: SMS +7 min
 *   Step 5: Call +60 min
 *   Step 6: Email +120 min (post-cadence)
 *   Step 7: Day 1 email +24 hr
 *   Step 8: Day 3 email +72 hr
 *
 * If Riley connects at any point (30+ sec call), the entire remaining
 * cadence cancels automatically (handled by the cron executor).
 */

import { triggerOutboundCall } from "@/lib/retell"
import { createAdminClient } from "@/lib/supabase/admin"

// Training phones -- never follow up
const EXCLUDED_PHONES = new Set(["+14706225965", "+19453088322"])

// Statuses that should NOT receive follow-ups
const SKIP_STATUSES = new Set(["converted", "dead"])

export interface LeadForFollowUp {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  loan_type?: string | null
  source?: string | null
  status?: string | null
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`
}

function shouldSkip(lead: LeadForFollowUp): boolean {
  const e164 = normalizePhone(lead.phone)
  if (EXCLUDED_PHONES.has(e164)) {
    console.log(`[lead-followup] Skipping excluded phone: ${e164}`)
    return true
  }
  if (lead.status && SKIP_STATUSES.has(lead.status)) {
    console.log(`[lead-followup] Skipping lead ${lead.id} with status: ${lead.status}`)
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// PATH 1: Application Submitted
// ---------------------------------------------------------------------------

/**
 * Trigger follow-up cadence for a submitted application.
 * Called from POST /api/applications after insert.
 * Does NOT make an immediate call — queues welcome SMS first, call at +3 min.
 */
export async function triggerApplicationFollowUp(lead: LeadForFollowUp): Promise<void> {
  if (shouldSkip(lead)) return

  console.log(`[lead-followup] Starting APPLICATION cadence for lead ${lead.id} (${lead.first_name} ${lead.last_name})`)

  const supabase = createAdminClient()
  const now = new Date()

  const steps = [
    { step: 1, action_type: "welcome_sms", delayMinutes: 1 },
    { step: 2, action_type: "call", delayMinutes: 3 },
    { step: 3, action_type: "sms", delayMinutes: 5 },
    { step: 4, action_type: "call", delayMinutes: 60 },
    { step: 5, action_type: "sms", delayMinutes: 90 },
    { step: 6, action_type: "day1_email", delayMinutes: 1440 },  // 24hr
    { step: 7, action_type: "day3_email", delayMinutes: 4320 },  // 72hr
  ]

  const rows = steps.map((s) => ({
    lead_id: lead.id,
    step: s.step,
    action_type: s.action_type,
    scheduled_at: new Date(now.getTime() + s.delayMinutes * 60 * 1000).toISOString(),
    status: "pending",
  }))

  const { error } = await supabase.from("lead_followup_queue").insert(rows)

  if (error) {
    console.error("[lead-followup] Failed to schedule application follow-ups:", error.message)
  } else {
    console.log(`[lead-followup] Scheduled ${rows.length} application follow-up steps for lead ${lead.id}`)
  }
}

// ---------------------------------------------------------------------------
// PATH 2: Lead Form / Retell Inbound (existing, updated with day1/day3)
// ---------------------------------------------------------------------------

/**
 * Trigger the lead follow-up cadence: immediate call + scheduled steps.
 * Designed to be called fire-and-forget after lead insertion.
 */
export async function triggerLeadFollowUp(lead: LeadForFollowUp): Promise<void> {
  if (shouldSkip(lead)) return

  console.log(`[lead-followup] Starting LEAD cadence for lead ${lead.id} (${lead.first_name} ${lead.last_name})`)

  // Step 1: Immediate outbound call
  const callResult = await triggerOutboundCall({
    id: lead.id,
    first_name: lead.first_name,
    last_name: lead.last_name,
    phone: lead.phone,
    loan_type: lead.loan_type || undefined,
    source: lead.source || undefined,
  })

  const supabase = createAdminClient()

  if ("call_id" in callResult) {
    console.log(`[lead-followup] Immediate call placed: ${callResult.call_id}`)
    await supabase
      .from("leads")
      .update({
        retell_call_id: callResult.call_id,
        status: "contacted",
      })
      .eq("id", lead.id)
  } else {
    console.error(`[lead-followup] Immediate call failed: ${callResult.error}`)
  }

  // Schedule remaining follow-up steps in the queue
  const now = new Date()

  const steps = [
    { step: 2, action_type: "sms", delayMinutes: 1 },
    { step: 3, action_type: "call", delayMinutes: 5 },
    { step: 4, action_type: "sms", delayMinutes: 7 },
    { step: 5, action_type: "call", delayMinutes: 60 },
    { step: 6, action_type: "email", delayMinutes: 120 },
    { step: 7, action_type: "day1_email", delayMinutes: 1440 },  // 24hr
    { step: 8, action_type: "day3_email", delayMinutes: 4320 },  // 72hr
  ]

  const rows = steps.map((s) => ({
    lead_id: lead.id,
    step: s.step,
    action_type: s.action_type,
    scheduled_at: new Date(now.getTime() + s.delayMinutes * 60 * 1000).toISOString(),
    status: "pending",
  }))

  const { error } = await supabase.from("lead_followup_queue").insert(rows)

  if (error) {
    console.error("[lead-followup] Failed to schedule follow-ups:", error.message)
  } else {
    console.log(`[lead-followup] Scheduled ${rows.length} follow-up steps for lead ${lead.id}`)
  }
}
