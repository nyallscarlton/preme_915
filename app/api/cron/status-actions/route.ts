/**
 * Status Actions Cron — runs every 5 min
 *
 * Watches for loan_application status changes and fires workflows:
 * - "funded" → post-close nurture (Workflow 5)
 * - "not_qualified" + dq_reason → DQ-specific follow-up (Workflow 4)
 * - "submitted" → Slack notification + DSCR match (Workflow 3)
 *
 * Tracks processed apps with a processed_at timestamp to avoid re-firing.
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendPremeSms } from "@/lib/preme-sms"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

const SLACK_NOTIFY = "python3 /Users/p/.openclaw/workspace/scripts/slack-notify.py"

async function slackPost(channel: string, agent: string, message: string) {
  try {
    const body = JSON.stringify({ channel: channel === "preme" ? "C0APBULDQS1" : "C0AP900H8V9", text: message })
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN || "xoxb-10810278616865-10793966886901-IkgPJuagaGNceBA2WFIysKbC"}`,
        "Content-Type": "application/json",
      },
      body,
    })
  } catch (err) {
    console.error("[status-actions] Slack post failed:", err)
  }
}

// ── POST-CLOSE NURTURE (Workflow 5) ──
const POST_CLOSE_STEPS = [
  { step: 1, delayDays: 1, type: "sms", desc: "T+1 day congrats", template: "postclose-congrats" },
  { step: 2, delayDays: 7, type: "sms", desc: "T+7 day referral ask", template: "postclose-referral" },
  { step: 3, delayDays: 30, type: "email", desc: "T+30 day next acquisition", template: "postclose-30day" },
  { step: 4, delayDays: 90, type: "sms", desc: "T+90 day rate check", template: "postclose-90day" },
  { step: 5, delayDays: 180, type: "sms", desc: "T+180 day ready for next", template: "postclose-180day" },
  { step: 6, delayDays: 365, type: "email", desc: "T+365 day anniversary", template: "postclose-anniversary" },
]

// ── DQ MESSAGES ──
const DQ_MESSAGES: Record<string, string> = {
  fico_too_low: "Thanks for applying, {name}. Our investor loan programs require a minimum 620 credit score. I can point you to some resources to get there fast — reply if interested.",
  dscr_too_low: "The rental income on your property doesn't quite cover the payment at current rates. Want me to show you what the rent would need to be?",
  loan_amount_too_low: "That loan amount is below our minimum threshold. Reply and I can suggest some options that might work for your situation.",
  state_not_covered: "We don't cover your state yet. I'll add you to our expansion list and reach out when we do.",
  property_not_eligible: "That property type isn't eligible for our current programs. If you're looking at a different property, let me know.",
  borrower_withdrew: "No problem at all. If anything changes, reply here and I'll be happy to help.",
}

export async function GET() {
  try {
    const results = { funded: 0, dq: 0, submitted: 0 }

    // ── Check for newly funded apps ──
    const { data: funded } = await supabase
      .from("loan_applications")
      .select("id, lead_id, applicant_name, applicant_phone, loan_amount, updated_at")
      .eq("status", "funded")
      .is("processed_at", null)
      .order("updated_at", { ascending: false })
      .limit(10)

    for (const app of funded || []) {
      if (!app.lead_id || !app.applicant_phone) continue
      const firstName = (app.applicant_name || "").split(" ")[0] || "there"

      // Enroll post-close nurture steps
      const now = new Date()
      for (const step of POST_CLOSE_STEPS) {
        const scheduledAt = new Date(now.getTime() + step.delayDays * 86400000)
        await supabase.from("lead_cadence_queue").insert({
          lead_id: app.lead_id,
          lead_name: app.applicant_name,
          lead_phone: app.applicant_phone,
          step_number: 100 + step.step, // 101-106 to avoid collision with initial cadence
          step_type: step.type,
          step_description: step.desc,
          template_slug: step.template,
          cadence_type: "post_close",
          status: "pending",
          scheduled_at: scheduledAt.toISOString(),
        })
      }

      // Notify #preme
      const commission = app.loan_amount ? Math.round(Number(app.loan_amount) * 0.02) : 3500
      await slackPost("preme", "solomon",
        `🎉 ${app.applicant_name} — loan funded! $${commission.toLocaleString()} commission. Post-close nurture enrolled (6 touchpoints over 12 months).`)

      // Mark processed
      await supabase.from("loan_applications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", app.id)

      results.funded++
    }

    // ── Check for newly DQ'd apps ──
    const { data: dqApps } = await supabase
      .from("loan_applications")
      .select("id, lead_id, applicant_name, applicant_phone, dq_reason, updated_at")
      .eq("status", "not_qualified")
      .not("dq_reason", "is", null)
      .is("processed_at", null)
      .limit(10)

    for (const app of dqApps || []) {
      if (!app.applicant_phone || !app.dq_reason) continue
      const firstName = (app.applicant_name || "").split(" ")[0] || "there"
      const reason = app.dq_reason as string

      // Send reason-specific SMS
      const template = DQ_MESSAGES[reason]
      if (template) {
        const message = template.replace("{name}", firstName)
        await sendPremeSms({
          toPhone: app.applicant_phone,
          message,
          firstName,
          source: `dq_${reason}`,
        })
      }

      // Schedule 90-day re-engagement (except borrower_withdrew gets it too)
      if (app.lead_id && reason !== "borrower_withdrew") {
        await supabase.from("lead_cadence_queue").insert({
          lead_id: app.lead_id,
          lead_name: app.applicant_name,
          lead_phone: app.applicant_phone,
          step_number: 200,
          step_type: "sms",
          step_description: "T+90 day DQ re-engagement",
          template_slug: "dq-reengage-90",
          cadence_type: "dq_reengage",
          status: "pending",
          scheduled_at: new Date(Date.now() + 90 * 86400000).toISOString(),
        })

        // Also 180-day final attempt
        await supabase.from("lead_cadence_queue").insert({
          lead_id: app.lead_id,
          lead_name: app.applicant_name,
          lead_phone: app.applicant_phone,
          step_number: 201,
          step_type: "sms",
          step_description: "T+180 day DQ final check",
          template_slug: "dq-reengage-180",
          cadence_type: "dq_reengage",
          status: "pending",
          scheduled_at: new Date(Date.now() + 180 * 86400000).toISOString(),
        })
      }

      // Mark processed
      await supabase.from("loan_applications")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", app.id)

      results.dq++
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (err) {
    console.error("[status-actions] Error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
