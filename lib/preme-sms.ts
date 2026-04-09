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
        initial_message: args.message,
        first_name: args.firstName || "there",
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
