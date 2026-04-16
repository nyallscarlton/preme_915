import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { executeCloverStep, logExecution, type CloverQueueRow } from "@/lib/clover-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 90

export async function GET(_req: NextRequest) {
  const started = Date.now()
  const c = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "clover" } }
  )
  const { data: rows, error } = await c
    .from("lead_cadence_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ ok: true, processed: 0, message: "no due steps" })

  let succeeded = 0, failed = 0
  for (const row of rows as CloverQueueRow[]) {
    const r = await executeCloverStep(row)
    const patch: any = { executed_at: new Date().toISOString(), status: r.ok ? "completed" : "failed" }
    if (!r.ok) patch.error_message = (r.error || "unknown").slice(0, 500)
    await c.from("lead_cadence_queue").update(patch).eq("id", row.id)
    r.ok ? succeeded++ : failed++
  }
  await logExecution("clover-cadence-runner", "clover", failed === 0 ? "completed" : "partial", { processed: rows.length, succeeded, failed, duration_ms: Date.now() - started })
  return NextResponse.json({ ok: true, processed: rows.length, succeeded, failed })
}
