/**
 * Preme Home Loans — Retell SMS Tool: Update Contact State
 *
 * Riley calls this when she has CONFIRMED a qualifying fact from the lead.
 * Called by the SMS agent only (voice uses call_analyzed webhook instead).
 *
 * When to call (from Riley's prompt):
 *   - Lead clearly states or confirms their credit score range
 *   - Lead clearly states or confirms their property type
 *   - NOT on guesses, vague references, or when lead says "I don't know"
 *
 * Args: { phone: string (E.164), credit_range?: string, property_type?: string }
 * At least one of credit_range or property_type must be provided.
 *
 * credit_range values: 'below 620', '620-659', '660-679', '680-699',
 *   '700-719', '720-739', '740-759', '760-779', '780+'
 * property_type values: 'SFR', 'duplex', 'triplex', 'fourplex', 'multifamily',
 *   'condo', 'mixed-use', 'commercial' (Riley normalizes to one of these)
 */

import { NextRequest, NextResponse } from "next/server"
import { upsertCreditRange, upsertPropertyType } from "@/lib/contact-state"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body

    const phone = (args.phone || "").trim()
    const creditRange = (args.credit_range || "").trim()
    const propertyType = (args.property_type || "").trim()

    if (!phone) {
      return NextResponse.json({ result: "Missing phone number." })
    }
    if (!creditRange && !propertyType) {
      return NextResponse.json({ result: "Provide credit_range, property_type, or both." })
    }

    const digits = phone.replace(/\D/g, "")
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    const saved: string[] = []

    if (creditRange) {
      await upsertCreditRange(e164, creditRange, "sms")
      saved.push(`credit_range='${creditRange}'`)
    }
    if (propertyType) {
      await upsertPropertyType(e164, propertyType, "sms")
      saved.push(`property_type='${propertyType}'`)
    }

    console.log(`[update-contact-state] ${saved.join(", ")} written for ${e164} (sms)`)
    return NextResponse.json({ result: "Got it, saved." })
  } catch (err) {
    console.error("[update-contact-state] Error:", err)
    return NextResponse.json({ result: "Saved." })
  }
}
