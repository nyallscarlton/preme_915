/**
 * POST /api/leads/[id]/send-application
 *
 * Creates a pre-filled draft loan application from lead data and sends
 * the guest link via SMS or email.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/config"
import { sendPremeSms } from "@/lib/preme-sms"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      phone,
      loan_type,
      loan_purpose,
      loan_amount,
      property_address,
      property_type,
      property_value,
      credit_score_range,
      borrower_note,
      delivery_method, // "sms" or "email"
    } = body

    if (!delivery_method || !["sms", "email"].includes(delivery_method)) {
      return NextResponse.json(
        { error: "delivery_method must be 'sms' or 'email'" },
        { status: 400 }
      )
    }

    if (delivery_method === "sms" && !phone) {
      return NextResponse.json(
        { error: "Phone number required for SMS delivery" },
        { status: 400 }
      )
    }

    if (delivery_method === "email" && !email) {
      return NextResponse.json(
        { error: "Email address required for email delivery" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify lead exists
    const { data: lead, error: leadError } = await adminClient
      .from("leads")
      .select("id")
      .eq("id", params.id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Generate application identifiers
    const appNumber = `PREME-${Date.now().toString(36).toUpperCase()}`
    const guestToken = crypto.randomUUID()
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown"

    // Create the draft loan application
    const { data: application, error: insertError } = await adminClient
      .from("loan_applications")
      .insert({
        applicant_name: fullName,
        applicant_email: email || null,
        applicant_phone: phone || null,
        application_number: appNumber,
        status: "draft",
        loan_type: loan_type || null,
        loan_purpose: loan_purpose || null,
        loan_amount: loan_amount ? parseFloat(String(loan_amount).replace(/[^0-9.]/g, "")) : null,
        property_address: property_address || null,
        property_type: property_type || null,
        property_value: property_value ? parseFloat(String(property_value).replace(/[^0-9.]/g, "")) : null,
        credit_score_range: credit_score_range || null,
        is_guest: true,
        guest_token: guestToken,
        lead_id: params.id,
        sent_via: delivery_method,
        sent_at: new Date().toISOString(),
        borrower_note: borrower_note || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[send-application] Insert error:", insertError)
      return NextResponse.json({ error: "Failed to create application" }, { status: 500 })
    }

    const applyUrl = `${getBaseUrl()}/apply?guest=1&token=${guestToken}`

    // Send via chosen method
    let deliverySuccess = false
    let deliveryError: string | null = null

    if (delivery_method === "sms") {
      const noteClause = borrower_note ? ` Note from your loan officer: "${borrower_note}"` : ""
      const smsBody =
        `Hey ${first_name || "there"}, here's your pre-filled loan application from Preme Home Loans. ` +
        `Review and submit when ready: ${applyUrl}${noteClause} ` +
        `-- Reply STOP to opt out`

      const result = await sendPremeSms({
        toPhone: phone,
        message: smsBody,
        firstName: first_name || undefined,
        source: "send_application",
      })
      deliverySuccess = result.ok
      if (!result.ok) deliveryError = result.error || "SMS send failed"
    } else {
      // Email via Resend
      const sent = await sendApplicationEmail(email, applyUrl, appNumber, first_name, borrower_note)
      deliverySuccess = sent
      if (!sent) deliveryError = "Email send failed"
    }

    // Update lead status to nurturing
    await adminClient
      .from("leads")
      .update({
        status: "nurturing",
        updated_at: new Date().toISOString(),
        qualification_data: {
          application_sent_at: new Date().toISOString(),
          application_sent_via: delivery_method,
          application_number: appNumber,
          application_id: application.id,
        },
      })
      .eq("id", params.id)

    return NextResponse.json({
      success: true,
      application_number: appNumber,
      application_url: applyUrl,
      delivery_method,
      delivery_success: deliverySuccess,
      delivery_error: deliveryError,
      guest_token: guestToken,
    })
  } catch (error) {
    console.error("[send-application] API error:", error)
    return NextResponse.json({ error: "Failed to send application" }, { status: 500 })
  }
}

async function sendApplicationEmail(
  toEmail: string,
  applyUrl: string,
  appNumber: string,
  firstName?: string,
  borrowerNote?: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    console.error("[send-application] Resend not configured")
    return false
  }

  const name = firstName || "there"
  const noteBlock = borrowerNote
    ? `
              <div style="background-color: #fffdf5; border-left: 4px solid #997100; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #666; font-size: 12px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px;">Message from your loan officer</p>
                <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0; font-style: italic;">"${borrowerNote}"</p>
              </div>`
    : ""

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
        subject: `${name === "there" ? "Your" : name + ","} Your Preme Home Loans Application is Ready`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #0a0a0a; padding: 28px 40px; text-align: center;">
              <span style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 3px; position: relative; display: inline-block;">PR<span style="position: relative;">E<span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 16px; height: 4px; background-color: #997100; display: block;"></span></span>ME</span>
              <span style="color: #997100; font-size: 14px; display: block; margin-top: 4px; letter-spacing: 1px;">HOME LOANS</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">Hey ${name}!</h1>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">
                We've put together a pre-filled loan application with the details you shared -- loan type, property info, and credit range are already in there.
              </p>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
                All you need to do is review everything, make any changes, and submit. Takes about 2 minutes.
              </p>

              ${noteBlock}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${applyUrl}" style="display: inline-block; background-color: #997100; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      Open My Application
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #888; font-size: 13px; text-align: center; margin: 20px 0 0;">
                Ref: ${appNumber}
              </p>
            </td>
          </tr>

          <!-- What's Next -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafafa; border-radius: 8px; border: 1px solid #eee;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #1a1a1a; font-size: 14px; font-weight: 600; margin: 0 0 12px;">What happens next?</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #997100; font-size: 14px; padding: 3px 10px 3px 0; vertical-align: top;">1.</td>
                        <td style="color: #555; font-size: 14px; padding: 3px 0;">Review your pre-filled application</td>
                      </tr>
                      <tr>
                        <td style="color: #997100; font-size: 14px; padding: 3px 10px 3px 0; vertical-align: top;">2.</td>
                        <td style="color: #555; font-size: 14px; padding: 3px 0;">Edit any details and submit</td>
                      </tr>
                      <tr>
                        <td style="color: #997100; font-size: 14px; padding: 3px 10px 3px 0; vertical-align: top;">3.</td>
                        <td style="color: #555; font-size: 14px; padding: 3px 0;">A loan officer will call you today to discuss next steps</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
                Preme Home Loans | (470) 942-5787 | premerealestate.com
              </p>
              <p style="color: #bbb; font-size: 11px; margin: 8px 0 0; text-align: center;">
                You received this because you inquired about a loan. No further emails will be sent unless you opt in.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[send-application] Email failed:", err)
      return false
    }
    return true
  } catch (err) {
    console.error("[send-application] Email error:", err)
    return false
  }
}
