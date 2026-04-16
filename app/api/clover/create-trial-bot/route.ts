import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { logExecution } from "@/lib/clover-cadence"

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

/**
 * POST /api/clover/create-trial-bot
 *
 * Body: { lead_id, business_name, industry, services?, hours?, faqs?,
 *         retell_agent_id?, phone_number? }
 *
 * If retell_agent_id + phone_number are provided, use them directly (Nyalls
 * has created the agent manually in Retell). Otherwise, we stub: create the
 * trial_bots row with status='creating' and post to #clover for manual build.
 */
export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}))
  const { lead_id, business_name, industry, services, hours, faqs, retell_agent_id, phone_number } = body
  if (!lead_id || !business_name || !industry) {
    return NextResponse.json({ error: "lead_id, business_name, industry required" }, { status: 400 })
  }

  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clover" } }
  )

  const { data: lead } = await c.from("leads").select("*").eq("id", lead_id).single()
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 })

  const expires = new Date(Date.now() + 7 * 24 * 3600_000)
  const trialStatus = retell_agent_id && phone_number ? "active" : "creating"

  const { data: tb, error } = await c.from("trial_bots").insert({
    lead_id,
    trial_type: "custom",
    retell_agent_id: retell_agent_id || null,
    phone_number: phone_number || null,
    business_name,
    industry,
    business_hours: hours || null,
    services: services || null,
    faqs: faqs || [],
    status: trialStatus,
    expires_at: expires.toISOString(),
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await c.from("leads").update({
    trial_agent_id: retell_agent_id || null,
    trial_phone_number: phone_number || null,
    trial_created_at: new Date().toISOString(),
    trial_expires_at: expires.toISOString(),
    status: trialStatus === "active" ? "trial_active" : "trial_created",
    funnel_stage: "trial",
  }).eq("id", lead_id)

  if (trialStatus === "active") {
    await slackPost("#clover",
      `🚀 Trial bot active: *${business_name}* (${industry})\n` +
      `• Phone: ${phone_number}\n• Expires: ${expires.toDateString()}\n• Lead: ${lead.email}`)
  } else {
    await slackPost("#clover",
      `🛠️ Trial bot row created for *${business_name}* (${industry}) — NEEDS MANUAL RETELL BUILD.\n` +
      `• trial_bot id: \`${tb?.id}\`\n• lead: ${lead.email}\n` +
      `• After creating the agent in Retell, PATCH this row with retell_agent_id + phone_number + status=active.`)
  }

  await logExecution("clover-create-trial-bot", "clover", "completed", { lead_id, trial_bot_id: tb?.id, status: trialStatus })
  return NextResponse.json({ ok: true, trial_bot_id: tb?.id, status: trialStatus })
}
