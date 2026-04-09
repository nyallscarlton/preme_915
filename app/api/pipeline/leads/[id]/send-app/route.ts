import { NextRequest, NextResponse } from "next/server"
import { createZentrxClient } from "@/lib/supabase/admin"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { storeInteraction } from "@/lib/memory"
import crypto from "crypto"
import Retell from "retell-sdk"

// loan_applications lives in the `preme` schema, not `zentryx`
function createPremeClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" } }
  )
}

const PREME_BASE_URL = "https://premerealestate.com"

/**
 * POST /api/pipeline/leads/[id]/send-app
 * Creates a pre-filled draft application and returns the link.
 * Sends via SMS (Retell), email (Resend), or both.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createZentrxClient()
  const preme = createPremeClient()
  const body = await request.json()
  const { sendViaSms, sendViaEmail } = body

  // Get lead data
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  const cf = (lead.custom_fields || {}) as Record<string, unknown>

  // Check if this lead already has a draft application
  const phoneDigits = (lead.phone || "").replace(/\D/g, "").slice(-10)
  const orFilter = lead.email
    ? `applicant_phone.like.%${phoneDigits},applicant_email.eq.${lead.email}`
    : `applicant_phone.like.%${phoneDigits}`
  const { data: existingApp } = await preme
    .from("loan_applications")
    .select("id, guest_token, application_number, status")
    .or(orFilter)
    .eq("is_guest", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let guestToken: string
  let appNumber: string
  let appUrl: string

  if (existingApp?.guest_token) {
    guestToken = existingApp.guest_token
    appNumber = existingApp.application_number
    appUrl = `${PREME_BASE_URL}/apply?guest=1&token=${guestToken}`
  } else {
    guestToken = crypto.randomUUID()
    const prefix = "PREME"
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase()
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 6)
    appNumber = `${prefix}-${rand}-${suffix}`

    const fullName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
    const e164Phone = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`

    const loanType = (cf.loan_type as string) || null
    const propertyType = (cf.property_type as string) || null
    const propertyAddress = (cf.property_address as string) || null
    const estimatedAmount = cf.estimated_loan_amount || cf.estimated_value || null
    const creditScore = (cf.credit_score_range as string) || null

    const { error: insertErr } = await preme.from("loan_applications").insert({
      applicant_name: fullName,
      applicant_phone: e164Phone,
      applicant_email: lead.email || `${phoneDigits}@placeholder.preme`,
      application_number: appNumber,
      status: "draft",
      loan_type: loanType,
      loan_purpose: loanType,
      property_address: propertyAddress,
      property_type: propertyType,
      loan_amount: estimatedAmount ? parseFloat(String(estimatedAmount).replace(/[^0-9.]/g, "")) : null,
      credit_score_range: creditScore,
      is_guest: true,
      guest_token: guestToken,
      lead_id: lead.id,
    })

    if (insertErr) {
      console.error("[send-app] Insert error:", insertErr)
      return NextResponse.json({ error: "Failed to create application" }, { status: 500 })
    }

    appUrl = `${PREME_BASE_URL}/apply?guest=1&token=${guestToken}`
  }

  const e164 = phoneDigits.startsWith("1") ? `+${phoneDigits}` : `+1${phoneDigits}`
  const firstName = lead.first_name || "there"
  let smsSent = false
  let emailSent = false
  let smsError = ""
  let emailError = ""

  // Send via SMS using Retell (A2P approved)
  if (sendViaSms) {
    const smsMessage = `Hey ${firstName}, here's your pre-filled application for Preme Home Loans. Just fill in what's missing and submit: ${appUrl}`

    try {
      const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! })
      const chat = await retell.chat.createSMSChat({
        from_number: process.env.RETELL_SMS_NUMBER || process.env.RETELL_PHONE_NUMBER || "+14709425787",
        to_number: e164,
        retell_llm_dynamic_variables: {
          initial_message: smsMessage,
        },
        metadata: {
          lead_id: params.id,
          type: "application_link",
          app_number: appNumber,
        },
      })

      await storeInteraction(e164, {
        channel: "sms",
        direction: "outbound",
        content: smsMessage,
        metadata: { type: "application_link", app_number: appNumber, retell_chat_id: chat.chat_id },
      })

      smsSent = true
    } catch (smsErr) {
      smsError = String(smsErr).slice(0, 120)
      console.error("[send-app] SMS error:", smsErr)
    }

    // Log event with error reason
    await supabase.from("lead_events").insert({
      lead_id: params.id,
      event_type: smsSent ? "app_sent_via_sms" : "app_sms_failed",
      event_data: { app_number: appNumber, app_url: appUrl, sent: smsSent, error: smsError || null },
    })
  }

  // Send via email using Resend
  if (sendViaEmail && lead.email && !lead.email.includes("@placeholder")) {
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E3A5F; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Preme Home Loans</h1>
          <p style="color: #F59E0B; margin: 4px 0 0; font-size: 13px;">NMLS# 2560616</p>
        </div>
        <div style="padding: 32px 24px; background: white; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px; color: #1f2937;">Hey ${firstName},</p>
          <p style="font-size: 15px; color: #374151; line-height: 1.6;">
            Your pre-filled loan application is ready. Most of your info is already filled in — just review, complete what's missing, and submit.
          </p>
          <p style="font-size: 15px; color: #374151; line-height: 1.6;">
            Takes about 5-10 minutes. No documents needed to submit.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${appUrl}" style="background: #1E3A5F; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
              Complete Your Application
            </a>
          </div>
          <p style="font-size: 13px; color: #9ca3af; text-align: center;">
            Application #${appNumber}
          </p>
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 13px; color: #6b7280; margin: 0;">
            Questions? Call us at <a href="tel:+14709425787" style="color: #1E3A5F;">(470) 942-5787</a> or reply to this email.
          </p>
          <p style="font-size: 11px; color: #9ca3af; margin: 8px 0 0;">
            Preme Home Loans | NMLS# 2560616 | Equal Housing Lender
          </p>
        </div>
      </div>
    `

    try {
      const resendKey = process.env.RESEND_API_KEY
      const fromEmail = "Preme Home Loans <noreply@premerealestate.com>"

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [lead.email],
          subject: `${firstName}, Your Preme Home Loans Application is Ready`,
          html: emailHtml,
        }),
      })

      const result = await res.json()

      if (res.ok && result.id) {
        await storeInteraction(e164, {
          channel: "email",
          direction: "outbound",
          content: `Application link sent via email to ${lead.email}`,
          metadata: { type: "application_link", app_number: appNumber, resend_id: result.id },
        })
        emailSent = true
      } else {
        emailError = result.message || result.name || `Resend returned ${res.status}`
        console.error("[send-app] Email API error:", emailError, result)
      }
    } catch (emailErr) {
      emailError = String(emailErr).slice(0, 120)
      console.error("[send-app] Email error:", emailErr)
    }

    // Log event with error reason
    await supabase.from("lead_events").insert({
      lead_id: params.id,
      event_type: emailSent ? "app_sent_via_email" : "app_email_failed",
      event_data: { app_number: appNumber, app_url: appUrl, email: lead.email, sent: emailSent, error: emailError || null },
    })
  }

  // Log the generation event
  await supabase.from("lead_events").insert({
    lead_id: params.id,
    event_type: "application_link_generated",
    event_data: {
      app_number: appNumber,
      app_url: appUrl,
      guest_token: guestToken,
      sent_via_sms: smsSent,
      sent_via_email: emailSent,
    },
  })

  // Update lead status
  await supabase
    .from("leads")
    .update({ status: "application" })
    .eq("id", params.id)

  return NextResponse.json({
    success: true,
    appUrl,
    appNumber,
    guestToken,
    smsSent,
    emailSent,
    smsError: smsError || null,
    emailError: emailError || null,
  })
}
