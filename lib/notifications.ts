/**
 * Preme Home Loans — Borrower Status Change Notifications
 *
 * Sends branded email (via Resend) and Telegram alerts when a
 * loan officer updates an application status.
 */

import { getBaseUrl } from "@/lib/config"

interface StatusNotificationParams {
  email: string
  name: string
  applicationNumber: string
  oldStatus: string
  newStatus: string
  guestToken?: string
}

const STATUS_CONTENT: Record<string, { subject: string; heading: string; body: string }> = {
  under_review: {
    subject: "Your Application Is Under Review",
    heading: "We're reviewing your application",
    body: "Your application is being reviewed by our team. We'll be in touch soon with an update. No action is needed on your end right now.",
  },
  approved: {
    subject: "Congratulations — Your Loan Has Been Approved!",
    heading: "Your loan has been approved!",
    body: "Great news — your loan application has been approved. Log in to your dashboard to view the details and next steps.",
  },
  rejected: {
    subject: "Update on Your Loan Application",
    heading: "An update on your application",
    body: "After careful review, we're unable to move forward with your application at this time. This doesn't have to be the end of the road — please give us a call at (470) 942-5787 so we can discuss your options.",
  },
  funded: {
    subject: "Your Loan Has Been Funded!",
    heading: "Your loan has been funded!",
    body: "Congratulations — your loan has officially been funded. Thank you for choosing Preme Home Loans. If you have any questions, don't hesitate to reach out.",
  },
}

function getStatusContent(status: string) {
  if (STATUS_CONTENT[status]) return STATUS_CONTENT[status]
  const display = status.replace(/_/g, " ")
  return {
    subject: "Your Application Status Has Been Updated",
    heading: "Your application status has changed",
    body: `Your application status has been updated to <strong>${display}</strong>. If you have any questions, please don't hesitate to contact us.`,
  }
}

function buildCtaUrl(guestToken?: string): string {
  const base = getBaseUrl()
  if (guestToken) return `${base}/apply?guest=1&token=${guestToken}`
  return `${base}/apply`
}

function buildEmailHtml(params: StatusNotificationParams): string {
  const { name, applicationNumber, newStatus, guestToken } = params
  const content = getStatusContent(newStatus)
  const ctaUrl = buildCtaUrl(guestToken)
  const ctaLabel = newStatus === "approved" ? "View My Dashboard" : "View My Application"
  const firstName = name?.split(" ")[0] || "there"

  return `<!DOCTYPE html>
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
              <h1 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">Hey ${firstName}!</h1>

              <h2 style="color: #997100; font-size: 18px; margin: 0 0 16px;">${content.heading}</h2>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
                ${content.body}
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display: inline-block; background-color: #997100; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #888; font-size: 13px; text-align: center; margin: 20px 0 0;">
                Ref: ${applicationNumber}
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
                You received this because you have a loan application with Preme Home Loans.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send a branded status-change email to the borrower via Resend.
 */
async function sendStatusEmail(params: StatusNotificationParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Preme Home Loans <onboarding@resend.dev>"

  if (!apiKey) {
    console.error("[notifications] RESEND_API_KEY not configured — skipping email")
    return false
  }

  if (!params.email || params.email.endsWith("@placeholder.preme")) {
    console.warn("[notifications] No valid email for", params.applicationNumber)
    return false
  }

  const content = getStatusContent(params.newStatus)

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.email,
        subject: `${content.subject} — ${params.applicationNumber}`,
        html: buildEmailHtml(params),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[notifications] Email send failed:", err)
      return false
    }

    console.log("[notifications] Status email sent to", params.email, "for", params.applicationNumber)
    return true
  } catch (err) {
    console.error("[notifications] Email error:", err)
    return false
  }
}

/**
 * Send a Telegram alert for high-priority status changes (approved/funded).
 */
async function sendStatusTelegram(params: StatusNotificationParams): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  const emoji = params.newStatus === "approved" ? "\u2705" : params.newStatus === "funded" ? "\uD83D\uDCB0" : "\uD83D\uDCCB"

  const lines = [
    `${emoji} *LOAN STATUS UPDATE*`,
    ``,
    `*${params.applicationNumber}*`,
    `Borrower: ${params.name || "Unknown"}`,
    `Status: ${params.oldStatus.replace(/_/g, " ")} → *${params.newStatus.replace(/_/g, " ")}*`,
  ]

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    })
  } catch (err) {
    console.error("[notifications] Telegram error:", err)
  }
}

/**
 * Main entry point — sends email notification (always) and Telegram (for approved/funded).
 * Designed to be called fire-and-forget from the PATCH handler.
 */
export async function sendStatusNotification(params: StatusNotificationParams): Promise<void> {
  const promises: Promise<unknown>[] = [sendStatusEmail(params)]

  if (["approved", "funded"].includes(params.newStatus)) {
    promises.push(sendStatusTelegram(params))
  }

  await Promise.allSettled(promises)
}
