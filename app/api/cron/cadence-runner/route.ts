/**
 * Preme Cadence Runner — runs every 2 minutes via Vercel cron (or external cron)
 *
 * Polls preme.lead_cadence_queue for pending steps that are due, executes them,
 * and updates their status. Each step is wrapped in ExecLog (Priority 2 pattern)
 * so failures end up in marathon.execution_log AND post a Slack alert.
 *
 * After each run, also detects leads whose step 13 just completed and routes
 * them to the appropriate Zentryx nurture sequence (Day-7 handoff).
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { executeStep, routeToNurtureAfterDay7, type QueueRow } from "@/lib/preme-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 90  // Vercel function timeout

function premeClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" } }
  )
}

export async function GET(_req: NextRequest) {
  const startedAt = Date.now()
  const supabase = premeClient()

  // 1. Pull due steps (max 50 per run to keep function under timeout)
  // Inner-join leads to filter out any test rows (preme.leads.is_test=true).
  // Test leads must NEVER hit Twilio/Retell — they create real cost + spam flags.
  const { data: rows, error } = await supabase
    .from("lead_cadence_queue")
    .select("*, leads!inner(is_test)")
    .eq("status", "pending")
    .eq("leads.is_test", false)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50)

  if (error) {
    console.error("[cadence-runner] query error:", error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "no due steps" })
  }

  console.log(`[cadence-runner] Processing ${rows.length} due steps`)

  let succeeded = 0
  let failed = 0
  const day13LeadIds = new Set<string>()

  for (const row of rows as QueueRow[]) {
    try {
      await executeStep(row)
      // After execution, the row is marked completed/failed/cancelled by executeStep itself.
      // Track step-13 completions for the day-7 handoff pass below.
      if (row.step_number === 13) {
        day13LeadIds.add(row.lead_id)
      }
      succeeded++
    } catch (err) {
      console.error(`[cadence-runner] step ${row.step_number} for lead ${row.lead_id} threw:`, err)
      failed++
    }
  }

  // 2. Day-7 handoff for any leads whose step 13 just completed
  const handoffs: Array<{ lead_id: string; result: unknown }> = []
  for (const leadId of day13LeadIds) {
    try {
      const result = await routeToNurtureAfterDay7(leadId)
      handoffs.push({ lead_id: leadId, result })
    } catch (err) {
      handoffs.push({ lead_id: leadId, result: { ok: false, error: String(err) } })
    }
  }

  const durationMs = Date.now() - startedAt
  return NextResponse.json({
    ok: true,
    processed: rows.length,
    succeeded,
    failed,
    day7_handoffs: handoffs,
    duration_ms: durationMs,
  })
}
