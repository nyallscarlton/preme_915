import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Look up guest applications by email
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("id, guest_token, status, application_number")
      .eq("applicant_email", email)
      .eq("is_guest", true)
      .order("created_at", { ascending: false })

    if (error || !applications || applications.length === 0) {
      return NextResponse.json(
        { error: "No guest applications found for this email address" },
        { status: 404 }
      )
    }

    // Use the most recent application's guest token
    const latestApp = applications[0]

    if (!latestApp.guest_token) {
      return NextResponse.json(
        { error: "No guest access token found for this application" },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const magicLinkUrl = `${baseUrl}/guest-dashboard?token=${latestApp.guest_token}`

    // Send magic link email via Resend
    const emailSent = await sendMagicLinkEmail(email, magicLinkUrl)

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Magic link sent successfully. Check your email."
        : "Magic link generated but email could not be sent.",
      emailSent,
      magicLink: magicLinkUrl, // Keep for testing
    })
  } catch (error) {
    console.error("Error sending magic link:", error)
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
  }
}

async function sendMagicLinkEmail(
  toEmail: string,
  magicLinkUrl: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ||
    "Preme Home Loans <onboarding@resend.dev>"

  if (!apiKey) {
    console.error("[magic-link] RESEND_API_KEY not configured — skipping email")
    return false
  }

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
        subject: "Your Preme Home Loans Application Link",
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
              <h1 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">Your Secure Application Link</h1>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">
                Here's your secure link to access your loan application. Click below to check your status, upload documents, or continue your application.
              </p>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
                This link is unique to you — no password needed.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${magicLinkUrl}" style="display: inline-block; background-color: #997100; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      Access My Application
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #888; font-size: 13px; text-align: center; margin: 20px 0 0;">
                If the button doesn't work, copy and paste this URL into your browser:<br>
                <a href="${magicLinkUrl}" style="color: #997100; word-break: break-all;">${magicLinkUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 24px 40px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
                Preme Home Loans | (470) 942-5787 | premerealestate.com
              </p>
              <p style="color: #bbb; font-size: 11px; margin: 8px 0 0; text-align: center;">
                You received this because you requested access to your loan application. Do not share this link — it provides direct access to your application.
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
      console.error("[magic-link] Email send failed:", err)
      return false
    }
    return true
  } catch (err) {
    console.error("[magic-link] Email error:", err)
    return false
  }
}
