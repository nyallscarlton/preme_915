/**
 * Preme Home Loans — Retell Custom Tool: Update Lead Info
 *
 * Riley calls this mid-conversation when a caller corrects or provides
 * new contact info — name, email, phone, address, loan details, etc.
 * Updates both the leads table and loan_applications if one exists.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  upsertCreditRange, upsertPropertyType, upsertLoanPurpose,
  upsertLoanType, upsertPropertyAddress, upsertLoanAmount,
  upsertTimeline, upsertName, upsertEmail,
} from "@/lib/contact-state"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body

    // The caller's phone is the lookup key — Riley always has this
    const phone = args.phone || ""
    if (!phone) {
      return NextResponse.json({ result: "Missing phone number. Cannot look up lead." })
    }

    const digits = phone.replace(/\D/g, "").slice(-10)
    if (digits.length < 10) {
      return NextResponse.json({ result: "Invalid phone number." })
    }

    const supabase = createAdminClient()
    const updated: string[] = []

    // --- Update leads table ---
    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name, last_name, email, phone, loan_type, loan_amount, message")
      .or(`phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lead) {
      const leadUpdates: Record<string, unknown> = {}

      if (args.first_name) leadUpdates.first_name = args.first_name
      if (args.last_name) leadUpdates.last_name = args.last_name
      if (args.email) leadUpdates.email = args.email.toLowerCase()
      if (args.new_phone) leadUpdates.phone = args.new_phone
      // loan_type, loan_amount, property_address columns do not exist on leads — routed through gateways below

      if (Object.keys(leadUpdates).length > 0) {
        leadUpdates.updated_at = new Date().toISOString()
        await supabase.from("leads").update(leadUpdates).eq("id", lead.id)
        updated.push(`lead record: ${Object.keys(leadUpdates).filter(k => k !== "updated_at").join(", ")}`)
      }
    }

    // --- Update loan_applications table if one exists ---
    const { data: app } = await supabase
      .from("loan_applications")
      .select("id, applicant_name, applicant_phone, applicant_email, loan_type, property_address, loan_amount")
      .or(`applicant_phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (app) {
      const appUpdates: Record<string, unknown> = {}

      if (args.loan_purpose) appUpdates.loan_purpose = args.loan_purpose
      if (args.property_type) appUpdates.property_type = args.property_type
      if (args.new_phone) appUpdates.applicant_phone = args.new_phone
      // name, email, loan_type, loan_amount, property_address are handled by gateways below

      if (Object.keys(appUpdates).length > 0) {
        await supabase.from("loan_applications").update(appUpdates).eq("id", app.id)
        updated.push(`application: ${Object.keys(appUpdates).join(", ")}`)
      }
    }

    // Write qualifying facts to contact_state (M1-M4 gateways)
    if (digits.length === 10) {
      const e164 = `+1${digits}`
      if (args.credit_range) { upsertCreditRange(e164, args.credit_range, "voice").catch(() => {}); updated.push("contact_state: credit_range") }
      if (args.property_type) { upsertPropertyType(e164, args.property_type, "voice").catch(() => {}); updated.push("contact_state: property_type") }
      if (args.loan_purpose) { upsertLoanPurpose(e164, args.loan_purpose, "voice").catch(() => {}); updated.push("contact_state: loan_purpose") }
      if (args.loan_type) { upsertLoanType(e164, args.loan_type, "voice").catch(() => {}); updated.push("contact_state: loan_type") }
      if (args.property_address) { upsertPropertyAddress(e164, args.property_address, "voice").catch(() => {}); updated.push("contact_state: property_address") }
      if (args.loan_amount) { const amt = parseFloat(String(args.loan_amount).replace(/[^0-9.]/g, "")); if (!isNaN(amt)) { upsertLoanAmount(e164, amt, "voice").catch(() => {}); updated.push("contact_state: loan_amount") } }
      if (args.timeline) { upsertTimeline(e164, args.timeline, "voice").catch(() => {}); updated.push("contact_state: timeline") }
      if (args.first_name || args.last_name) { upsertName(e164, args.first_name || "", args.last_name || "", "voice").catch(() => {}); updated.push("contact_state: name") }
      if (args.email && !String(args.email).includes("@placeholder.preme")) { upsertEmail(e164, args.email, "voice").catch(() => {}); updated.push("contact_state: email") }
    }

    if (updated.length === 0) {
      return NextResponse.json({ result: "No records found for this phone number to update." })
    }

    return NextResponse.json({
      result: `Updated ${updated.join(" and ")}. Information is now current.`,
    })
  } catch (error) {
    console.error("[update-lead-info] Error:", error)
    return NextResponse.json({ result: "Failed to update lead information." })
  }
}
