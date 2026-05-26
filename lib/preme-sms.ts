/**
 * Canonical Preme SMS sender.
 *
 * All Preme outbound SMS routes through Retell chat.createSMSChat from
 * +14709425787. Retell manages 10DLC/A2P registration. Outbound syncs to
 * GHL via syncSmsToGhl(); inbound replies sync via the sms-memory webhook
 * on app.premerealestate.com/api/webhooks/retell/sms-memory.
 *
 * Twilio (+14703159898) is NOT used — A2P campaign is in FAILED state.
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

export const PREME_SMS_FROM = "+14709425787"
// Chat agent that handles SMS conversations (get-chat-agent endpoint, not get-agent)
const PREME_SMS_AGENT_ID = "agent_ce0308f227491edfd0606f0aef"

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
 * Send a Preme SMS via Retell chat.createSMSChat. Single canonical entrypoint.
 *
 * Returns ok:false on any failure — never assume success.
 */
export async function sendPremeSms(args: PremeSmsArgs): Promise<PremeSmsResult> {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    return { ok: false, error: "RETELL_API_KEY not configured", from: PREME_SMS_FROM }
  }

  try {
    const retell = new Retell({ apiKey })
    // Build metadata — contact_id lets the sms-memory webhook skip GHL phone lookup
    const retellMetadata: Record<string, string> = {}
    if (args.metadata) {
      for (const [k, v] of Object.entries(args.metadata)) {
        if (v !== undefined) retellMetadata[k] = v
      }
    }
    const chat = await retell.chat.createSMSChat({
      from_number: PREME_SMS_FROM,
      to_number: args.toPhone,
      override_agent_id: PREME_SMS_AGENT_ID,
      retell_llm_dynamic_variables: {
        initial_message: args.message,
        opening_message: args.message,
        first_name: args.firstName || "there",
        lead_id: args.leadId || "",
        source: args.source,
        ...(args.dynamicVariables || {}),
      },
      ...(Object.keys(retellMetadata).length ? { metadata: retellMetadata } : {}),
    })
    const chatId = (chat as any).chat_id || (chat as any).id || null
    console.log(`[preme-sms] ${args.source} → ${args.toPhone}: chat_id=${chatId}`)
    return { ok: true, chatId, from: PREME_SMS_FROM }
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
