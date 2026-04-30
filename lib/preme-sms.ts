/**
 * Canonical Preme SMS sender.
 *
 * ONE path for all Preme outbound SMS. Routes exclusively through Retell's
 * chat.createSMSChat from +14709425787 (the only A2P-registered sender in
 * the Preme account). Never uses Twilio directly.
 *
 * WHY THIS EXISTS: On 2026-03-28 through 2026-04-08, Preme had TWO separate
 * SMS code paths that diverged silently. One used Twilio (blocked by a FAILED
 * A2P 10DLC campaign), the other used Retell (worked). 389 messages silently
 * dropped over 11 days. This module is the permanent fix — any future Preme
 * SMS MUST import from here.
 *
 * See: memory/reference_preme_sms_infrastructure.md for the full incident.
 */

import Retell from "retell-sdk"

import { patchContactCustomFields, syncSmsToGhl } from "./ghl-client"
import {
  type Objective,
  type ObjectivePayload,
  buildAgentToolDefinition,
  renderFallback,
  validatePayload,
} from "./preme-sms-objectives"

// The only Preme number with an active Retell A2P registration AND First Orion
// voice branding. Single source of truth for all Preme outbound SMS.
export const PREME_SMS_FROM = "+14709425787"

export interface PremeSmsArgs {
  toPhone: string
  message: string
  firstName?: string
  leadId?: string
  source: string // required — who called this (e.g. "create_lead_and_text", "cadence_runner")
  metadata?: Record<string, string | undefined>
  /** Extra dynamic variables merged into retell_llm_dynamic_variables (e.g. objective + payload fields). */
  dynamicVariables?: Record<string, string>
}

export interface PremeSmsResult {
  ok: boolean
  chatId?: string
  error?: string
  from: string
}

/**
 * Send a Preme SMS via Retell. Single canonical entrypoint.
 *
 * Returns ok:false on any failure — callers must handle the error path and
 * surface it. Never assume success. HTTP 200 from Retell does NOT guarantee
 * carrier delivery; async monitoring via sms_delivery_audit.py is the source
 * of truth for actual delivery.
 */
export async function sendPremeSms(args: PremeSmsArgs): Promise<PremeSmsResult> {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    return { ok: false, error: "RETELL_API_KEY not configured", from: PREME_SMS_FROM }
  }

  try {
    const client = new Retell({ apiKey })
    const chat = await client.chat.createSMSChat({
      from_number: PREME_SMS_FROM,
      to_number: args.toPhone,
      retell_llm_dynamic_variables: {
        opening_message: args.message,
        initial_message: args.message, // SMS agent v0 uses {{initial_message}}; v1 uses {{opening_message}}
        first_name: args.firstName || "there",
        ...(args.dynamicVariables || {}),
      },
      metadata: {
        source: args.source,
        lead_id: args.leadId || "",
        ...(args.metadata || {}),
      },
    })
    console.log(`[preme-sms] ${args.source} → ${args.toPhone}: chat_id=${chat.chat_id}`)
    return { ok: true, chatId: chat.chat_id, from: PREME_SMS_FROM }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[preme-sms] ${args.source} → ${args.toPhone} FAILED: ${msg}`)
    return { ok: false, error: msg, from: PREME_SMS_FROM }
  }
}

// ---------------------------------------------------------------------------
// Objective-driven entrypoint (Doc 02.13 §2.3 spec shape)
//
// New work should call sendPremeSmsByObjective() rather than the legacy
// sendPremeSms() above. The legacy function remains the low-level send
// primitive; this wrapper resolves objective + payload via the canonical
// registry, runtime-validates the payload, renders a baseline message, and
// delegates the actual Retell call to sendPremeSms().
//
// When the Retell SMS agent's console prompt is updated to honor the
// `objective` and payload fields in retell_llm_dynamic_variables (see
// docs/preme-sms-agent-console-update.md), the agent itself can rewrite the
// initial message with richer content. Until then the deterministic
// renderFallback output is what the lead receives.
// ---------------------------------------------------------------------------

export interface SendPremeSmsByObjectiveArgs<O extends Objective> {
  toPhone: string
  objective: O
  payload: unknown
  firstName?: string
  contactId?: string
  leadId?: string
  source: string
  /** Lead interaction history from GHL — injected as {{timeline_notes}} for Riley context. */
  timelineNotes?: string
  /** Cadence position — P1, P2, or P3. Injected as {{phase}} for tone calibration. */
  phase?: string
  metadata?: Record<string, string | undefined>
  /** When true, skip the Retell call and return the rendered preview only. */
  dryRun?: boolean
}

export interface SendPremeSmsByObjectivePreview {
  ok: true
  dryRun: true
  rendered: string
  from: string
  dynamicVariables: Record<string, string>
}

export type SendPremeSmsByObjectiveResult =
  | PremeSmsResult
  | SendPremeSmsByObjectivePreview

export async function sendPremeSmsByObjective<O extends Objective>(
  args: SendPremeSmsByObjectiveArgs<O>,
): Promise<SendPremeSmsByObjectiveResult> {
  // Runtime payload validation. Throws on shape mismatch — callers that don't
  // know the payload at compile time get a hard, immediate error.
  const validatedPayload = validatePayload(args.objective, args.payload) as ObjectivePayload<O>

  const firstName = args.firstName?.trim() || "there"
  const rendered = renderFallback(args.objective, validatedPayload, firstName)

  // Retell dynamic variables — flat string map. The Retell agent prompt reads
  // `objective` to branch into the right prompt slice, then can read payload
  // fields prefixed `payload_*`.
  const dynamicVariables: Record<string, string> = {
    objective: args.objective,
    first_name: firstName,
    timeline_notes: args.timelineNotes || "",
    phase: args.phase || "",
  }
  for (const [k, v] of Object.entries(validatedPayload as Record<string, unknown>)) {
    dynamicVariables[`payload_${k}`] =
      typeof v === "string" ? v : JSON.stringify(v)
  }

  if (args.dryRun) {
    return {
      ok: true,
      dryRun: true,
      rendered,
      from: PREME_SMS_FROM,
      dynamicVariables,
    }
  }

  const sendResult = await sendPremeSms({
    toPhone: args.toPhone,
    message: rendered,
    firstName,
    leadId: args.leadId,
    source: args.source,
    dynamicVariables,
    metadata: {
      ...(args.metadata || {}),
      objective: args.objective,
      contact_id: args.contactId,
      payload_json: JSON.stringify(validatedPayload),
    },
  })

  // Post-send side effects — fire-and-forget, never block the SMS result.
  if (sendResult.ok && args.contactId) {
    void writePostSendState(args.objective, args.contactId, args.source)
    // Sync outbound SMS to GHL conversation thread so it's visible on the contact.
    void syncSmsToGhl(args.contactId, "outbound", rendered).catch((err) =>
      console.error(`[preme-sms] GHL outbound sync failed (contact=${args.contactId}):`, err),
    )
  }

  return sendResult
}

/**
 * Post-send state side effects per Doc 02.4 §3 Function 1.
 * - pre_qual_link_send / pre_qual_link_resend → pre_qual_state = "link_sent"
 * - loan_app_send → loan_app_state = "link_sent"
 *
 * Fire-and-forget. Errors logged but never thrown — the SMS already shipped.
 */
async function writePostSendState(
  objective: Objective,
  contactId: string,
  source: string,
): Promise<void> {
  let fields: Record<string, string> | null = null
  if (objective === "pre_qual_link_send" || objective === "pre_qual_link_resend") {
    fields = { pre_qual_state: "link_sent" }
  } else if (objective === "loan_app_send") {
    fields = { loan_app_state: "link_sent" }
  }
  if (!fields) return

  const r = await patchContactCustomFields(contactId, fields)
  if (!r.ok) {
    console.error(
      `[preme-sms] post-send state PATCH FAILED (objective=${objective}, contact=${contactId}, source=${source}): ${r.error}`,
    )
  } else {
    console.log(
      `[preme-sms] post-send state PATCHed (objective=${objective}, contact=${contactId}): ${JSON.stringify(fields)}`,
    )
  }
}

// Re-export the registry from this module so consumers have one canonical
// import path. touch23_match_delivery was retired 2026-04-25 (Doc 02.13 §7
// Retired Objectives) — lender identity withheld until close. Drip nudges and
// loan_app_send added same date (Doc 02.13 §7, Doc 02.14 §4.5).
export {
  OBJECTIVES,
  type Objective,
  buildAgentToolDefinition,
  promptSliceFor,
} from "./preme-sms-objectives"

/**
 * Canonical objective slugs — kept inline for greppability against this file.
 * Source of truth remains lib/preme-sms-objectives.ts.
 *
 *   pre_qual_link_send, pre_qual_link_resend, follow_up_no_call_connect,
 *   day1_evening_soft_check, day2_value_recap, day4_objection_handle,
 *   day5_help_offer, day6_urgency, day7_final_release, callback_confirmation,
 *   post_submission_thanks, custom_ad_hoc, nurture_monthly,
 *   pre_qual_open_nudge, pre_qual_submit_nudge, loan_app_open_nudge,
 *   loan_app_submit_nudge, loan_app_send
 */
