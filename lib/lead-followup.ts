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
import { createZentrxClient } from "@/lib/supabase/admin"
import { ExecLog } from "@/lib/exec-log"
// New 13-step Preme-owned cadence (independent of Zentryx)
import {
  enqueueCadence,
  triggerSingleCall,
  markStepResult,
  cancelRemainingCadence,
  shouldSkipLead,
} from "@/lib/preme-cadence"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Training phones -- never follow up.
// Removed +19453088322 (owner phone) on 2026-04-07 so Nyalls can form-test
// the cadence with his own number. Still excluded in admin/routing code.
const EXCLUDED_PHONES = new Set(["+14706225965"])

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

  const supabase = createZentrxClient()
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
 * Trigger the Preme 13-step follow-up cadence:
 *   1. Enqueue all 13 cadence rows in preme.lead_cadence_queue
 *   2. Fire step 1 (Riley single-dial) INLINE for speed-to-lead — no cron delay
 *   3. Mark step 1 as completed/failed in the queue
 *   4. Steps 2-13 execute via /api/cron/cadence-runner (every 2 min)
 *
 * Wrapped in ExecLog with isResolved() finally net per Priority 2 pattern.
 */
export async function triggerLeadFollowUp(lead: LeadForFollowUp): Promise<void> {
  const skip = shouldSkipLead(lead)
  if (skip.skip) {
    console.log(`[lead-followup] Skipping lead ${lead.id} — ${skip.reason}`)
    return
  }

  const log = new ExecLog("preme-cadence-bootstrap", "webhook", "preme", "riley", {
    lead_id: lead.id,
    name: `${lead.first_name} ${lead.last_name}`,
    phone: lead.phone,
    source: lead.source,
  })
  // Give ExecLog.init() time to capture the row id (avoid the slow-init race)
  await new Promise((r) => setTimeout(r, 100))

  try {
    console.log(`[lead-followup] Starting PREME 13-STEP cadence for lead ${lead.id} (${lead.first_name} ${lead.last_name})`)

    // 1. Enqueue all 13 steps (uses preme.lead_cadence_queue)
    const enq = await enqueueCadence({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
    })
    if (!enq.ok) {
      await log.fail(`enqueueCadence failed: ${enq.error}`)
      return
    }

    // 2. Find the step 1 row we just inserted (so we can update its status)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: "preme" } }
    )
    const { data: step1Row } = await supabase
      .from("lead_cadence_queue")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("step_number", 1)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // 3. Fire step 1 (Riley single-dial) INLINE — no cron delay, speed-to-lead
    const callResult = await triggerSingleCall({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      loan_type: lead.loan_type,
      source: lead.source,
    })

    // 4. Mark step 1 result
    if (step1Row?.id) {
      if (callResult.ok) {
        await markStepResult(
          step1Row.id,
          "completed",
          `call_id=${callResult.call_id} from=${callResult.from_number}`
        )
      } else {
        await markStepResult(
          step1Row.id,
          "failed",
          "retell_call_failed",
          callResult.error
        )
      }
    }

    // 5. Update preme.leads with the call id (best-effort)
    if (callResult.ok && callResult.call_id) {
      await supabase
        .from("leads")
        .update({
          retell_call_id: callResult.call_id,
          status: "contacted",
        })
        .eq("id", lead.id)
    }

    if (callResult.ok) {
      console.log(`[lead-followup] Step 1 fired: call_id=${callResult.call_id} from=${callResult.from_number}`)
    } else {
      console.error(`[lead-followup] Step 1 failed: ${callResult.error}`)
    }

    await log.complete({
      cadence: "preme-13-step",
      enqueued: enq.rows_created,
      step1_call_placed: callResult.ok,
      step1_call_id: callResult.call_id || null,
      step1_from_number: callResult.from_number || null,
      step1_error: callResult.error || null,
    })

    if (callResult.ok) {
      await log.successAlert(`✅ Riley called ${lead.first_name} ${lead.last_name} (single dial)`)
    }
  } catch (err) {
    await log.fail(err instanceof Error ? err.message : String(err))
    throw err
  } finally {
    // Defense-in-depth: if any code path returned without resolving the log,
    // mark it failed. Same pattern as the retell webhook fix from Priority 2.
    if (!log.isResolved()) {
      await log.fail("triggerLeadFollowUp returned without calling complete/fail (logging gap)")
    }
  }
}

// ---------------------------------------------------------------------------
// PATH 3: Email-Only Leads (no phone — website forms, landing pages, etc.)
// ---------------------------------------------------------------------------

/**
 * Queue email-only follow-ups for leads that have an email but no phone.
 * Skips calls and SMS — just sends the email nurture sequence.
 *
 * Called from lead creation endpoints when phone is missing but email exists.
 */
export async function triggerEmailOnlyFollowUp(lead: LeadForFollowUp): Promise<void> {
  if (!lead.email || lead.email.endsWith("@placeholder.preme")) {
    console.log(`[lead-followup] Skipping email-only cadence — no valid email for lead ${lead.id}`)
    return
  }

  if (lead.status && SKIP_STATUSES.has(lead.status)) {
    console.log(`[lead-followup] Skipping lead ${lead.id} with status: ${lead.status}`)
    return
  }

  console.log(`[lead-followup] Starting EMAIL-ONLY cadence for lead ${lead.id} (${lead.first_name} ${lead.last_name})`)

  const supabase = createZentrxClient()
  const now = new Date()

  const steps = [
    { step: 1, action_type: "email", delayMinutes: 5 },           // Quick intro email
    { step: 2, action_type: "day1_email", delayMinutes: 1440 },   // 24hr
    { step: 3, action_type: "day3_email", delayMinutes: 4320 },   // 72hr
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
    console.error("[lead-followup] Failed to schedule email-only follow-ups:", error.message)
  } else {
    console.log(`[lead-followup] Scheduled ${rows.length} email-only follow-up steps for lead ${lead.id}`)
  }
}

// ---------------------------------------------------------------------------
// Deduplication: cancel existing pending follow-ups before re-queuing
// ---------------------------------------------------------------------------

/**
 * Cancel any pending follow-up queue entries for a lead.
 * Cancels rows in BOTH systems:
 *   - Legacy zentryx.lead_followup_queue (in-flight rows from before the migration)
 *   - New preme.lead_cadence_queue (the 13-step Preme cadence)
 *
 * Called when:
 *   - An application is submitted (supersedes outreach)
 *   - Lead opts out
 *   - Manual admin cancel
 */
export async function cancelPendingFollowUps(leadId: string, reason: string = "superseded_by_application"): Promise<number> {
  // 1. Cancel new preme.lead_cadence_queue rows
  const premeCancel = await cancelRemainingCadence(leadId, reason)

  // 2. Cancel legacy zentryx.lead_followup_queue rows (best-effort — table may have nothing for new leads)
  const supabase = createZentrxClient()
  const { data, error } = await supabase
    .from("lead_followup_queue")
    .update({
      status: "cancelled",
      result: { reason },
      completed_at: new Date().toISOString(),
    })
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .select("id")

  if (error) {
    console.error(`[lead-followup] Failed to cancel legacy queue for lead ${leadId}:`, error.message)
  }

  const legacyCount = data?.length || 0
  const total = premeCancel.cancelled + legacyCount
  if (total > 0) {
    console.log(`[lead-followup] Cancelled ${total} pending steps for lead ${leadId} (preme=${premeCancel.cancelled}, legacy=${legacyCount}, reason=${reason})`)
  }
  return total
}
