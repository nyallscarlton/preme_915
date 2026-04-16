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
 * POST /api/clover/start-live-trial
 * Body: { lead_id, forwarding_number }
 *
 * Reuses the lead's existing custom trial_bot if present.
 * Call forwarding is a manual step for the prospect (we just instruct them).
 */
export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}))
  const { lead_id, forwarding_number } = body
  if (!lead_id || !forwarding_number) {
    return NextResponse.json({ error: "lead_id and forwarding_number required" }, { status: 400 })
  }

  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clover" } }
  )

  const { data: lead } = await c.from("leads").select("*").eq("id", lead_id).single()
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 })

  // Reuse existing custom trial bot if one exists
  const { data: existingBot } = await c.from("trial_bots").select("*").eq("lead_id", lead_id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle()

  const expires = new Date(Date.now() + 48 * 3600_000)

  const { data: tb, error } = await c.from("trial_bots").insert({
    lead_id,
    trial_type: "live_48hr",
    retell_agent_id: existingBot?.retell_agent_id || null,
    phone_number: existingBot?.phone_number || null,
    forwarding_from: forwarding_number,
    business_name: existingBot?.business_name || lead.company_name || "Business",
    industry: existingBot?.industry || lead.industry || "other",
    status: existingBot?.retell_agent_id ? "active" : "creating",
    expires_at: expires.toISOString(),
  }).select("id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await c.from("leads").update({
    status: "live_trial_active",
    funnel_stage: "live_trial",
    live_trial_forwarding_number: forwarding_number,
    live_trial_started_at: new Date().toISOString(),
    live_trial_ends_at: expires.toISOString(),
  }).eq("id", lead_id)

  await slackPost("#clover",
    `🔴 *LIVE TRIAL STARTED:* ${lead.company_name || lead.email}\n` +
    `• Forwarding: ${forwarding_number} → ${existingBot?.phone_number || "(pending)"}\n` +
    `• Ends: ${expires.toLocaleString("en-US", { timeZone: "America/New_York" })} ET\n` +
    `• This is a closing opportunity.`)

  await logExecution("clover-start-live-trial", "clover", "completed", { lead_id, trial_bot_id: tb?.id })
  return NextResponse.json({ ok: true, trial_bot_id: tb?.id })
}
