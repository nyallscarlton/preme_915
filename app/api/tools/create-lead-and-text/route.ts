/**
 * Preme Home Loans — Retell Custom Tool: Create Lead & Send Apply Link
 *
 * Called by the voice agent when a new caller is qualified and interested.
 * Creates a draft loan_application and emails a link to review/submit
 * their pre-filled application at premerealestate.com.
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
      .select("id, application_number, status, guest_token")
      .or(`applicant_phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      const token = existing.guest_token
      const applyUrl = token
        ? `https://preme915.vercel.app/apply?guest=1&token=${token}`
        : `https://preme915.vercel.app/apply?guest=1`
      const sent = await sendApplicationLink(email, applyUrl, existing.application_number, first_name)
      return NextResponse.json({
        result: sent === "email"
          ? `This caller already has application ${existing.application_number} (status: ${existing.status}). I've emailed them a link to continue their application.`
          : `This caller already has application ${existing.application_number} (status: ${existing.status}). A loan officer will follow up with them.`,
      })
    }

    // Create new draft application
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown"
    const appNumber = `PREME-${Date.now().toString(36).toUpperCase()}`
    const guestToken = crypto.randomUUID()

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
      guest_token: guestToken,
    })

    if (error) {
      console.error("[retell-preme] create-lead insert error:", error)
      return NextResponse.json({
        result: "I created a note for the team but had trouble generating the application link. A loan officer will follow up directly.",
      })
    }

    const applyUrl = `https://preme915.vercel.app/apply?guest=1&token=${guestToken}`
    const sent = await sendApplicationLink(email, applyUrl, appNumber, first_name)

    return NextResponse.json({
      result: sent === "email"
        ? `Lead created (${appNumber}) and application link emailed to ${email}. Tell the caller to check their email for the application link.`
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
 * Send the application link via email.
 * Returns "email" on success, null on failure.
 * TODO: Re-enable SMS once Twilio toll-free/10DLC verification clears.
 */
async function sendApplicationLink(
  toEmail: string | undefined,
  applyUrl: string,
  appNumber: string,
  firstName?: string
): Promise<"email" | null> {
  const realEmail = toEmail && !toEmail.endsWith("@placeholder.preme") ? toEmail : null
  if (realEmail) {
    const emailSent = await sendEmail(realEmail, appNumber, applyUrl, firstName)
    if (emailSent) return "email"
  }

  console.error("[retell-preme] Email failed or no email provided for", appNumber)
  return null
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
              <span style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 3px;">PREME</span>
              <span style="color: #997100; font-size: 14px; display: block; margin-top: 4px; letter-spacing: 1px;">HOME LOANS</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">Hey ${name}!</h1>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">
                Great speaking with you. Based on our conversation, we've put together a pre-filled application with the details you shared — loan type, property info, and credit range are already in there.
              </p>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
                All you need to do is review everything, make any changes, and submit. Takes about 2 minutes.
              </p>

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
                You received this because you spoke with our team about a loan. No further emails will be sent unless you opt in.
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
      console.error("[retell-preme] Email failed:", err)
      return false
    }
    return true
  } catch (err) {
    console.error("[retell-preme] Email error:", err)
    return false
  }
}
