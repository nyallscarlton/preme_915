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
  loan_amount: "",
  property_address: "",
  application_status: "",
  lead_email: "",
  lead_phone: "",
  lead_message: "",
  lead_source: "",
  conversation_history: "No prior interactions.",
  opening_message: "Hey, thanks for calling Preme Home Loans. This is Riley, how can I help you?",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Retell sends: { event: "call_inbound", call_inbound: { from_number, to_number, agent_id } }
    const callData = body.call_inbound || body
    const callerPhone = callData.from_number || callData.caller_number || body.from_number || ""

    if (!callerPhone) {
      return NextResponse.json({ call_inbound: { dynamic_variables: DEFAULTS } })
    }

    const supabase = createAdminClient()
    const digits = callerPhone.replace(/\D/g, "").slice(-10)

    // Look up existing loan application by phone
    let firstName = ""
    let lastName = ""
    let leadContext = "inbound"
    let loanType = ""
    let loanAmount = ""
    let propertyAddress = ""
    let applicationStatus = ""
    let leadEmail = ""
    let leadPhone = callerPhone
    let leadMessage = ""
    let leadSource = ""

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

    // Look up website form submission (Google Ads leads) by phone
    // This catches people who filled out the form but haven't started an application yet
    if (!app) {
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, first_name, last_name, email, phone, loan_type, loan_amount, message, source, utm_source, utm_medium, utm_campaign, status, created_at")
          .or(`phone.ilike.%${digits}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lead) {
          firstName = lead.first_name || ""
          lastName = lead.last_name || ""
          leadEmail = lead.email || ""
          loanType = lead.loan_type || ""
          loanAmount = lead.loan_amount ? String(lead.loan_amount) : ""
          leadMessage = lead.message || ""
          leadSource = [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(" / ") || lead.source || "website"
          leadContext = "website_form_lead"
        }
      } catch {
        // leads table query failed — non-fatal, continue with other lookups
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

    // Build a natural inbound opener
    let openingMessage: string
    if (leadContext === "existing_applicant" && firstName && firstName !== "there") {
      openingMessage = `Hey ${firstName}, thanks for calling Preme Home Loans. This is Riley — I see you have an application with us. What can I help you with?`
    } else if (leadContext === "website_form_lead" && firstName && firstName !== "there") {
      openingMessage = `Hey ${firstName}, thanks for calling Preme Home Loans. This is Riley — we got your info from our website. Tell me about your deal, how can I help?`
    } else if (leadContext === "callback" && firstName && firstName !== "there") {
      openingMessage = `Hey ${firstName}, thanks for calling back. This is Riley from Preme Home Loans. How can I help?`
    } else {
      openingMessage = `Hey, thanks for calling Preme Home Loans. This is Riley, how can I help you?`
    }

    // Retell expects: { call_inbound: { dynamic_variables: { ... } } }
    return NextResponse.json({
      call_inbound: {
        dynamic_variables: {
          first_name: firstName || "there",
          last_name: lastName,
          lead_context: leadContext,
          loan_type: loanType || "real estate financing",
          loan_amount: loanAmount,
          property_address: propertyAddress,
          application_status: applicationStatus,
          lead_email: leadEmail,
          lead_phone: leadPhone,
          lead_message: leadMessage,
          lead_source: leadSource,
          conversation_history: conversationHistory,
          opening_message: openingMessage,
        },
      },
    })
  } catch (error) {
    console.error("[retell-preme] Inbound context error:", error)
    return NextResponse.json({ call_inbound: { dynamic_variables: DEFAULTS } })
  }
}
