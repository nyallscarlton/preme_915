/**
 * Preme Home Loans — Retell SMS Tool: Update Contact State
 *
 * Riley calls this when she has CONFIRMED a qualifying fact from the lead.
 * Called by the SMS agent only (voice uses call_analyzed webhook instead).
 *
 * When to call (from Riley's prompt):
 *   - Lead clearly states or confirms any qualifying fact
 *   - NOT on guesses, vague references, or when lead says "I don't know"
 *
 * Args: { phone: string (E.164), plus any of the qualifying facts below }
 * At least one qualifying fact must be provided.
 */

import { NextRequest, NextResponse } from "next/server"
import {
  upsertCreditRange, upsertPropertyType, upsertLoanPurpose,
  upsertLoanType, upsertPropertyAddress, upsertLoanAmount,
  upsertTimeline, upsertName, upsertEmail,
} from "@/lib/contact-state"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body

    const phone = (args.phone || "").trim()
    if (!phone) {
      return NextResponse.json({ result: "Missing phone number." })
    }

    const creditRange = (args.credit_range || "").trim()
    const propertyType = (args.property_type || "").trim()
    const loanPurpose = (args.loan_purpose || "").trim()
    const loanType = (args.loan_type || "").trim()
    const propertyAddress = (args.property_address || "").trim()
    const loanAmount = args.loan_amount
    const timeline = (args.timeline || "").trim()
    const firstName = (args.first_name || "").trim()
    const lastName = (args.last_name || "").trim()
    const email = (args.email || "").trim()

    if (!creditRange && !propertyType && !loanPurpose && !loanType &&
        !propertyAddress && !loanAmount && !timeline && !firstName && !lastName && !email) {
      return NextResponse.json({ result: "Provide at least one qualifying fact to save." })
    }

    const digits = phone.replace(/\D/g, "")
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    const saved: string[] = []

    if (creditRange) { await upsertCreditRange(e164, creditRange, "sms"); saved.push(`credit_range='${creditRange}'`) }
    if (propertyType) { await upsertPropertyType(e164, propertyType, "sms"); saved.push(`property_type='${propertyType}'`) }
    if (loanPurpose) { await upsertLoanPurpose(e164, loanPurpose, "sms"); saved.push(`loan_purpose='${loanPurpose}'`) }
    if (loanType) { await upsertLoanType(e164, loanType, "sms"); saved.push(`loan_type='${loanType}'`) }
    if (propertyAddress) { await upsertPropertyAddress(e164, propertyAddress, "sms"); saved.push(`property_address`) }
    if (loanAmount) {
      const amt = parseFloat(String(loanAmount).replace(/[^0-9.]/g, ""))
      if (!isNaN(amt)) { await upsertLoanAmount(e164, amt, "sms"); saved.push(`loan_amount=${amt}`) }
    }
    if (timeline) { await upsertTimeline(e164, timeline, "sms"); saved.push(`timeline='${timeline}'`) }
    if (firstName || lastName) { await upsertName(e164, firstName, lastName, "sms"); saved.push(`name`) }
    if (email && !email.includes("@placeholder.preme")) { await upsertEmail(e164, email, "sms"); saved.push(`email`) }

    console.log(`[update-contact-state] ${saved.join(", ")} written for ${e164} (sms)`)
    return NextResponse.json({ result: "Got it, saved." })
  } catch (err) {
    console.error("[update-contact-state] Error:", err)
    return NextResponse.json({ result: "Saved." })
  }
}
