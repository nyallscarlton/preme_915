import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { storeInteraction } from "@/lib/memory"
import Retell from "retell-sdk"

/**
 * GET /api/cron/app-followup
 * Checks for applications that haven't been opened, started but not submitted,
 * or submitted — and sends appropriate follow-up texts.
 *
 * Runs every 5 minutes via Vercel cron + crontab backup.
 */

const PREME_URL = "https://premerealestate.com"

interface FollowUpRule {
  condition: string
  delayMinutes: number
  message: (name: string, appUrl: string) => string
  eventType: string
}

const RULES: FollowUpRule[] = [
  // Email bounced or not delivered after 5 min — send link via text
  {
    condition: "email_bounced_5min",
    delayMinutes: 5,
    message: (name, url) =>
      `Hey ${name}, this is Riley from Preme Home Loans. Looks like the email might not have gone through, so here is your application link directly: ${url}`,
    eventType: "app_followup_email_bounced",
  },
  // App not opened after 10 min — nudge with direct link
  {
    condition: "not_opened_10min",
    delayMinutes: 10,
    message: (name, url) =>
      `${name}, just sent your pre-filled application to your email. If you didn't get it, you can fill it out right here: ${url}`,
    eventType: "app_followup_not_opened_10min",
  },
  // App not opened after 1 hour — second nudge
  {
    condition: "not_opened_1hr",
    delayMinutes: 60,
    message: (name, url) =>
      `Hey ${name}, following up on your Preme Home Loans application. Everything is pre-filled, just need you to review and hit submit: ${url}`,
    eventType: "app_followup_not_opened_1hr",
  },
  // App not opened after 24 hours
  {
    condition: "not_opened_24hr",
    delayMinutes: 1440,
    message: (name, url) =>
      `${name}, your loan application is still waiting for you. Takes about 3 minutes to finish: ${url}`,
    eventType: "app_followup_not_opened_24hr",
  },
  // App opened but not submitted — 10 min
  {
    condition: "opened_not_submitted_10min",
    delayMinutes: 10,
    message: (name, _url) =>
      `${name}, saw you opened the application. Need help with any of the fields? I can walk you through it right now.`,
    eventType: "app_followup_opened_10min",
  },
  // App opened but not submitted — 4 hours
  {
    condition: "opened_not_submitted_4hr",
    delayMinutes: 240,
    message: (name, _url) =>
      `${name}, your application is saved where you left off. Want me to have our loan officer help you finish it over the phone? Takes about 5 min.`,
    eventType: "app_followup_opened_4hr",
  },
  // App opened but not submitted — 24 hours
  {
    condition: "opened_not_submitted_24hr",
    delayMinutes: 1440,
    message: (name, url) =>
      `${name}, still have your application saved. You can pick back up anytime: ${url}`,
    eventType: "app_followup_opened_24hr",
  },
]

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  let sent = 0
  let errors = 0
  const errorDetails: string[] = []

  // Check quiet hours (8 AM - 9 PM ET)
  const now = new Date()
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const hour = et.getHours()
  if (hour < 8 || hour >= 21) {
    return NextResponse.json({ success: true, sent: 0, skipped: "quiet_hours" })
  }

  // Get all applications that need follow-up
  const { data: apps } = await supabase
    .from("loan_applications")
    .select("id, application_number, guest_token, applicant_name, applicant_phone, applicant_email, status, first_opened_at, submitted_at, created_at, lead_id")
    .in("status", ["sent", "opened", "submitted"])
    .not("guest_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(100)

  if (!apps || apps.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: "no applications" })
  }

  for (const app of apps) {
    if (!app.applicant_phone || !app.guest_token) continue

    const phone = app.applicant_phone.replace(/\D/g, "")
    const e164 = phone.startsWith("1") ? `+${phone}` : `+1${phone}`
    const firstName = app.applicant_name?.split(" ")[0] || "there"
    const appUrl = `${PREME_URL}/apply?guest=1&token=${app.guest_token}`
    const createdAt = new Date(app.created_at).getTime()
    const nowMs = Date.now()
    const minutesSinceCreated = (nowMs - createdAt) / 60000

    // Check if app was submitted — send confirmation
    if (app.status === "submitted" && app.submitted_at) {
      const alreadySent = await hasEvent(supabase, app.lead_id, "app_submitted_confirmation", e164)
      if (!alreadySent) {
        try {
          await sendRetellSms(e164, `${firstName}, we got your application! Our team is reviewing it now and will reach out within a few hours.`)
          await logEvent(supabase, app.lead_id, "app_submitted_confirmation", e164)
          sent++
        } catch (err: any) {
          errorDetails.push(`${app.applicant_name} (${e164}): ${err?.message || String(err)}`)
          errors++
        }
      }
      continue
    }

    // Check for email bounce
    let emailBounced = false
    if (app.applicant_email && app.application_number) {
      const { data: bounceEvents } = await supabase
        .from("email_events")
        .select("id")
        .eq("application_number", app.application_number)
        .eq("event_type", "email.bounced")
        .limit(1)
      emailBounced = (bounceEvents?.length ?? 0) > 0
    }

    // Process follow-up rules
    for (const rule of RULES) {
      if (minutesSinceCreated < rule.delayMinutes) continue

      if (rule.condition === "email_bounced_5min" && !emailBounced) continue
      if (rule.condition.startsWith("not_opened") && app.first_opened_at) continue
      if (rule.condition.startsWith("opened_not_submitted") && !app.first_opened_at) continue
      if (rule.condition.startsWith("opened_not_submitted") && app.submitted_at) continue

      const alreadySent = await hasEvent(supabase, app.lead_id, rule.eventType, e164)
      if (alreadySent) continue

      try {
        const message = rule.message(firstName, appUrl)
        await sendRetellSms(e164, message)
        // Log the event IMMEDIATELY after send — this prevents re-sends on next cron
        await logEvent(supabase, app.lead_id, rule.eventType, e164)
        sent++
        // Non-critical: store interaction for memory (fire-and-forget)
        storeInteraction(e164, {
          channel: "sms",
          direction: "outbound",
          content: message,
          metadata: { type: "app_followup", rule: rule.condition },
        }).catch(() => {})
      } catch (err: any) {
        errorDetails.push(`${app.applicant_name} (${e164}) [${rule.condition}]: ${err?.message || String(err)}`)
        errors++
      }

      // Only send one follow-up per app per cron run
      break
    }
  }

  return NextResponse.json({ success: true, sent, errors, errorDetails: errorDetails.length > 0 ? errorDetails : undefined })
}

async function hasEvent(supabase: ReturnType<typeof createAdminClient>, leadId: string | null, eventType: string, phone?: string): Promise<boolean> {
  // Primary dedup: lead_events by lead_id
  if (leadId) {
    const { data } = await supabase
      .from("lead_events")
      .select("id")
      .eq("lead_id", leadId)
      .eq("event_type", eventType)
      .limit(1)
    if ((data?.length ?? 0) > 0) return true
  }
  // Fallback dedup when lead_id is null: check contact_interactions by phone
  if (phone) {
    const digits = phone.replace(/\D/g, "").slice(-10)
    const { data } = await supabase
      .from("contact_interactions")
      .select("id")
      .ilike("phone", `%${digits}`)
      .eq("channel", "sms")
      .ilike("content", `%${eventType}%`)
      .limit(1)
    if ((data?.length ?? 0) > 0) return true
  }
  return false
}

async function logEvent(supabase: ReturnType<typeof createAdminClient>, leadId: string | null, eventType: string, phone: string) {
  if (leadId) {
    await supabase.from("lead_events").insert({
      lead_id: leadId,
      event_type: eventType,
      event_data: { phone, sent_at: new Date().toISOString() },
    })
  }
  // Also log to contact_interactions so phone-based dedup works when lead_id is null
  await supabase.from("contact_interactions").insert({
    phone,
    channel: "sms",
    direction: "outbound",
    content: eventType,
    metadata: { source: "app_followup_cron", sent_at: new Date().toISOString() },
  }).catch(() => {})
}

async function sendRetellSms(to: string, message: string) {
  const client = new Retell({ apiKey: process.env.RETELL_API_KEY! })
  await client.chat.createSMSChat({
    from_number: "+14709425787", // Preme's Retell number — hardcoded per policy
    to_number: to,
    retell_llm_dynamic_variables: { initial_message: message },
    metadata: { source: "app_followup_cron" },
  })
}
