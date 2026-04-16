import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_req: NextRequest) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "marathon" } }
  )

  // Yesterday UTC 00:00 to today 00:00
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const yesterday = new Date(today.getTime() - 24 * 3600_000)

  const { data } = await supabase
    .from("agent_costs")
    .select("*")
    .gte("created_at", yesterday.toISOString())
    .lt("created_at", today.toISOString())
    .limit(10000)

  const rows = data || []
  const total = rows.reduce((sum: number, r: any) => sum + Number(r.total_cost_usd), 0)
  const byAgent: Record<string, { sessions: number; cost: number }> = {}
  for (const r of rows) {
    if (!byAgent[r.agent_name]) byAgent[r.agent_name] = { sessions: 0, cost: 0 }
    byAgent[r.agent_name].sessions += 1
    byAgent[r.agent_name].cost += Number(r.total_cost_usd)
  }

  const projectedMonthly = total * 30
  const agentNames = ["jay", "scout", "solomon", "lauren", "cto", "hh_ai_reply", "clover_ai_reply"]
  const agentLabels: Record<string, string> = {
    jay: "Jay", scout: "Scout", solomon: "Solomon", lauren: "Lauren",
    cto: "CTO", hh_ai_reply: "HH AI replies", clover_ai_reply: "Clover AI replies",
  }

  let lines = agentNames
    .filter((n) => byAgent[n])
    .map((n) => `• ${agentLabels[n] || n}: $${byAgent[n].cost.toFixed(2)} (${byAgent[n].sessions} sessions)`)

  if (lines.length === 0) lines = ["• No agent sessions yesterday"]

  let msg = `💰 *Agent Costs — Yesterday*\n\n`
  msg += `*Total:* $${total.toFixed(2)}\n`
  msg += `*Projected monthly:* $${projectedMonthly.toFixed(2)}\n\n`
  msg += `*By agent:*\n${lines.join("\n")}`

  if (total > 10) msg += `\n\n⚠️ Higher than expected ($10/day baseline) — consider tuning.`

  if (process.env.SLACK_BOT_TOKEN) {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: "#jay-hq", text: msg, unfurl_links: false }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, total_cost_usd: total, session_count: rows.length })
}
