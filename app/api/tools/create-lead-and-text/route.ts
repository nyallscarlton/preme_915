/**
 * Preme Home Loans — Retell Custom Tool: Create Lead & Text Apply Link
 *
 * Called by the voice agent when a new caller is qualified and interested.
 * Creates a draft loan_application and sends an SMS with a link to
 * complete their application at premerealestate.com/apply.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body
    const call = body.call || {}

    const {
      first_name,
      last_name,
      email,
      loan_type,
      property_address,
      estimated_amount,
      credit_score,
      property_type,
      entity_type,
      experience_level,
      timeline,
    } = args

    // Get phone from: args, or Retell call metadata (inbound=from_number, outbound=to_number)
    const phone = args.phone && args.phone.length > 5
      ? args.phone
      : call.direction === "outbound"
        ? call.to_number
        : call.from_number || call.to_number || args.phone

    if (!phone || phone.length < 6) {
      return NextResponse.json({
        result: "I couldn't determine the caller's phone number. A loan officer will follow up manually.",
      })
    }

    const supabase = createAdminClient()
    const digits = phone.replace(/\D/g, "").slice(-10)

    // Check for existing application
    const { data: existing } = await supabase
      .from("loan_applications")
      .select("id, application_number, status")
      .or(`applicant_phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Already have an application — just send the link
      const sent = await sendApplicationLink(phone, email, existing.application_number, first_name)
      return NextResponse.json({
        result: sent === "sms"
          ? `This caller already has application ${existing.application_number} (status: ${existing.status}). I've texted them a link to continue their application.`
          : sent === "email"
            ? `This caller already has application ${existing.application_number} (status: ${existing.status}). I've emailed them a link to continue their application.`
            : `This caller already has application ${existing.application_number} (status: ${existing.status}). A loan officer will follow up with them.`,
      })
    }

    // Create new draft application
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown"
    const appNumber = `PREME-${Date.now().toString(36).toUpperCase()}`

    const { error } = await supabase.from("loan_applications").insert({
      applicant_name: fullName,
      applicant_phone: phone,
      applicant_email: email || `${digits}@placeholder.preme`,
      application_number: appNumber,
      status: "draft",
      loan_type: loan_type || null,
      loan_purpose: loan_type || null,
      property_address: property_address || null,
      property_type: property_type || null,
      loan_amount: estimated_amount ? parseFloat(String(estimated_amount).replace(/[^0-9.]/g, "")) : null,
      credit_score_range: credit_score || null,
      is_guest: true,
      guest_token: crypto.randomUUID(),
    })

    if (error) {
      console.error("[retell-preme] create-lead insert error:", error)
      return NextResponse.json({
        result: "I created a note for the team but had trouble generating the application link. A loan officer will follow up directly.",
      })
    }

    // Send application link via SMS (with email fallback)
    const sent = await sendApplicationLink(phone, email, appNumber, first_name)

    return NextResponse.json({
      result: sent === "sms"
        ? `Lead created (${appNumber}) and application link texted to ${phone}. Tell the caller to check their texts for the pre-filled application link.`
        : sent === "email"
          ? `Lead created (${appNumber}) and application link emailed to ${email}. Tell the caller to check their email for the pre-filled application link.`
          : `Lead created (${appNumber}). I wasn't able to send the link right now, but a loan officer will follow up with the application link shortly.`,
    })
  } catch (error) {
    console.error("[retell-preme] create-lead-and-text error:", error)
    return NextResponse.json({
      result: "I've noted this lead for the team. A loan officer will follow up directly.",
    })
  }
}

/**
 * Try SMS first. If it fails (unverified number, etc.), fall back to email.
 * Returns "sms", "email", or null if both fail.
 */
async function sendApplicationLink(
  toPhone: string,
  toEmail: string | undefined,
  appNumber: string,
  firstName?: string
): Promise<"sms" | "email" | null> {
  const applyUrl = `https://premerealestate.com/apply?guest=1&ref=${appNumber}`
  const greeting = firstName ? `Hey ${firstName}!` : "Hey!"

  // Try SMS first
  const smsSent = await trySMS(toPhone, `${greeting} Here's your pre-filled application from Preme Home Loans. Just review, edit if needed, and submit: ${applyUrl}`)
  if (smsSent) return "sms"

  // Fall back to email
  const realEmail = toEmail && !toEmail.endsWith("@placeholder.preme") ? toEmail : null
  if (realEmail) {
    const emailSent = await sendEmail(realEmail, appNumber, applyUrl, firstName)
    if (emailSent) return "email"
  }

  console.error("[retell-preme] Both SMS and email failed for", appNumber)
  return null
}

async function trySMS(toPhone: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) return false

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toPhone,
        Body: message,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error("[retell-preme] SMS failed:", err.code, err.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[retell-preme] SMS error:", err)
    return false
  }
}

async function sendEmail(
  toEmail: string,
  appNumber: string,
  applyUrl: string,
  firstName?: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    console.error("[retell-preme] Resend not configured — skipping email")
    return false
  }

  const name = firstName || "there"

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmail,
        subject: "Your Preme Home Loans Application",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a;">Hey ${name}!</h2>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Thanks for speaking with us at Preme Home Loans. We've put together your
              pre-filled application based on what you shared on the call.
            </p>
            <p style="font-size: 16px; color: #333; line-height: 1.6;">
              Just review the details, make any edits, and hit submit:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${applyUrl}"
                 style="background-color: #997100; color: white; padding: 14px 32px;
                        text-decoration: none; border-radius: 6px; font-size: 16px;
                        font-weight: bold;">
                Review &amp; Submit Application
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">
              Application reference: ${appNumber}
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">
              Preme Home Loans | premerealestate.com
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[retell-preme] Email failed:", err)
      return false
    }
    return true
  } catch (err) {
    console.error("[retell-preme] Email error:", err)
    return false
  }
}
