/**
 * Preme Home Loans — Abandoned Application Follow-Up System
 *
 * Checks for draft applications that were never submitted and sends
 * a sequence of branded follow-up emails to nudge applicants back.
 *
 * Sequence:
 *   1 hour  → gentle nudge ("You're almost there!")
 *   24 hours → urgency + value ("Your pre-qualification is waiting")
 *   72 hours → final reminder with incentive ("Last chance — free consultation")
 */

import { getBaseUrl } from "@/lib/config"
import { createAdminClient } from "@/lib/supabase/admin"

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
  last_followup_at: string | null
  followup_count: number
}

interface FollowUpContent {
  subject: string
  heading: string
  body: string
  ctaLabel: string
}

// ---------------------------------------------------------------------------
// Follow-up email content by sequence step
// ---------------------------------------------------------------------------

function getFollowUpContent(step: 1 | 2 | 3, firstName: string): FollowUpContent {
  switch (step) {
    case 1:
      return {
        subject: "You're Almost There!",
        heading: "You're just a few steps away",
        body: `Hey ${firstName}, we noticed you started a pre-qualification application but didn't finish. No worries — your progress has been saved and you can pick up right where you left off. It only takes a few more minutes to see what you qualify for.`,
        ctaLabel: "Finish My Application",
      }
    case 2:
      return {
        subject: "Your Pre-Qualification Is Waiting",
        heading: "Your pre-qualification is ready when you are",
        body: `${firstName}, your saved application is still here. Rates move fast, and getting pre-qualified now means you'll be ready to move when you find the right home. Our process is quick, secure, and there's no commitment — just clarity on what you can afford.`,
        ctaLabel: "Complete My Pre-Qualification",
      }
    case 3:
      return {
        subject: "Last Chance — Plus a Free Rate Consultation",
        heading: "Before we close your file",
        body: `${firstName}, we're reaching out one last time. Your draft application will remain on file, but we'd hate for you to miss out. As a thank-you for coming back, we're offering a <strong>free personalized rate consultation</strong> with one of our loan officers — no strings attached. Let's find the best path forward for you.`,
        ctaLabel: "Finish & Claim My Free Consultation",
      }
  }
}

// ---------------------------------------------------------------------------
// Determine which follow-up step (if any) an application qualifies for
// ---------------------------------------------------------------------------

function getEligibleStep(app: AbandonedApplication): 1 | 2 | 3 | null {
  const now = Date.now()
  const createdAt = new Date(app.created_at).getTime()
  const ageMs = now - createdAt

  const ONE_HOUR = 60 * 60 * 1000
  const TWENTY_FOUR_HOURS = 24 * ONE_HOUR
  const SEVENTY_TWO_HOURS = 72 * ONE_HOUR

  const count = app.followup_count

  // Step 3: 72h+ since creation, only if steps 1 & 2 already sent
  if (ageMs >= SEVENTY_TWO_HOURS && count === 2) return 3
  // Step 2: 24h+ since creation, only if step 1 already sent
  if (ageMs >= TWENTY_FOUR_HOURS && count === 1) return 2
  // Step 1: 1h+ since creation, no follow-ups sent yet
  if (ageMs >= ONE_HOUR && count === 0) return 1

  return null
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

  // Fetch all draft applications that haven't been submitted and haven't
  // exhausted the 3-step sequence yet.
  const { data: apps, error } = await supabase
    .from("loan_applications")
    .select(
      "id, applicant_email, applicant_name, application_number, guest_token, created_at, last_followup_at, followup_count",
    )
    .eq("status", "draft")
    .is("submitted_at", null)
    .lt("followup_count", 3)

  if (error) {
    console.error("[follow-up] Query error:", error.message)
    return { sent: 0, errors: 1 }
  }

  if (!apps || apps.length === 0) {
    console.log("[follow-up] No eligible abandoned applications found")
    return { sent: 0, errors: 0 }
  }

  for (const app of apps as AbandonedApplication[]) {
    // Skip invalid emails
    if (!app.applicant_email || app.applicant_email.endsWith("@placeholder.preme")) {
      continue
    }

    const step = getEligibleStep(app)
    if (!step) continue

    const firstName = app.applicant_name?.split(" ")[0] || "there"
    const content = getFollowUpContent(step, firstName)

    const base = getBaseUrl()
    const ctaUrl = app.guest_token
      ? `${base}/apply?guest=1&token=${app.guest_token}`
      : `${base}/apply`

    const html = buildFollowUpEmailHtml(content, firstName, app.application_number, ctaUrl)
    const subject = `${content.subject} — ${app.application_number}`

    const ok = await sendFollowUpEmail(app.applicant_email, subject, html)

    if (ok) {
      // Update tracking fields
      const { error: updateError } = await supabase
        .from("loan_applications")
        .update({
          last_followup_at: new Date().toISOString(),
          followup_count: app.followup_count + 1,
        })
        .eq("id", app.id)

      if (updateError) {
        console.error("[follow-up] Failed to update tracking for", app.id, updateError.message)
        errors++
      } else {
        console.log(
          `[follow-up] Step ${step} email sent to ${app.applicant_email} (${app.application_number})`,
        )
        sent++
      }
    } else {
      errors++
    }
  }

  console.log(`[follow-up] Complete: ${sent} sent, ${errors} errors`)
  return { sent, errors }
}
