/**
 * Preme Home Loans — Retell Custom Tool: Check Application Status
 *
 * Called by the voice agent mid-conversation when a caller asks
 * "What's the status of my application?" or similar.
 * Looks up by phone number or application number.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, application_number } = body.args || body

    const supabase = createAdminClient()
    let app = null

    // Look up by application number first (most precise)
    if (application_number) {
      const { data } = await supabase
        .from("loan_applications")
        .select("applicant_name, application_number, status, loan_type, property_address, loan_amount, submitted_at, updated_at")
        .eq("application_number", application_number)
        .maybeSingle()
      app = data
    }

    // Fall back to phone lookup
    if (!app && phone) {
      const digits = phone.replace(/\D/g, "").slice(-10)
      const { data } = await supabase
        .from("loan_applications")
        .select("applicant_name, application_number, status, loan_type, property_address, loan_amount, submitted_at, updated_at")
        .or(`applicant_phone.ilike.%${digits}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      app = data
    }

    if (!app) {
      return NextResponse.json({
        result: "No application found. The caller may not have submitted an application yet. Offer to help them get started.",
      })
    }

    const statusMap: Record<string, string> = {
      draft: "We have a draft application started but it hasn't been submitted yet.",
      submitted: "The application has been submitted and is in our queue for review.",
      under_review: "Great news — the application is currently being reviewed by our underwriting team.",
      approved: "The application has been approved! A loan officer will be reaching out with next steps.",
      rejected: "Unfortunately, the application wasn't approved at this time. A loan officer can discuss alternative options.",
      on_hold: "The application is currently on hold. There may be additional documents or information needed.",
    }

    const statusDescription = statusMap[app.status] || `The application status is: ${app.status}.`

    return NextResponse.json({
      result: [
        `Application ${app.application_number}:`,
        statusDescription,
        app.loan_type ? `Loan type: ${app.loan_type}` : null,
        app.property_address ? `Property: ${app.property_address}` : null,
        app.loan_amount ? `Amount: $${Number(app.loan_amount).toLocaleString()}` : null,
        app.updated_at ? `Last updated: ${new Date(app.updated_at).toLocaleDateString()}` : null,
      ].filter(Boolean).join(" "),
    })
  } catch (error) {
    console.error("[retell-preme] check-application-status error:", error)
    return NextResponse.json({
      result: "I'm having trouble looking that up right now. Let me have a loan officer follow up with you directly.",
    })
  }
}
