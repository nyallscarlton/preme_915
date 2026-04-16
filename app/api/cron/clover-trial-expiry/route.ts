import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { logExecution } from "@/lib/clover-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 90

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ""
async function slackPost(channel: string, text: string) {
  if (!SLACK_BOT_TOKEN) return
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  }).catch(() => {})
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!process.env.RESEND_API_KEY) return
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CLOVER_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "Clover AI <onboarding@resend.dev>",
      to: [to], subject, text: body,
    }),
  }).catch(() => {})
}

export async function GET(_req: NextRequest) {
  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clover" } }
  )

  const { data: bots } = await c.from("trial_bots").select("*, leads(email, first_name, company_name, calendly_event_url)")
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString())
    .limit(50)

  if (!bots?.length) return NextResponse.json({ ok: true, processed: 0 })

  const calendly = "https://calendly.com/cloveraiagency/30min"
  let processed = 0

  for (const bot of bots as any[]) {
    const lead = bot.leads
    if (!lead?.email) { processed++; continue }

    if (bot.trial_type === "custom") {
      const calls = bot.calls_received || 0
      if (calls > 0) {
        await sendEmail(lead.email,
          "Your trial is wrapping up",
          `Hey ${lead.first_name || "there"}, your trial showed ${calls} calls over 7 days. Ready to make it permanent?\n\n${calendly}\n\nOr want to try a 48-hour live trial with real customer calls? Reply "LIVE TRIAL" and I'll set it up.\n\n— Nyalls`)
        await c.from("leads").update({ status: "live_trial_offered" }).eq("id", bot.lead_id)
      } else {
        await sendEmail(lead.email,
          "Your trial bot is still waiting",
          `Hey ${lead.first_name || "there"}, your custom AI receptionist is still ready to try. Want me to extend it a few more days?\n\n${calendly}\n\n— Nyalls`)
        await c.from("leads").update({ status: "nurture" }).eq("id", bot.lead_id)
      }
      await c.from("trial_bots").update({ status: "expired" }).eq("id", bot.id)
    } else if (bot.trial_type === "live_48hr") {
      const calls = bot.calls_received || 0
      const appts = bot.appointments_booked || 0
      const minutes = Math.round((bot.total_call_duration_seconds || 0) / 60)
      const report = {
        total_calls: calls,
        avg_duration_seconds: calls > 0 ? Math.round((bot.total_call_duration_seconds || 0) / calls) : 0,
        appointments_booked: appts,
        total_minutes: minutes,
      }
      await c.from("trial_bots").update({ status: "expired", engagement_report: report }).eq("id", bot.id)

      const receptionistCost = Math.round(minutes * 0.25) // $15/hr ≈ $0.25/min
      await sendEmail(lead.email,
        `Your 48-Hour Results: ${calls} calls, ${appts} appointments`,
        `Hey ${lead.first_name || "there"},\n\nHere's what happened over 48 hours:\n\n` +
        `• Total calls: ${calls}\n• Appointments booked: ${appts}\n• Total talk time: ${minutes} minutes\n\n` +
        `At $15/hr for a receptionist, that's about $${receptionistCost} you would have spent. Our Tier 1 plan is $997/month and covers unlimited calls.\n\n` +
        `Book a time to talk: ${calendly}\n\n— Nyalls`)
      await c.from("leads").update({
        status: "call_booked",
        live_trial_report_sent: true,
        live_trial_calls_received: calls,
        live_trial_appointments_booked: appts,
      }).eq("id", bot.lead_id)
      await slackPost("#clover",
        `📊 Live trial complete: *${bot.business_name}*\n` +
        `• ${calls} calls | ${appts} appts | ${minutes}min total\n` +
        `• Report sent. Closing opportunity.`)
    }
    processed++
  }

  await logExecution("clover-trial-expiry", "clover", "completed", { processed })
  return NextResponse.json({ ok: true, processed })
}
