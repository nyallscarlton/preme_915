import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const window = searchParams.get("window") || "today"

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marathon" } }
  )

  let since: string
  const now = new Date()
  if (window === "today") {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    since = d.toISOString()
  } else if (window === "7d") {
    since = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString()
  } else if (window === "30d") {
    since = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString()
  } else {
    since = "2026-01-01T00:00:00Z"
  }

  const { data, error } = await supabase
    .from("agent_costs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10000)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const rows = data || []
  const total = rows.reduce((sum: number, r: any) => sum + Number(r.total_cost_usd), 0)
  const byAgent: Record<string, { sessions: number; cost: number; tokens: number }> = {}
  for (const r of rows) {
    if (!byAgent[r.agent_name]) byAgent[r.agent_name] = { sessions: 0, cost: 0, tokens: 0 }
    byAgent[r.agent_name].sessions += 1
    byAgent[r.agent_name].cost += Number(r.total_cost_usd)
    byAgent[r.agent_name].tokens += (r.input_tokens || 0) + (r.output_tokens || 0)
  }

  const daysInWindow = (now.getTime() - new Date(since).getTime()) / (24 * 3600_000)
  const projectedMonthly = daysInWindow > 0 ? (total / daysInWindow) * 30 : 0

  // Budget alerts
  if (window === "today" && total > 15) {
    await supabase.from("agent_memory").insert({
      agent_name: "cost_monitor",
      memory_type: "escalation",
      summary: `Daily agent costs exceeded $15: currently $${total.toFixed(2)}`,
      details: { by_agent: byAgent, projected_monthly: projectedMonthly },
      entity: "marathon",
      importance: 0.7,
    }).then(() => {}).catch(() => {})
  }
  if (window === "today" && total > 25 && process.env.SLACK_BOT_TOKEN) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: "#alerts",
        text: `🚨 Agent costs over $25 today: $${total.toFixed(2)}. Check /api/cost-summary?window=today`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json({
    ok: true,
    window,
    since,
    total_cost_usd: Number(total.toFixed(4)),
    session_count: rows.length,
    by_agent: byAgent,
    projected_monthly_usd: Number(projectedMonthly.toFixed(2)),
  })
}
