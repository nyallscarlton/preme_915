/**
 * Preme Home Loans — Retell Inbound Context Webhook
 *
 * Fires BEFORE an inbound call starts. Looks up the caller by phone,
 * pulls application status + conversation history, and injects dynamic
 * variables so the agent knows who they are.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const DEFAULTS = {
  first_name: "there",
  last_name: "",
  lead_context: "inbound",
  loan_type: "real estate financing",
  property_address: "",
  application_status: "",
  conversation_history: "No prior interactions.",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const callerPhone = body.from_number || body.caller_number || ""

    if (!callerPhone) {
      return NextResponse.json(DEFAULTS)
    }

    const supabase = createAdminClient()
    const digits = callerPhone.replace(/\D/g, "").slice(-10)

    // Look up existing loan application by phone
    let firstName = ""
    let lastName = ""
    let leadContext = "inbound"
    let loanType = ""
    let propertyAddress = ""
    let applicationStatus = ""

    const { data: app } = await supabase
      .from("loan_applications")
      .select("id, applicant_name, applicant_phone, status, loan_type, property_address, application_number")
      .or(`applicant_phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (app) {
      const nameParts = (app.applicant_name || "").split(" ")
      firstName = nameParts[0] || ""
      lastName = nameParts.slice(1).join(" ") || ""
      loanType = app.loan_type || ""
      propertyAddress = app.property_address || ""
      applicationStatus = app.status || ""

      // Determine context from application status
      if (["submitted", "under_review", "approved"].includes(app.status)) {
        leadContext = "existing_applicant"
      } else if (app.status === "draft") {
        leadContext = "incomplete_application"
      }
    }

    // Build conversation history from zx_contact_interactions
    let conversationHistory = "No prior interactions."
    try {
      const { data: interactions } = await supabase
        .from("zx_contact_interactions")
        .select("channel, direction, summary, created_at")
        .ilike("phone", `%${digits}%`)
        .eq("entity", "preme")
        .order("created_at", { ascending: false })
        .limit(5)

      if (interactions && interactions.length > 0) {
        const lines = interactions.map((i) => {
          const date = new Date(i.created_at).toLocaleDateString()
          const dir = i.direction === "inbound" ? "Caller" : "Preme"
          return `[${date}] ${i.channel} (${dir}): ${i.summary || "No summary"}`
        })
        conversationHistory = lines.join("\n")

        // If they've talked before, this is a callback
        if (leadContext === "inbound") {
          leadContext = "callback"
        }
      }
    } catch {
      // zx_contact_interactions may not exist yet — non-fatal
    }

    return NextResponse.json({
      first_name: firstName || "there",
      last_name: lastName,
      lead_context: leadContext,
      loan_type: loanType || "real estate financing",
      property_address: propertyAddress,
      application_status: applicationStatus,
      conversation_history: conversationHistory,
    })
  } catch (error) {
    console.error("[retell-preme] Inbound context error:", error)
    return NextResponse.json(DEFAULTS)
  }
}
