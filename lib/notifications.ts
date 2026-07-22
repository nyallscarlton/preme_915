/**
 * Preme Home Loans — Borrower Status Change Notifications
 *
 * Sends branded email (via Resend) and Telegram alerts when a
 * loan officer updates an application status.
 */

import { getBaseUrl } from "@/lib/config"
import { toDscrApplication } from "@/lib/dscr-form-map"

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
              <span style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 3px; position: relative; display: inline-block;">PR<span style="position: relative;">E<span style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 16px; height: 4px; background-color: #997100; display: block;"></span></span>ME</span>
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
        tags: [
          { name: "application_number", value: params.applicationNumber },
          { name: "status", value: params.newStatus },
        ],
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
 * Main entry point — sends email notification.
 * Designed to be called fire-and-forget from the PATCH handler.
 */
export async function sendStatusNotification(params: StatusNotificationParams): Promise<void> {
  await sendStatusEmail(params)
}


const PREME_CHANNEL_ID = "C0APBULDQS1"
// .trim() guards against trailing-newline corruption in Vercel env values.
// No hardcoded fallback — GitHub push protection rejects tokens in source,
// and the previous hardcoded token got invalidated exactly that way.
const SLACK_BOT_TOKEN = (process.env.SLACK_BOT_TOKEN || "").trim()

/**
 * Upload a PDF to #preme as an actual Slack file attachment.
 * Requires the files:write scope on the bot token — until that scope is
 * granted this fails fast and the caller falls back to a download button.
 * Returns true when the file landed in the channel.
 */
export async function uploadPdfToPremeChannel(
  pdfUrl: string,
  filename: string,
  title: string
): Promise<boolean> {
  try {
    const pdfRes = await fetch(pdfUrl)
    if (!pdfRes.ok) return false
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())

    const ticketRes = await fetch("https://slack.com/api/files.getUploadURLExternal", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ filename, length: String(pdfBuf.length) }),
    })
    const ticket = await ticketRes.json()
    if (!ticket.ok) return false

    const putRes = await fetch(ticket.upload_url, { method: "POST", body: pdfBuf })
    if (!putRes.ok) return false

    const completeRes = await fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [{ id: ticket.file_id, title }],
        channel_id: PREME_CHANNEL_ID,
      }),
    })
    const complete = await completeRes.json()
    return !!complete.ok
  } catch (err) {
    console.error("[notifications] Slack PDF upload error:", err)
    return false
  }
}

/**
 * Post a quick-apply (pre-qual) alert to #preme with the lender-match result
 * and a link to the review queue. Fires on every pre-qual submission.
 */
export async function notifyPremePreQual(
  app: {
    applicant_name?: string | null
    applicant_phone?: string | null
    applicant_email?: string | null
    property_state?: string | null
    property_type?: string | null
    loan_amount?: number | null
    application_number?: string | null
    id?: string
  },
  match: { qualifiedCount: number; topLender: { name: string | null } | null; reason: string | null }
): Promise<void> {
  const amount = app.loan_amount ? `$${Number(app.loan_amount).toLocaleString("en-US")}` : "N/A"
  const matchLine =
    match.qualifiedCount > 0
      ? `\u{1F3E6} ${match.qualifiedCount} lenders qualified — top: ${match.topLender?.name || "n/a"}`
      : `⚠️ No lender match${match.reason ? ` — ${match.reason}` : ""}`
  const text = [
    `⚡ *New quick apply (pre-qual) — ${app.application_number || "?"}*`,
    `• ${app.applicant_name || "Unknown"} · ${app.applicant_phone || "no phone"} · ${app.applicant_email || "no email"}`,
    `• ${app.property_state || "N/A"}, ${app.property_type || "N/A"} · ${amount}`,
    `• ${matchLine}`,
    `• Review + approve: https://www.premerealestate.com/admin?app=${app.id || ""}`,
  ].join("\n")

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: PREME_CHANNEL_ID, text }),
    })
  } catch (err) {
    console.error("[notifications] Preme pre-qual Slack error:", err)
  }
}

/**
 * Post application submission notification to #preme Slack channel.
 * Also runs DSCR matcher and posts result as follow-up.
 */
export async function notifyPremeAppSubmission(app: {
  applicant_name?: string | null
  applicant_phone?: string | null
  applicant_email?: string | null
  property_state?: string | null
  property_type?: string | null
  loan_amount?: number | null
  loan_type?: string | null
  loan_purpose?: string | null
  credit_score_range?: string | null
  application_number?: string | null
  id?: string
  mismo_xml_url?: string | null
  fnm_url?: string | null
  urla_pdf_url?: string | null
}): Promise<void> {
  const name = app.applicant_name || "Unknown"
  const phone = app.applicant_phone || "none"
  const email = app.applicant_email || "none"
  const state = app.property_state || "N/A"
  const propType = app.property_type || "N/A"
  const amount = app.loan_amount ? `$${Number(app.loan_amount).toLocaleString("en-US")}` : "N/A"
  // www, not app subdomain — app.* rewrites /admin/* into the pipeline UI (404)
  const portalLink = `https://www.premerealestate.com/admin?app=${app.id || ""}`

  const textLines = [
    `\u{1F4CB} *New application submitted*`,
    `\u2022 Name: ${name}`,
    `\u2022 Phone: ${phone}`,
    `\u2022 Email: ${email}`,
    `\u2022 Property: ${state}, ${propType}`,
    `\u2022 Loan amount: ${amount}`,
    `\u2022 App link: ${portalLink}`,
  ]
  if (app.mismo_xml_url || app.urla_pdf_url) {
    const parts: string[] = []
    if (app.mismo_xml_url) parts.push(`<${app.mismo_xml_url}|MISMO XML>`)
    if (app.urla_pdf_url) parts.push(`<${app.urla_pdf_url}|1003 PDF>`)
    if (app.fnm_url) parts.push(`<${app.fnm_url}|FNM>`)
    textLines.push(`\u2022 Downloads: ${parts.join("  ·  ")}`)
  }
  const text = textLines.join("\n")

  try {
    const blocks: unknown[] = [
      { type: "section", text: { type: "mrkdwn", text } },
    ]
    if (app.mismo_xml_url || app.urla_pdf_url) {
      const elements: unknown[] = []
      if (app.urla_pdf_url) {
        elements.push({
          type: "button",
          text: { type: "plain_text", text: "Download 1003 PDF" },
          url: app.urla_pdf_url,
          style: "primary",
        })
      }
      if (app.mismo_xml_url) {
        elements.push({
          type: "button",
          text: { type: "plain_text", text: "Download MISMO XML" },
          url: app.mismo_xml_url,
        })
      }
      if (app.fnm_url) {
        elements.push({ type: "button", text: { type: "plain_text", text: "FNM" }, url: app.fnm_url })
      }
      elements.push({
        type: "button",
        text: { type: "plain_text", text: "Regenerate" },
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.premerealestate.com"}/api/applications/${app.id}/mismo`,
      })
      blocks.push({ type: "actions", elements })
    }

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: PREME_CHANNEL_ID, text, blocks }),
    })
  } catch (err) {
    console.error("[notifications] Preme Slack notification error:", err)
  }

  // Deliver the completed 1003 as an actual file in-channel (needs files:write
  // on the bot token; until granted, the download button above still covers it)
  if (app.urla_pdf_url) {
    await uploadPdfToPremeChannel(
      app.urla_pdf_url,
      `1003-${app.application_number || app.id || "application"}.pdf`,
      `1003 — ${app.applicant_name || "Unknown"} (${app.application_number || ""})`
    )
  }

  // Run DSCR matcher and post result
  try {
    const dscrApp = toDscrApplication(app)
    if (!dscrApp) return

    const matchRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://app.premerealestate.com"}/api/dscr/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application: dscrApp, applicationId: app.id, save: true }),
    })

    if (matchRes.ok) {
      const result = await matchRes.json()
      let matchText: string

      if (result.qualifiedCount > 0) {
        const top = result.qualified?.[0]
        matchText = [
          `\u{1F3E6} *Lender match: ${top?.lender?.name || "Found"}*`,
          `\u2022 Max LTV: ${top?.maxLtv ? (top.maxLtv * 100).toFixed(0) : "N/A"}%`,
          `\u2022 Min FICO: ${top?.lender?.min_fico || "N/A"}`,
          `\u2022 ${result.qualifiedCount} total lenders qualified`,
        ].join("\n")
      } else {
        const reason = result.disqualified?.[0]?.issues?.[0]?.message || "No matching lenders found"
        matchText = `\u26A0\uFE0F *No lender match.* Reason: ${reason}`
      }

      const matchBlocks: unknown[] = [
        { type: "section", text: { type: "mrkdwn", text: matchText } },
      ]
      if (app.mismo_xml_url) {
        matchBlocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Send MISMO to Lender" },
              url: app.mismo_xml_url,
              style: "primary",
            },
          ],
        })
      }

      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: PREME_CHANNEL_ID, text: matchText, blocks: matchBlocks }),
      })
    }
  } catch (err) {
    console.error("[notifications] DSCR matcher error:", err)
  }
}

function parseFicoRange(range: string | null | undefined): number {
  if (!range) return 0
  const match = range.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}
