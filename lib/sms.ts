/**
 * Preme Home Loans -- SMS via Twilio REST API
 *
 * Uses raw fetch (no SDK) to keep dependencies light.
 * From number is TWILIO_FROM_NUMBER env (defaults to +14709167713 — a
 * Twilio-side SMS-only number, NOT the Preme inbound +14709425787 which
 * was confirmed Spam-Likely by carriers on 2026-04-07).
 */

import { getLoanDescription } from "@/lib/loan-purpose"

const TWILIO_ACCOUNT_SID = () => process.env.TWILIO_ACCOUNT_SID || ""
const TWILIO_AUTH_TOKEN = () => process.env.TWILIO_AUTH_TOKEN || ""
const TWILIO_FROM_NUMBER = () => process.env.TWILIO_FROM_NUMBER || "+14709167713"

// Training phones -- never send SMS to these
const EXCLUDED_PHONES = new Set(["+14706225965", "+19453088322"])

export interface SmsResult {
  success: boolean
  sid?: string
  error?: string
}

/**
 * Send an SMS via Twilio REST API.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = TWILIO_ACCOUNT_SID()
  const authToken = TWILIO_AUTH_TOKEN()

  if (!accountSid || !authToken) {
    console.error("[sms] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not configured")
    return { success: false, error: "twilio_not_configured" }
  }

  // Normalize to E.164
  const digits = to.replace(/\D/g, "")
  const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

  if (EXCLUDED_PHONES.has(e164)) {
    console.log(`[sms] Skipping excluded phone: ${e164}`)
    return { success: false, error: "excluded_phone" }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

  const params = new URLSearchParams({
    From: TWILIO_FROM_NUMBER(),
    To: e164,
    Body: body,
  })

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[sms] Twilio error (${res.status}):`, errBody)
      return { success: false, error: `twilio_${res.status}` }
    }

    const data = await res.json()
    console.log(`[sms] Sent to ${e164}: SID=${data.sid}`)
    return { success: true, sid: data.sid }
  } catch (err) {
    console.error("[sms] Send failed:", err)
    return { success: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// Pre-built message templates for lead follow-up cadence
// ---------------------------------------------------------------------------

export function buildWelcomeSms(firstName: string, loanPurpose?: string | null): string {
  const loanDesc = getLoanDescription(loanPurpose)
  return (
    `Hey ${firstName}, it's Riley from Preme \u{1F44B} I'm your loan specialist — just got your ${loanDesc} application and I'm reviewing your file now. I'll give you a call in a couple minutes to go over your deal. Talk soon!\n\n` +
    `Reply STOP to opt out.`
  )
}

export function buildMissedCallSms(firstName: string, loanPurpose?: string | null): string {
  const loanDesc = getLoanDescription(loanPurpose)
  const loanRef = loanPurpose ? ` about your ${loanDesc}` : ""
  return (
    `Hey ${firstName}, it's Riley from Preme. I just tried calling${loanRef}. ` +
    `I've got your file pulled up — call me back at (470) 942-5787 or reply with a good time and I'll reach out then.\n\n` +
    `Reply STOP to opt out.`
  )
}

export function buildSecondMissedCallSms(firstName: string, loanPurpose?: string | null): string {
  const loanDesc = getLoanDescription(loanPurpose)
  return (
    `${firstName}, Riley from Preme again. Tried you twice on your ${loanDesc} — I don't want your file to sit. We can usually get you pre-qualified same day. When works for a quick call? (470) 942-5787\n\n` +
    `Reply STOP to opt out.`
  )
}
