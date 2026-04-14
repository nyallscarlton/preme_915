import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hriipovloelnqrlwtswy.supabase.co"
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function GET() {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/system_heartbeats?select=service,last_beat`, {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Accept-Profile": "marathon",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Supabase ${res.status}` }, { status: 500 })
    }

    const rows = await res.json()
    const now = Date.now()
    const services: Record<string, { last_beat: string; stale: boolean; age_minutes: number }> = {}
    let allOk = true

    for (const row of rows) {
      const lastBeat = new Date(row.last_beat).getTime()
      const ageMinutes = Math.round((now - lastBeat) / 60000)
      const stale = ageMinutes > 15

      services[row.service] = { last_beat: row.last_beat, stale, age_minutes }
      if (stale) allOk = false
    }

    return NextResponse.json({ ok: allOk, ts: new Date().toISOString(), services })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
