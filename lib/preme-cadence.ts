/**
 * Preme Home Loans — 13-Step Follow-Up Cadence Engine
 *
 * INDEPENDENT of Zentryx. Owns its own tables (preme.leads, preme.lead_cadence_queue,
 * preme.cadence_templates), its own runner (/api/cron/cadence-runner), its own
 * templates (copied, not joined to zentryx).
 *
 * Cadence (5 calls, 7 SMS, 1 email — ZERO double-dials):
 *
 *  Step | Time      | Type  | Template / Action
 *  -----+-----------+-------+--------------------
 *   1   | T+0       | call  | Riley single-dial (fired INLINE from lead-followup.ts)
 *   2   | T+1 min   | sms   | t1min-just-tried
 *   3   | T+5 min   | call  | Riley single-dial
 *   4   | T+7 min   | sms   | t7min-text-anytime
 *   5   | T+60 min  | call  | Riley single-dial
 *   6   | T+2 hr    | email | t2hr-email-summary
 *   7   | T+24 hr   | call  | Riley single-dial
 *   8   | T+32 hr   | sms   | day2-value
 *   9   | T+52 hr   | sms   | day3-social-proof
 *  10   | T+72 hr   | call  | Riley single-dial
 *  11   | T+80 hr   | sms   | day4-urgency
 *  12   | T+120 hr  | sms   | day6-soft-checkin
 *  13   | T+152 hr  | sms   | day7-final
 *
 * Auto-cancel: when Retell sends call_ended with duration_ms >= 30000, all
 * remaining pending steps for that lead are cancelled. Same for SMS opt-out
 * and explicit application submission.
 *
 * Day-7 nurture handoff: after step 13 fires, the lead is enrolled in the
 * appropriate Zentryx nurture sequence based on its current status. The
 * handoff is the ONLY zentryx touchpoint — Preme writes directly to
 * zentryx.zx_lead_enrollments via service-role API (no zentryx code changes).
 */

import Retell from "retell-sdk"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { ExecLog } from "@/lib/exec-log"

// ───────────────────────── CONFIG ─────────────────────────

// Cadence step definitions — single source of truth
export const CADENCE_STEPS = [
  { step: 1,  delayMin: 0,    type: "call",  template: null,                description: "T+0 immediate Riley call (single dial)" },
  { step: 2,  delayMin: 1,    type: "sms",   template: "t1min-just-tried",  description: "T+1 min SMS" },
  { step: 3,  delayMin: 5,    type: "call",  template: null,                description: "T+5 min Riley call (single dial)" },
  { step: 4,  delayMin: 7,    type: "sms",   template: "t7min-text-anytime", description: "T+7 min SMS" },
  { step: 5,  delayMin: 60,   type: "call",  template: null,                description: "T+60 min Riley call (single dial)" },
  { step: 6,  delayMin: 120,  type: "email", template: "t2hr-email-summary", description: "T+2 hr email" },
  { step: 7,  delayMin: 1440, type: "call",  template: null,                description: "T+24 hr Riley call (single dial)" },
  { step: 8,  delayMin: 1920, type: "sms",   template: "day2-value",        description: "T+32 hr Day 2 value SMS" },
  { step: 9,  delayMin: 3120, type: "sms",   template: "day3-social-proof", description: "T+52 hr Day 3 social-proof SMS" },
  { step: 10, delayMin: 4320, type: "call",  template: null,                description: "T+72 hr Riley call (single dial)" },
  { step: 11, delayMin: 4800, type: "sms",   template: "day4-urgency",      description: "T+80 hr Day 4 urgency SMS" },
  { step: 12, delayMin: 7200, type: "sms",   template: "day6-soft-checkin", description: "T+120 hr Day 6 soft check-in SMS" },
  { step: 13, delayMin: 9120, type: "sms",   template: "day7-final",        description: "T+152 hr Day 7 final SMS" },
] as const

// Training caller bot only — Nyalls's own phone (+19453088322) was previously
// in this set but it blocks the owner from form-testing the cadence with their
// own number. Removed 2026-04-07. The number is still excluded in admin tools
// (create-lead-and-text, manual click-to-call) which is correct.
const TRAINING_PHONES = new Set(["+14706225965"])
const SKIP_STATUSES = new Set(["converted", "dead", "unsubscribed", "do_not_contact"])

// Status → nurture sequence slug (final mapping based on real preme.leads.status values)
const NURTURE_MAPPING: Record<string, string | null> = {
  new:        "nurture-never-talked",      // never connected
  contacted:  "nurture-talked-not-ready",  // had a real conversation, not closing
  qualified:  "nurture-started-app",       // engaged, in funnel
  converted:  null,                         // already a customer — DROP
  // unsubscribed/do_not_contact also → null (DROP)
}

// ───────────────────────── SUPABASE CLIENTS ─────────────────────────

function premeClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" } }
  )
}

// Used ONLY for the day-7 nurture handoff — single write to zentryx.zx_lead_enrollments.
// No zentryx code changes; this is a direct service-role insert per the user's option B.
function zentryxClientForHandoff() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "zentryx" } }
  )
}

// ───────────────────────── HELPERS ─────────────────────────

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`
}

/**
 * Returns true if the current moment falls inside one of Preme's
 * approved outbound call windows (Eastern time):
 *   • 10:00 am – 10:59 am ET
 *   • 4:00 pm – 8:59 pm ET
 *
 * Used by the cadence runner to gate follow-up calls (steps 2-5 in
 * spec terms; step_number > 1 in the queue). Step 1 — the immediate
 * speed-to-lead call — is NEVER gated by this function.
 *
 * Why these windows: contact rate data shows 0% at 9am, 50% at 5pm.
 * Calling outside these windows wastes pool reputation.
 */
export function isInCallWindow(now: Date = new Date()): boolean {
  // Get the current hour in America/New_York regardless of server timezone.
  const etHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).format(now)
  const etHour = parseInt(etHourStr, 10)
  // 10 = "10am-10:59am ET window"
  // 16-20 = "4pm-8:59pm ET window" (closes at 21:00)
  return etHour === 10 || (etHour >= 16 && etHour <= 20)
}

export function shouldSkipLead(lead: { phone?: string | null; status?: string | null }): { skip: boolean; reason?: string } {
  if (!lead.phone) return { skip: false }
  const e164 = normalizePhone(lead.phone)
  if (TRAINING_PHONES.has(e164)) return { skip: true, reason: "training_phone" }
  if (lead.status && SKIP_STATUSES.has(lead.status)) return { skip: true, reason: `status_${lead.status}` }
  return { skip: false }
}

/**
 * Pick a healthy outbound number from the rotation pool.
 *
 * The fallback `RETELL_PREME_PHONE_NUMBER` (+14709425787) is the main Preme
 * INBOUND number, which was confirmed Spam-Likely by carriers on 2026-04-07.
 * It must NEVER be returned for outbound use. If the pool is empty, throw
 * rather than silently fall back to the burned number.
 */
export function pickPremeOutboundNumber(): string {
  const pool = (process.env.RETELL_OUTBOUND_POOL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (pool.length === 0) {
    throw new Error(
      "RETELL_OUTBOUND_POOL is empty — cannot place outbound call. " +
      "Refusing to fall back to +14709425787 (confirmed Spam-Likely)."
    )
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

function renderTemplate(body: string, lead: { first_name?: string; last_name?: string; loan_type?: string | null; email?: string }) {
  return body
    .replace(/\{\{first_name\}\}/g, lead.first_name || "there")
    .replace(/\{\{last_name\}\}/g, lead.last_name || "")
    .replace(/\{\{loan_type\}\}/g, lead.loan_type || "investment property loan")
    .replace(/\{\{email\}\}/g, lead.email || "")
}

// ───────────────────────── SINGLE-DIAL RILEY CALL ─────────────────────────

export interface SingleCallResult {
  ok: boolean
  call_id?: string
  from_number?: string
  error?: string
}

/**
 * Place EXACTLY ONE outbound Retell call for a Preme lead. No double-dial,
 * no second-attempt logic. If Retell rejects, return the error and let the
 * caller decide whether to retry on a future cadence step.
 */
export async function triggerSingleCall(lead: {
  id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
  loan_type?: string | null
  source?: string | null
}): Promise<SingleCallResult> {
  const apiKey = process.env.RETELL_API_KEY
  const agentId = process.env.RETELL_PREME_AGENT_ID
  if (!apiKey) return { ok: false, error: "RETELL_API_KEY not configured" }
  if (!agentId) return { ok: false, error: "RETELL_PREME_AGENT_ID not configured" }

  const fromNumber = pickPremeOutboundNumber()
  if (!fromNumber) return { ok: false, error: "no outbound number available" }

  const e164 = normalizePhone(lead.phone)

  const dynamicVars: Record<string, string> = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    lead_email: lead.email || "",
    lead_phone: lead.phone,
    loan_type: lead.loan_type || "investment property loan",
    lead_context: lead.source === "callback" ? "callback" : "website",
  }

  try {
    const client = new Retell({ apiKey })
    const call = await client.call.createPhoneCall({
      from_number: fromNumber,
      to_number: e164,
      override_agent_id: agentId,
      metadata: {
        lead_id: lead.id,
        source: "preme-cadence",
        single_dial: "true",
      },
      retell_llm_dynamic_variables: dynamicVars,
    })
    return { ok: true, call_id: call.call_id, from_number: fromNumber }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg, from_number: fromNumber }
  }
}

// ───────────────────────── ENQUEUE 13 STEPS ─────────────────────────

/**
 * Build the 13 cadence rows for a new lead and insert them all into
 * preme.lead_cadence_queue. Step 1 is created with status='pending' and
 * scheduled_at=now() — the caller is expected to fire it INLINE for
 * speed-to-lead, then mark step 1 as completed/failed via markStepResult().
 */
export async function enqueueCadence(lead: {
  id: string
  first_name: string
  last_name: string
  phone: string
  email?: string
}): Promise<{ ok: boolean; rows_created: number; error?: string }> {
  const supabase = premeClient()
  const now = new Date()
  const leadName = `${lead.first_name} ${lead.last_name}`.trim()

  const rows = CADENCE_STEPS.map((s) => ({
    lead_id: lead.id,
    lead_name: leadName,
    lead_phone: lead.phone,
    lead_email: lead.email || null,
    step_number: s.step,
    step_type: s.type,
    step_description: s.description,
    template_slug: s.template,
    scheduled_at: new Date(now.getTime() + s.delayMin * 60 * 1000).toISOString(),
    status: "pending" as const,
  }))

  const { error } = await supabase.from("lead_cadence_queue").insert(rows)
  if (error) {
    return { ok: false, rows_created: 0, error: error.message }
  }
  return { ok: true, rows_created: rows.length }
}

/**
 * Mark a single step row as completed or failed.
 */
export async function markStepResult(
  rowId: string,
  outcome: "completed" | "failed" | "cancelled",
  result: string,
  errorMessage?: string
): Promise<void> {
  const supabase = premeClient()
  await supabase
    .from("lead_cadence_queue")
    .update({
      status: outcome,
      result,
      error_message: errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", rowId)
}

// ───────────────────────── AUTO-CANCEL ─────────────────────────

/**
 * Cancel all pending steps for a lead. Triggered when:
 *   - Riley connects for 30+ seconds (real conversation)
 *   - Lead opts out via SMS (STOP/UNSUBSCRIBE)
 *   - Lead submits an application
 *   - Manual admin cancel
 */
export async function cancelRemainingCadence(leadId: string, reason: string): Promise<{ cancelled: number }> {
  const supabase = premeClient()
  const { data, error } = await supabase
    .from("lead_cadence_queue")
    .update({
      status: "cancelled",
      result: `auto_cancelled_${reason}`,
      completed_at: new Date().toISOString(),
    })
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .select("id")
  if (error) {
    console.error(`[preme-cadence] cancel error for lead ${leadId}:`, error.message)
    return { cancelled: 0 }
  }
  const cancelled = data?.length || 0
  if (cancelled > 0) {
    console.log(`[preme-cadence] Cancelled ${cancelled} pending steps for lead ${leadId} — reason: ${reason}`)
  }
  return { cancelled }
}

// ───────────────────────── EXECUTE A STEP ─────────────────────────

export interface QueueRow {
  id: string
  lead_id: string
  lead_name: string | null
  lead_phone: string | null
  lead_email: string | null
  step_number: number
  step_type: "call" | "sms" | "email"
  step_description: string
  template_slug: string | null
  scheduled_at: string
  status: string
}

/**
 * Execute one step from the queue. Wraps in ExecLog try/catch with
 * isResolved() finally net per Priority 2 pattern. Always marks the row
 * as completed or failed — never leaves it pending.
 */
export async function executeStep(row: QueueRow): Promise<void> {
  const log = new ExecLog(
    "preme-cadence-step",
    "cron",
    "preme",
    "riley",
    {
      lead_id: row.lead_id,
      step_number: row.step_number,
      step_type: row.step_type,
      template_slug: row.template_slug,
    }
  )

  let resolved = false
  try {
    // Re-check: did this lead get auto-cancelled between scheduling and execution?
    const supabase = premeClient()
    const { data: leadCheck } = await supabase
      .from("leads")
      .select("status")
      .eq("id", row.lead_id)
      .maybeSingle()

    if (leadCheck?.status && SKIP_STATUSES.has(leadCheck.status)) {
      await markStepResult(row.id, "cancelled", `lead_status_${leadCheck.status}`)
      await log.complete({ skipped: true, reason: `lead_status_${leadCheck.status}` })
      resolved = true
      return
    }

    // Build a "lead" object for template rendering / call dialing
    const [first, ...rest] = (row.lead_name || "").split(" ")
    const leadForExec = {
      id: row.lead_id,
      first_name: first || "there",
      last_name: rest.join(" "),
      phone: row.lead_phone || "",
      email: row.lead_email || undefined,
      loan_type: null as string | null,
    }

    if (row.step_type === "call") {
      // ── CALL WINDOW GATE ──────────────────────────────────────────
      // Step 1 (the immediate speed-to-lead call) is sacred — it ALWAYS
      // fires regardless of time. All follow-up calls (step_number > 1)
      // are gated to high-connect windows ET: 10am–11am and 4pm–9pm.
      //
      // If outside the window, leave the row PENDING (no markStepResult,
      // no log.fail) so the next cron pickup re-evaluates. The 24-hour
      // safety valve below releases stuck calls so leads don't go cold.
      if (row.step_number > 1) {
        const overdueMs = Date.now() - new Date(row.scheduled_at).getTime()
        const isStaleEnough = overdueMs > 24 * 60 * 60 * 1000

        if (!isStaleEnough && !isInCallWindow()) {
          console.log(
            `[preme-cadence] Deferred call step ${row.step_number} for lead ${row.lead_id} — outside call window (10am-11am or 4pm-9pm ET)`
          )
          await log.complete({
            deferred: true,
            reason: "outside_call_window",
            step_number: row.step_number,
            scheduled_at: row.scheduled_at,
          })
          resolved = true
          return
        }
      }

      const result = await triggerSingleCall(leadForExec)
      if (result.ok) {
        await markStepResult(row.id, "completed", `call_id=${result.call_id} from=${result.from_number}`)
        await log.complete({ call_id: result.call_id, from_number: result.from_number })
      } else {
        await markStepResult(row.id, "failed", "retell_call_failed", result.error)
        await log.fail(`call failed: ${result.error}`)
      }
      resolved = true
      return
    }

    if (row.step_type === "sms") {
      const r = await sendSms(row, leadForExec)
      if (r.ok) {
        await markStepResult(row.id, "completed", r.detail || "sms_sent")
        await log.complete({ template: row.template_slug, detail: r.detail })
      } else {
        await markStepResult(row.id, "failed", "sms_send_failed", r.error)
        await log.fail(`sms failed: ${r.error}`)
      }
      resolved = true
      return
    }

    if (row.step_type === "email") {
      const r = await sendEmail(row, leadForExec)
      if (r.ok) {
        await markStepResult(row.id, "completed", r.detail || "email_sent")
        await log.complete({ template: row.template_slug, detail: r.detail })
      } else {
        await markStepResult(row.id, "failed", "email_send_failed", r.error)
        await log.fail(`email failed: ${r.error}`)
      }
      resolved = true
      return
    }

    // Unknown step type — should never happen
    await markStepResult(row.id, "failed", "unknown_step_type", row.step_type)
    await log.fail(`unknown step_type: ${row.step_type}`)
    resolved = true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await markStepResult(row.id, "failed", "exception", msg)
    await log.fail(`exception: ${msg}`)
    resolved = true
    throw err
  } finally {
    if (!resolved) {
      // Should never hit this — defense-in-depth from Priority 2
      await log.fail("executeStep returned without resolving (logging gap)")
      await markStepResult(row.id, "failed", "logging_gap")
    }
  }
}

// ───────────────────────── SMS SENDER ─────────────────────────

async function sendSms(row: QueueRow, lead: { first_name: string; last_name: string; loan_type: string | null }): Promise<{ ok: boolean; detail?: string; error?: string }> {
  if (!row.template_slug) return { ok: false, error: "no template_slug on row" }
  if (!row.lead_phone) return { ok: false, error: "no phone on row" }

  // Pull template body
  const supabase = premeClient()
  const { data: tmpl, error: tErr } = await supabase
    .from("cadence_templates")
    .select("body")
    .eq("slug", row.template_slug)
    .maybeSingle()
  if (tErr || !tmpl) return { ok: false, error: `template not found: ${row.template_slug}` }

  const message = renderTemplate(tmpl.body, lead)
  const e164 = normalizePhone(row.lead_phone)
  const fromNumber = pickPremeOutboundNumber()

  // Use the Retell SDK's chat.createSMSChat — same pattern as zentryx/lib/retell-sms.ts.
  // The SDK auto-resolves the agent from the from_number's Retell config, so we
  // do NOT pass agent_id explicitly. (Trying the raw /create-chat REST endpoint
  // requires agent_id and a chat-enabled agent — Riley's voice agent isn't.)
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) return { ok: false, error: "RETELL_API_KEY not configured" }

  try {
    const client = new Retell({ apiKey })
    const chat = await client.chat.createSMSChat({
      from_number: fromNumber,
      to_number: e164,
      retell_llm_dynamic_variables: {
        initial_message: message,
        first_name: lead.first_name,
        last_name: lead.last_name,
        loan_type: lead.loan_type || "investment property loan",
      },
      metadata: {
        lead_id: row.lead_id,
        step_number: String(row.step_number),
        template: row.template_slug,
        source: "preme-cadence",
      },
    })
    return { ok: true, detail: `chat_id=${chat.chat_id || "sent"} template=${row.template_slug}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ───────────────────────── EMAIL SENDER ─────────────────────────

async function sendEmail(row: QueueRow, lead: { first_name: string; last_name: string; loan_type: string | null }): Promise<{ ok: boolean; detail?: string; error?: string }> {
  if (!row.template_slug) return { ok: false, error: "no template_slug on row" }
  if (!row.lead_email) return { ok: false, error: "no email on row" }

  const supabase = premeClient()
  const { data: tmpl, error: tErr } = await supabase
    .from("cadence_templates")
    .select("subject, body")
    .eq("slug", row.template_slug)
    .maybeSingle()
  if (tErr || !tmpl) return { ok: false, error: `template not found: ${row.template_slug}` }

  const renderedSubject = renderTemplate(tmpl.subject || "Following up", lead)
  const renderedBody = renderTemplate(tmpl.body, lead)

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY not configured" }
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Preme Home Loans <noreply@premerealestate.com>"

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [row.lead_email],
        subject: renderedSubject,
        html: renderedBody,
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      return { ok: false, error: `resend ${r.status}: ${text.slice(0, 200)}` }
    }
    const data = await r.json()
    return { ok: true, detail: `resend_id=${data.id} template=${row.template_slug}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ───────────────────────── DAY-7 NURTURE HANDOFF ─────────────────────────

/**
 * After step 13 fires, route the lead into the appropriate Zentryx nurture
 * sequence based on its current preme.leads.status.
 *
 * This is the ONLY zentryx touchpoint. We write directly to
 * zentryx.zx_lead_enrollments via service-role API — NO zentryx code is
 * modified, NO existing zentryx logic is changed. Just a data insert.
 *
 * The mapping is based on real preme.leads.status values audited from
 * production data. DQ-bucket statuses are not yet in use.
 */
export async function routeToNurtureAfterDay7(leadId: string): Promise<{ ok: boolean; nurture_slug?: string | null; reason?: string }> {
  const supabase = premeClient()
  const { data: lead } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone, email, status")
    .eq("id", leadId)
    .maybeSingle()

  if (!lead) return { ok: false, reason: "lead_not_found" }

  const status = lead.status || "new"
  const nurtureSlug = NURTURE_MAPPING[status]

  if (!nurtureSlug) {
    console.log(`[preme-cadence] Day-7 handoff: lead ${leadId} status=${status} → DROP (no nurture)`)
    return { ok: true, nurture_slug: null, reason: `dropped_status_${status}` }
  }

  // Find or look up the matching zentryx lead by phone (last 10 digits)
  const zentryx = zentryxClientForHandoff()
  const phoneDigits = normalizePhone(lead.phone || "").replace(/\D/g, "").slice(-10)
  if (!phoneDigits) {
    return { ok: false, reason: "no_phone_for_handoff" }
  }

  const { data: zxLead } = await zentryx
    .from("zx_leads")
    .select("id")
    .like("phone", `%${phoneDigits}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!zxLead) {
    console.log(`[preme-cadence] Day-7 handoff: no matching zx_lead for phone ${phoneDigits} — skipping enrollment`)
    return { ok: false, reason: "no_zentryx_lead_match" }
  }

  // Look up the sequence id from slug
  const { data: seq } = await zentryx
    .from("zx_sequences")
    .select("id")
    .eq("slug", nurtureSlug)
    .maybeSingle()

  if (!seq) {
    return { ok: false, reason: `sequence_slug_not_found: ${nurtureSlug}` }
  }

  // Direct insert into zx_lead_enrollments — no zentryx code change, just data write
  const { error: enrollErr } = await zentryx
    .from("zx_lead_enrollments")
    .insert({
      lead_id: zxLead.id,
      sequence_id: seq.id,
      current_step: 0,
      status: "active",
      enrolled_at: new Date().toISOString(),
    })

  if (enrollErr) {
    return { ok: false, reason: `enrollment_insert_failed: ${enrollErr.message}` }
  }

  console.log(`[preme-cadence] Day-7 handoff: lead ${leadId} status=${status} → enrolled in ${nurtureSlug}`)
  return { ok: true, nurture_slug: nurtureSlug }
}
