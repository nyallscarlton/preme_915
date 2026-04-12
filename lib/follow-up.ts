/**
 * Preme Home Loans — Abandoned Application Follow-Up System
 *
 * Checks for draft applications that were never submitted and sends
 * a sequence of branded follow-up emails to nudge applicants back.
 *
 * Uses time-window detection (no extra DB columns needed):
 *   - Step 1: application is 1–2 hours old
 *   - Step 2: application is 24–25 hours old
 *   - Step 3: application is 72–73 hours old
 *
 * The cron runs every 30 minutes, so each window is hit at least once.
 */

import { getBaseUrl } from "@/lib/config"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLoanDescription, getLoanSellingPoint } from "@/lib/loan-purpose"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AbandonedApplication {
  id: string
  applicant_email: string
  applicant_name: string | null
  application_number: string
  guest_token: string | null
  created_at: string
}

interface FollowUpContent {
  subject: string
  heading: string
  body: string
  ctaLabel: string
}

// ---------------------------------------------------------------------------
// Time windows (ms) — each follow-up is eligible within a 1-hour window
// ---------------------------------------------------------------------------

const ONE_HOUR = 60 * 60 * 1000

const WINDOWS = [
  { step: 1 as const, minAge: 1 * ONE_HOUR, maxAge: 2 * ONE_HOUR },
  { step: 2 as const, minAge: 24 * ONE_HOUR, maxAge: 25 * ONE_HOUR },
  { step: 3 as const, minAge: 72 * ONE_HOUR, maxAge: 73 * ONE_HOUR },
]

// ---------------------------------------------------------------------------
// Follow-up email content by sequence step
// ---------------------------------------------------------------------------

function getFollowUpContent(step: 1 | 2 | 3, firstName: string): FollowUpContent {
  switch (step) {
    case 1:
      return {
        subject: "5 min to your DSCR term sheet",
        heading: "Your DSCR scenario is 5 minutes away",
        body: `${firstName}, you started a pre-qual with Preme but didn't finish. We get it — you're busy closing deals.<br><br>Here's what's waiting on the other side: a same-day pre-qualification based on property cash flow, not your tax returns. No W-2s. No pay stubs. DSCR as low as 0.75. Loans from $50K to $6.25M, closing in as few as 7 days.<br><br>The application takes under 5 minutes. Your progress is saved.`,
        ctaLabel: "Get My DSCR Term Sheet",
      }
    case 2:
      return {
        subject: "Your rate lock window is open",
        heading: "DSCR rates are moving — your numbers are ready",
        body: `${firstName}, since you started your pre-qual, we've funded over $40M in DSCR loans for investors who skipped the tax-return gauntlet. Portfolio builds, short-term rentals, fix-and-flips — all qualified on property cash flow alone.<br><br>Rate environments shift. The spread you'd lock today won't be the spread available next week. Your draft application is still here — finish it now and we'll run a custom DSCR scenario analysis with live rates for your deal.`,
        ctaLabel: "Lock In My Rate Scenario",
      }
    case 3:
      return {
        subject: "Custom DSCR analysis, on us",
        heading: "One asset. One call. Full DSCR breakdown.",
        body: `${firstName}, last note from us. We're offering you a <strong>complimentary DSCR scenario analysis</strong> on any property in your pipeline — purchase, refi, or cash-out. You'll get projected cash flow, rate options, and max leverage in a single call.<br><br>No application needed for the analysis. But if the numbers work, we close in 7–14 days while other lenders are still asking for your 2024 returns. 300+ investors have used this exact process to move faster than the competition.`,
        ctaLabel: "Claim My Free DSCR Analysis",
      }
  }
}

// ---------------------------------------------------------------------------
// Email HTML builder (matches notifications.ts brand template)
// ---------------------------------------------------------------------------

function buildFollowUpEmailHtml(
  content: FollowUpContent,
  firstName: string,
  applicationNumber: string,
  ctaUrl: string,
): string {
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
              <h1 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">${firstName},</h1>

              <h2 style="color: #997100; font-size: 18px; margin: 0 0 16px;">${content.heading}</h2>

              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
                ${content.body}
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}" style="display: inline-block; background-color: #997100; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      ${content.ctaLabel}
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
                You received this because you started a loan application with Preme Home Loans.
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

// ---------------------------------------------------------------------------
// Send a single follow-up email via Resend
// ---------------------------------------------------------------------------

async function sendFollowUpEmail(
  email: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Preme Home Loans <onboarding@resend.dev>"

  if (!apiKey) {
    console.error("[follow-up] RESEND_API_KEY not configured — skipping email")
    return false
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to: email, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[follow-up] Email send failed:", err)
      return false
    }

    return true
  } catch (err) {
    console.error("[follow-up] Email error:", err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Main: check all abandoned applications and send eligible follow-ups
// ---------------------------------------------------------------------------

export async function checkAndSendFollowUps(): Promise<{ sent: number; errors: number }> {
  const supabase = createAdminClient()
  let sent = 0
  let errors = 0

  const now = Date.now()

  for (const window of WINDOWS) {
    // Calculate the created_at range for this window
    const createdBefore = new Date(now - window.minAge).toISOString()
    const createdAfter = new Date(now - window.maxAge).toISOString()

    const { data: apps, error } = await supabase
      .from("loan_applications")
      .select("id, applicant_email, applicant_name, application_number, guest_token, created_at")
      .eq("status", "sent")
      .is("submitted_at", null)
      .gte("created_at", createdAfter)
      .lte("created_at", createdBefore)

    if (error) {
      console.error(`[follow-up] Step ${window.step} query error:`, error.message)
      errors++
      continue
    }

    if (!apps || apps.length === 0) continue

    for (const app of apps as AbandonedApplication[]) {
      if (!app.applicant_email || app.applicant_email.endsWith("@placeholder.preme")) {
        continue
      }

      const firstName = app.applicant_name?.split(" ")[0] || "there"
      const content = getFollowUpContent(window.step, firstName)

      const base = getBaseUrl()
      const ctaUrl = app.guest_token
        ? `${base}/apply?guest=1&token=${app.guest_token}`
        : `${base}/apply`

      const html = buildFollowUpEmailHtml(content, firstName, app.application_number, ctaUrl)
      const subject = content.subject

      const ok = await sendFollowUpEmail(app.applicant_email, subject, html)

      if (ok) {
        console.log(
          `[follow-up] Step ${window.step} email sent to ${app.applicant_email} (${app.application_number})`,
        )
        sent++
      } else {
        errors++
      }
    }
  }

  console.log(`[follow-up] Complete: ${sent} sent, ${errors} errors`)
  return { sent, errors }
}

// ---------------------------------------------------------------------------
// Application Path Emails (Path 1 cadence)
// ---------------------------------------------------------------------------

interface ApplicationEmailParams {
  email: string
  firstName: string
  applicationNumber: string
  loanAmount?: string | number | null
  propertyAddress?: string | null
  propertyType?: string | null
  loanPurpose?: string | null
  creditScore?: string | null
  guestToken?: string | null
}

/**
 * Immediate confirmation email when an application is submitted (Path 1, +0 sec).
 */
export async function sendApplicationConfirmationEmail(params: ApplicationEmailParams): Promise<boolean> {
  const loanDesc = getLoanDescription(params.loanPurpose)
  const sellingPoint = getLoanSellingPoint(params.loanPurpose)
  const base = getBaseUrl()
  const ctaUrl = params.guestToken
    ? `${base}/apply?guest=1&token=${params.guestToken}`
    : `${base}/apply`
  const amount = params.loanAmount
    ? `$${Number(params.loanAmount).toLocaleString("en-US")}`
    : "To be confirmed"
  const property = params.propertyAddress || params.propertyType || "To be confirmed"
  const credit = params.creditScore || "To be confirmed"
  const purposeDisplay = loanDesc.charAt(0).toUpperCase() + loanDesc.slice(1)

  const subject = `${params.firstName}, your ${loanDesc} file is open`

  const html = buildBrandedEmailHtml({
    firstName: params.firstName,
    heading: "Your file is open",
    body: `Your application just landed on my desk. I'm Riley, your loan specialist at Preme — I'll be handling your file personally.<br><br>
Here's what's happening right now:<br><br>
<strong>1.</strong> I'm reviewing your ${loanDesc} details as we speak.<br>
<strong>2.</strong> I'll give you a call in the next few minutes to confirm your deal and talk numbers.<br>
<strong>3.</strong> If everything checks out, we'll have a term sheet in your hands within 24 hours.<br><br>
<table width="100%" cellpadding="8" cellspacing="0" style="background-color:#f8f8f8; border-radius:8px; margin-bottom:16px;">
<tr><td style="color:#666; font-size:13px; padding:12px 16px;">
<strong style="color:#1a1a1a;">YOUR APPLICATION</strong><br>
Reference: ${params.applicationNumber}<br>
Loan Amount: ${amount}<br>
Property: ${property}<br>
Purpose: ${purposeDisplay}<br>
Credit Range: ${credit}
</td></tr>
</table>
${sellingPoint}<br><br>
Expect my call shortly. If you'd rather reach out first, reply to this email or text me at (470) 942-5787.<br><br>
— Riley<br>
Loan Specialist, Preme Home Loans`,
    ctaLabel: "Track My Application",
    ctaUrl,
    applicationNumber: params.applicationNumber,
    signoff: false,
  })

  return sendFollowUpEmail(params.email, subject, html)
}

/**
 * Day 1 follow-up email (+24 hours, Path 1 & Path 2).
 */
export async function sendDay1FollowUpEmail(params: {
  email: string
  firstName: string
  loanPurpose?: string | null
}): Promise<boolean> {
  const loanDesc = getLoanDescription(params.loanPurpose)
  const sellingPoint = getLoanSellingPoint(params.loanPurpose)

  const subject = `${params.firstName}, your ${loanDesc} — next steps`

  const html = buildBrandedEmailHtml({
    firstName: params.firstName,
    heading: `Your ${loanDesc} — next steps`,
    body: `It's Riley from Preme. I've been working your ${loanDesc} file and wanted to follow up.<br><br>
Here's where things stand:<br><br>
\u2192 Your application is in our system and assigned to me<br>
\u2192 I need a 5-minute call to confirm your deal details and run live numbers<br>
\u2192 Once confirmed, I'll have a term sheet in your hands — most investors see theirs within 24 hours<br><br>
<strong>WHAT I NEED FROM YOU</strong><br>
One phone call. That's it. No documents yet — just confirm the property details and your timeline. I handle the rest.<br><br>
Call or text me at (470) 942-5787, or just reply to this email with a good time.<br><br>
— Riley<br>
Loan Specialist, Preme Home Loans<br><br>
P.S. ${sellingPoint}`,
    ctaLabel: "Call Riley — (470) 942-5787",
    ctaUrl: "tel:+14709425787",
    signoff: false,
  })

  return sendFollowUpEmail(params.email, subject, html)
}

/**
 * Day 3 follow-up email (+72 hours, Path 1 & Path 2).
 */
export async function sendDay3FollowUpEmail(params: {
  email: string
  firstName: string
  loanPurpose?: string | null
}): Promise<boolean> {
  const loanDesc = getLoanDescription(params.loanPurpose)

  const subject = `${params.firstName} — free ${loanDesc} analysis, on us`

  const html = buildBrandedEmailHtml({
    firstName: params.firstName,
    heading: `Free ${loanDesc} analysis, on us`,
    body: `Last note from me. I know you're weighing options, so here's what I'll do:<br><br>
I'll run a <strong>complimentary scenario analysis</strong> on your ${loanDesc} deal. You'll get:<br><br>
\u2022 Projected numbers at current rates<br>
\u2022 Max leverage and reserve requirements<br>
\u2022 Rate comparison across our lender network<br>
\u2022 Realistic timeline to close<br><br>
No commitment. No hard credit pull. If the numbers don't work, I'll tell you straight.<br><br>
If they do — we can have this funded in 7–14 days.<br><br>
Reply "ANALYZE" or call me at (470) 942-5787.<br><br>
— Riley<br>
Loan Specialist, Preme Home Loans`,
    ctaLabel: "Get My Free Analysis",
    ctaUrl: "tel:+14709425787",
    signoff: false,
  })

  return sendFollowUpEmail(params.email, subject, html)
}

/**
 * Post-cadence follow-up email (Path 2, +120 min, lead form leads only).
 * Replaces the old generic follow-up email in the cron handler.
 */
export async function sendPostCadenceEmail(params: {
  email: string
  firstName: string
  loanPurpose?: string | null
}): Promise<boolean> {
  const loanDesc = getLoanDescription(params.loanPurpose)
  const sellingPoint = getLoanSellingPoint(params.loanPurpose)
  const base = getBaseUrl()
  const applyUrl = `${base}/apply`

  const subject = `${params.firstName}, your pre-qualification is waiting`

  const html = buildBrandedEmailHtml({
    firstName: params.firstName,
    heading: "Your pre-qualification is waiting",
    body: `It's Riley from Preme. I tried reaching you a couple of times about your ${loanDesc} but couldn't connect — no worries, I know you're busy.<br><br>
Whenever you're ready, you can start your pre-qualification online. Takes under 5 minutes, and I'll follow up with personalized options within 24 hours.<br><br>
${sellingPoint}<br><br>
Or just call/text me directly: (470) 942-5787<br><br>
— Riley<br>
Loan Specialist, Preme Home Loans`,
    ctaLabel: "Start My Pre-Qualification",
    ctaUrl: applyUrl,
    signoff: false,
  })

  return sendFollowUpEmail(params.email, subject, html)
}

// ---------------------------------------------------------------------------
// Shared branded email builder for all follow-up paths
// ---------------------------------------------------------------------------

function buildBrandedEmailHtml(params: {
  firstName: string
  heading: string
  body: string
  ctaLabel: string
  ctaUrl: string
  applicationNumber?: string
  signoff?: boolean
}): string {
  const refLine = params.applicationNumber
    ? `<p style="color: #888; font-size: 13px; text-align: center; margin: 20px 0 0;">Ref: ${params.applicationNumber}</p>`
    : ""

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
              <h1 style="color: #1a1a1a; font-size: 22px; margin: 0 0 16px;">${params.firstName},</h1>
              <h2 style="color: #997100; font-size: 18px; margin: 0 0 16px;">${params.heading}</h2>
              <p style="color: #444; font-size: 16px; line-height: 1.7; margin: 0 0 28px;">
                ${params.body}
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${params.ctaUrl}" style="display: inline-block; background-color: #997100; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                      ${params.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
              ${refLine}
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
