import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { enrollCloverCadence, logExecution } from "@/lib/clover-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ""

async function slackPost(channel: string, text: string) {
  if (!SLACK_BOT_TOKEN) return
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  }).catch(() => {})
}

function demoUrlFor(industry: string): string {
  const map: Record<string, string> = {
    dental: "https://cloveraiagency.com/demo/dental",
    hvac: "https://cloveraiagency.com/demo/hvac",
    real_estate: "https://cloveraiagency.com/demo/wholesaler",
  }
  return map[industry] || "https://cloveraiagency.com/demo"
}

const VALID_INDUSTRIES = new Set(["dental","hvac","real_estate","medical","legal","restaurant","ecommerce","saas","other"])

export async function POST(req: NextRequest) {
  const payload: any = await req.json().catch(() => ({}))
  const email: string | undefined = payload.lead?.email || payload.email
  const firstName: string = payload.lead?.first_name || payload.first_name || ""
  const lastName: string = payload.lead?.last_name || payload.last_name || ""
  const companyName: string = payload.lead?.company_name || payload.company_name || ""
  let industry: string = payload.lead?.custom_variables?.industry || payload.industry || "other"
  if (!VALID_INDUSTRIES.has(industry)) industry = "other"
  const replyText: string = payload.reply?.text || payload.reply_text || payload.text || ""
  const originalSubject: string = payload.reply?.subject || payload.original_subject || payload.subject || ""
  const campaignId: string = payload.campaign_id || payload.lead?.campaign_id || ""

  if (!email) return NextResponse.json({ error: "no email" }, { status: 400 })

  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clover" } }
  )

  const { data: existing } = await c.from("leads").select("id").eq("email", email).maybeSingle()
  if (existing?.id) {
    await c.from("leads").update({ reply_text: replyText, updated_at: new Date().toISOString() }).eq("id", existing.id)
    return NextResponse.json({ ok: true, lead_id: existing.id, deduped: true })
  }

  const { data: inserted, error: insErr } = await c.from("leads").insert({
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: `${firstName} ${lastName}`.trim() || null,
    email,
    company_name: companyName || null,
    industry,
    source: "cold_email",
    source_detail: `instantly campaign ${campaignId}`,
    instantly_campaign_id: campaignId,
    status: "email_replied",
    funnel_stage: "top",
    reply_text: replyText,
  }).select("id").single()

  if (insErr || !inserted) {
    await logExecution("clover-instantly-reply", "clover", "failed", { error: insErr?.message })
    return NextResponse.json({ error: insErr?.message || "insert failed" }, { status: 500 })
  }

  const leadId = inserted.id
  const demoUrl = demoUrlFor(industry)

  try {
    await enrollCloverCadence({
      leadId,
      aiContext: {
        reply_text: replyText,
        original_subject: originalSubject,
        first_name: firstName,
        company_name: companyName,
        industry,
        demo_url: demoUrl,
      },
    })
  } catch (err: any) {
    await logExecution("clover-instantly-reply", "clover", "enroll_failed", { lead_id: leadId, error: err.message })
  }

  const preview = replyText.slice(0, 120) + (replyText.length > 120 ? "…" : "")
  await slackPost("#clover",
    `🤖 *New Clover lead:* ${firstName} ${lastName} from ${companyName || "?"} (${industry})\n` +
    `• Source: Cold email reply\n` +
    `• Demo: ${demoUrl}\n` +
    `• Reply: "${preview}"\n` +
    `• AI email fires in 5 min → fallback follow-ups at 48h + 5d`)

  await logExecution("clover-instantly-reply", "clover", "completed", { lead_id: leadId, industry })

  return NextResponse.json({ ok: true, lead_id: leadId, industry })
}
