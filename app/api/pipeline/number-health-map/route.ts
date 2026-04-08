import { NextResponse } from "next/server"
import { createZentrxClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export interface NumberHealthEntry {
  phone_number: string
  status: "healthy" | "warning" | "burned"
  contact_rate: number | null
  voicemail_rate: number | null
  pool_status: string | null
  entity_name: string | null
}

/**
 * GET /api/pipeline/number-health-map
 *
 * Returns a map of phone_number -> health status for all numbers
 * in number_pool and number_health tables. Used by lead thread views
 * to show per-call health indicators.
 */
export async function GET() {
  try {
    const supabase = createZentrxClient()

    // Get current Monday for week_start filter
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const mondayStr = monday.toISOString().split("T")[0]

    // Fetch from both tables in parallel
    const [poolRes, healthRes] = await Promise.all([
      supabase
        .from("number_pool")
        .select("phone_number, entity_name, role, status")
        .in("status", ["active", "warming", "burned", "catch", "retired"]),
      supabase
        .from("number_health")
        .select("phone_number, entity_name, status, contact_rate, voicemail_rate, week_start")
        .gte("week_start", mondayStr)
        .order("week_start", { ascending: false }),
    ])

    const healthMap: Record<string, NumberHealthEntry> = {}

    // Seed from number_pool
    for (const row of poolRes.data || []) {
      const poolStatus = row.status as string
      let derivedStatus: NumberHealthEntry["status"] = "healthy"
      if (poolStatus === "burned" || poolStatus === "retired") {
        derivedStatus = "burned"
      } else if (poolStatus === "catch") {
        derivedStatus = "warning"
      }

      healthMap[row.phone_number] = {
        phone_number: row.phone_number,
        status: derivedStatus,
        contact_rate: null,
        voicemail_rate: null,
        pool_status: poolStatus,
        entity_name: row.entity_name,
      }
    }

    // Override with number_health data (more specific / current week)
    for (const row of healthRes.data || []) {
      const existing = healthMap[row.phone_number]
      const nhStatus = row.status as string

      let derivedStatus: NumberHealthEntry["status"] = "healthy"
      if (nhStatus === "burned") {
        derivedStatus = "burned"
      } else if (nhStatus === "warning") {
        derivedStatus = "warning"
      } else if (row.contact_rate !== null) {
        if (row.contact_rate < 10) derivedStatus = "burned"
        else if (row.contact_rate < 25) derivedStatus = "warning"
      }

      if (existing) {
        // Only upgrade severity, don't downgrade
        const severityOrder = { burned: 0, warning: 1, healthy: 2 }
        if (severityOrder[derivedStatus] < severityOrder[existing.status]) {
          existing.status = derivedStatus
        }
        existing.contact_rate = row.contact_rate
        existing.voicemail_rate = row.voicemail_rate
      } else {
        healthMap[row.phone_number] = {
          phone_number: row.phone_number,
          status: derivedStatus,
          contact_rate: row.contact_rate,
          voicemail_rate: row.voicemail_rate,
          pool_status: null,
          entity_name: row.entity_name,
        }
      }
    }

    return NextResponse.json({
      numbers: healthMap,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("[number-health-map] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
