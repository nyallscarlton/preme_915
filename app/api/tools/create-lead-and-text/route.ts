/**
 * Preme Home Loans — Retell Custom Tool: Create Lead & Send Apply Link
 *
 * Called by the voice agent when a new caller is qualified and interested.
 * Creates a draft loan_application and emails a link to review/submit
 * their pre-filled application at premerealestate.com.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/config"
import { sendPremeSms } from "@/lib/preme-sms"

// Internal team numbers used for role-play training — never create leads for these
const TRAINING_PHONES = new Set([
  "+14706225965",
  "+19453088322",
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body
    const call = body.call || {}

    // Clean template variables — Riley sometimes passes {{var}} literals
    const clean = (val: string | undefined): string | undefined => {
      if (!val) return undefined
      if (val.startsWith("{{") && val.endsWith("}}")) return undefined
      return val
    }

    const {
      first_name: rawFirstName,
      last_name: rawLastName,
      email: rawEmail,
      loan_type,
      property_address,
      estimated_amount,
      credit_score,
      property_type,
      entity_type,
      experience_level,
      timeline,
    } = args

    const first_name = clean(rawFirstName)
    const last_name = clean(rawLastName)
    const email = clean(rawEmail)?.includes("@") ? clean(rawEmail) : undefined

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

    // Block training/role-play calls from creating real leads
    const callerPhone = call.from_number || phone
    if (TRAINING_PHONES.has(callerPhone) || TRAINING_PHONES.has(phone)) {
      console.log(`[retell-preme] Training call detected (${callerPhone}) — skipping lead creation`)
      return NextResponse.json({
        result: "Got it! I've noted the details. A loan officer will follow up shortly.",
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
        ? `${getBaseUrl()}/apply?guest=1&token=${token}`
        : `${getBaseUrl()}/apply?guest=1`
      const sent = await sendApplicationLink(email, phone, applyUrl, existing.application_number, first_name)
      if (!sent) {
        return NextResponse.json({
          result: `This caller already has application ${existing.application_number} (status: ${existing.status}). A loan officer will follow up with them directly.`,
        })
      }
      const channels = [sent.email && "email", sent.sms && "text"].filter(Boolean).join(" and ")

      // Log to portal thread
      const e164Existing = digits.startsWith("1") ? `+${digits}` : `+1${digits}`
      const { data: existingLead } = await supabase
        .from("leads").select("id").like("phone", `%${digits}`)
        .order("created_at", { ascending: false }).limit(1).maybeSingle()

      if (existingLead?.id) {
        if (sent.email) {
          await supabase.from("lead_events").insert({
            lead_id: existingLead.id,
            event_type: "app_sent_via_email",
            event_data: { app_number: existing.application_number, email, source: "riley_call" },
          })
        }
        if (sent.sms) {
          await supabase.from("lead_events").insert({
            lead_id: existingLead.id,
            event_type: "app_sent_via_sms",
            event_data: { app_number: existing.application_number, source: "riley_call" },
          })
        }
      }
      if (sent.email) {
        await supabase.from("contact_interactions").insert({
          phone: e164Existing, channel: "email", direction: "outbound",
          content: `Riley sent application ${existing.application_number} via email to ${email || "lead"}`,
          metadata: { type: "application_link", app_number: existing.application_number, source: "riley_call" },
        })
      }
      if (sent.sms) {
        await supabase.from("contact_interactions").insert({
          phone: e164Existing, channel: "sms", direction: "outbound",
          content: `Riley sent application ${existing.application_number} via text`,
          metadata: { type: "application_link", app_number: existing.application_number, source: "riley_call" },
        })
      }

      return NextResponse.json({
        result: `This caller already has application ${existing.application_number} (status: ${existing.status}). I've sent the link via ${channels}.`,
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
      status: "sent",
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

    const applyUrl = `${getBaseUrl()}/apply?guest=1&token=${guestToken}`
    const sent = await sendApplicationLink(email, phone, applyUrl, appNumber, first_name)

    if (!sent) {
      return NextResponse.json({
        result: `Lead created (${appNumber}). I wasn't able to send the link right now — let me have a loan officer send that to you directly. They'll reach out shortly.`,
      })
    }

    const channels = [sent.email && "email", sent.sms && "text"].filter(Boolean).join(" and ")

    // Log events so the portal thread shows what Riley sent
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    // Find the lead ID for this phone number
    const { data: matchedLead } = await supabase
      .from("leads")
      .select("id")
      .like("phone", `%${digits}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const leadId = matchedLead?.id || null

    if (leadId) {
      if (sent.email) {
        await supabase.from("lead_events").insert({
          lead_id: leadId,
          event_type: "app_sent_via_email",
          event_data: { app_number: appNumber, email: email, source: "riley_call" },
        })
      }
      if (sent.sms) {
        await supabase.from("lead_events").insert({
          lead_id: leadId,
          event_type: "app_sent_via_sms",
          event_data: { app_number: appNumber, source: "riley_call" },
        })
      }
    }

    // Store in contact interactions so it shows in the conversation thread
    if (sent.email) {
      await supabase.from("contact_interactions").insert({
        phone: e164,
        channel: "email",
        direction: "outbound",
        content: `Riley sent application ${appNumber} via email to ${email || "lead"}`,
        metadata: { type: "application_link", app_number: appNumber, source: "riley_call" },
      })
    }
    if (sent.sms) {
      await supabase.from("contact_interactions").insert({
        phone: e164,
        channel: "sms",
        direction: "outbound",
        content: `Riley sent application ${appNumber} via text`,
        metadata: { type: "application_link", app_number: appNumber, source: "riley_call" },
      })
    }

    return NextResponse.json({
      result: `Lead created (${appNumber}) and application link sent via ${channels}. Tell the caller to check their ${channels} for the link.`,
    })
  } catch (error) {
    console.error("[retell-preme] create-lead-and-text error:", error)
    return NextResponse.json({
      result: "I've noted this lead for the team. A loan officer will follow up directly.",
    })
  }
}

/**
 * Send the application link via email and SMS.
 * Returns object with email/sms boolean flags, or null if both fail.
 */
async function sendApplicationLink(
  toEmail: string | undefined,
  toPhone: string | undefined,
  applyUrl: string,
  appNumber: string,
  firstName?: string
): Promise<{ email: boolean; sms: boolean } | null> {
  const realEmail = toEmail && !toEmail.endsWith("@placeholder.preme") ? toEmail : null
  const realPhone = toPhone && toPhone.replace(/\D/g, "").length >= 10 ? toPhone : null

  const [emailSent, smsSent] = await Promise.all([
    realEmail ? sendEmail(realEmail, appNumber, applyUrl, firstName) : Promise.resolve(false),
    realPhone ? sendSms(realPhone, applyUrl, firstName) : Promise.resolve(false),
  ])

  if (!emailSent && !smsSent) {
    console.error("[retell-preme] Both email and SMS failed for", appNumber)
    return null
  }

  return { email: emailSent, sms: smsSent }
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
              <img src="https://preme915.vercel.app/PremeLogo_TextWhite_Transparent.png" alt="Preme Home Loans" width="160" style="display: block; margin: 0 auto; max-width: 160px;" />
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

async function sendSms(toPhone: string, applyUrl: string, firstName?: string): Promise<boolean> {
  const name = firstName || "there"
  const body = `Hey ${name}, it's Riley from Preme Home Loans. Your application link is ready — tap here to review and submit: ${applyUrl}\n\nQuestions? Call us at (470) 942-5787.`
  const result = await sendPremeSms({
    toPhone,
    message: body,
    firstName: name,
    source: "create_lead_and_text",
    metadata: { apply_url: applyUrl },
  })
  return result.ok
}
