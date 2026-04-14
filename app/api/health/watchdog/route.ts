import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hriipovloelnqrlwtswy.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { db: { schema: "marathon" } }
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("system_heartbeats")
      .select("service, last_beat")

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const now = Date.now()
    const services: Record<string, { last_beat: string; stale: boolean; age_minutes: number }> = {}
    let allOk = true

    for (const row of data || []) {
      const lastBeat = new Date(row.last_beat).getTime()
      const ageMinutes = Math.round((now - lastBeat) / 60000)
      const stale = ageMinutes > 15

      services[row.service] = {
        last_beat: row.last_beat,
        stale,
        age_minutes,
      }

      if (stale) allOk = false
    }

    return NextResponse.json({
      ok: allOk,
      ts: new Date().toISOString(),
      services,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
