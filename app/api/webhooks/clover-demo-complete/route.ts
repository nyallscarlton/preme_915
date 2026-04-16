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

function scoreFromDuration(seconds: number): number {
  if (seconds >= 300) return 5
  if (seconds >= 120) return 4
  if (seconds >= 60) return 3
  if (seconds >= 30) return 2
  return 1
}

export async function POST(req: NextRequest) {
  const payload: any = await req.json().catch(() => ({}))
  const duration = Number(payload.call_duration_seconds ?? payload.duration ?? 0)
  const leadIdentifier: string | undefined =
    payload.lead_id || payload.email || payload.phone || payload.metadata?.lead_id
  const agentId: string | undefined = payload.agent_id

  if (!leadIdentifier) {
    return NextResponse.json({ error: "no lead identifier (need lead_id, email, or phone)" }, { status: 400 })
  }

  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clover" } }
  )

  // Try to find the lead by id first, then email/phone
  let lead: any = null
  if (leadIdentifier.includes("@")) {
    const r = await c.from("leads").select("*").eq("email", leadIdentifier).maybeSingle()
    lead = r.data
  } else if (leadIdentifier.length === 36) {
    const r = await c.from("leads").select("*").eq("id", leadIdentifier).maybeSingle()
    lead = r.data
  }
  if (!lead) {
    const r = await c.from("leads").select("*").eq("phone", leadIdentifier).maybeSingle()
    lead = r.data
  }
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 })

  const score = scoreFromDuration(duration)
  const patch: any = {
    demo_started_at: lead.demo_started_at || new Date().toISOString(),
    demo_duration_seconds: duration,
    demo_completed_at: new Date().toISOString(),
    demo_engagement_score: score,
    demo_bot_industry: lead.industry,
  }

  if (score >= 3) {
    patch.status = "demo_completed"
    patch.funnel_stage = "trial"
    await slackPost("#clover", `🎯 Hot demo: ${lead.first_name || ""} from ${lead.company_name || "?"} spent ${duration}s. Ready for trial bot creation.`)
  } else {
    patch.status = "demo_started"
    await slackPost("#clover", `📊 Clover demo: ${lead.first_name || ""} — ${duration}s (low engagement). Follow-up email suggested.`)
  }
  await c.from("leads").update(patch).eq("id", lead.id)
  await logExecution("clover-demo-complete", "clover", "completed", { lead_id: lead.id, duration, score, agent_id: agentId })
  return NextResponse.json({ ok: true, lead_id: lead.id, engagement_score: score })
}
