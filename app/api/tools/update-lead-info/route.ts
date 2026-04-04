/**
 * Preme Home Loans — Retell Custom Tool: Update Lead Info
 *
 * Riley calls this mid-conversation when a caller corrects or provides
 * new contact info — name, email, phone, address, loan details, etc.
 * Updates both the leads table and loan_applications if one exists.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
      if (args.loan_type) leadUpdates.loan_type = args.loan_type
      if (args.loan_amount) leadUpdates.loan_amount = args.loan_amount
      if (args.property_address) leadUpdates.property_address = args.property_address
      if (args.new_phone) leadUpdates.phone = args.new_phone

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

      if (args.first_name || args.last_name) {
        const newFirst = args.first_name || app.applicant_name?.split(" ")[0] || ""
        const newLast = args.last_name || app.applicant_name?.split(" ").slice(1).join(" ") || ""
        appUpdates.applicant_name = `${newFirst} ${newLast}`.trim()
      }
      if (args.email) appUpdates.applicant_email = args.email.toLowerCase()
      if (args.loan_type) appUpdates.loan_type = args.loan_type
      if (args.property_address) appUpdates.property_address = args.property_address
      if (args.loan_amount) {
        const parsed = parseFloat(String(args.loan_amount).replace(/[^0-9.]/g, ""))
        if (!isNaN(parsed)) appUpdates.loan_amount = parsed
      }
      if (args.new_phone) appUpdates.applicant_phone = args.new_phone

      if (Object.keys(appUpdates).length > 0) {
        await supabase.from("loan_applications").update(appUpdates).eq("id", app.id)
        updated.push(`application: ${Object.keys(appUpdates).join(", ")}`)
      }
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
