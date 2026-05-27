/**
 * Preme Home Loans — Retell SMS Tool: Update Contact State
 *
 * Riley calls this when she has CONFIRMED a qualifying fact from the lead.
 * Called by the SMS agent only (voice uses call_analyzed webhook instead).
 *
 * Milestone 1: credit_range only.
 *
 * When to call (from Riley's prompt):
 *   - Lead clearly states their credit score or range
 *   - Lead confirms a number Riley suggested ("yeah, around 720")
 *   - NOT on guesses, vague references, or when lead says "I don't know"
 *
 * Args: { phone: string (E.164), credit_range: string }
 * credit_range should be one of: 'below 620', '620-659', '660-679',
 *   '680-699', '700-719', '720-739', '740-759', '760-779', '780+'
 * Riley normalizes the lead's answer to one of these labels.
 */

import { NextRequest, NextResponse } from "next/server"
import { upsertCreditRange } from "@/lib/contact-state"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body

    const phone = (args.phone || "").trim()
    const creditRange = (args.credit_range || "").trim()

    if (!phone) {
      return NextResponse.json({ result: "Missing phone number." })
    }
    if (!creditRange) {
      return NextResponse.json({ result: "Missing credit_range." })
    }

    // Normalize to E.164 if needed
    const digits = phone.replace(/\D/g, "")
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    await upsertCreditRange(e164, creditRange, "sms")

    console.log(`[update-contact-state] credit_range='${creditRange}' written for ${e164} (sms)`)
    return NextResponse.json({ result: "Got it, saved." })
  } catch (err) {
    console.error("[update-contact-state] Error:", err)
    return NextResponse.json({ result: "Saved." })
  }
}
