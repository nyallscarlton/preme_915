import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { executeHHStep, logExecution, type HHQueueRow } from "@/lib/hh-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 90

export async function GET(_req: NextRequest) {
  const started = Date.now()
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "hurry_homes" } }
  )

  const { data: rows, error } = await supabase
    .from("lead_cadence_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "no due steps" })
  }

  let succeeded = 0
  let failed = 0

  for (const row of rows as HHQueueRow[]) {
    const result = await executeHHStep(row)
    const patch: any = {
      executed_at: new Date().toISOString(),
      status: result.ok ? "completed" : "failed",
    }
    if (!result.ok) patch.error_message = (result.error || "unknown").slice(0, 500)
    await supabase.from("lead_cadence_queue").update(patch).eq("id", row.id)
    if (result.ok) succeeded++
    else failed++
  }

  const duration = Date.now() - started
  await logExecution("hh-cadence-runner", "hurry_homes", failed === 0 ? "completed" : "partial", {
    processed: rows.length, succeeded, failed, duration_ms: duration,
  })
  return NextResponse.json({ ok: true, processed: rows.length, succeeded, failed, duration_ms: duration })
}
