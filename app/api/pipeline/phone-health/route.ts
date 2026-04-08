import { NextResponse } from "next/server"
import Retell from "retell-sdk"
import { createZentrxClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const PREME_ENTITY_NAME = "Preme Home Loans"

interface PhoneHealthResult {
  number: string
  nickname: string
  role: string
  poolStatus: string
  callsToday: number
  callsWeek: number
  answerRate: number
  voicemailRate: number
  noAnswerRate: number
  healthScore: number // 0-100
  status: "healthy" | "warning" | "danger" | "critical"
  alerts: string[]
  // From number_health table
  contactRate: number | null
  vmRate: number | null
  dbHealthStatus: string | null
}

const DAILY_CALL_LIMIT = 80 // industry best practice
const WEEKLY_CALL_LIMIT = 400

export async function GET() {
  try {
    const apiKey = process.env.RETELL_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 })
    }

    const supabase = createZentrxClient()
    const retell = new Retell({ apiKey })

    // Only fetch Preme Home Loans numbers from number_pool
    const { data: premeNumbers, error: poolError } = await supabase
      .from("number_pool")
      .select("phone_number, entity_id, entity_name, role, status, retell_agent_id")
      .eq("entity_name", PREME_ENTITY_NAME)
      .in("status", ["active", "warming"])

    if (poolError) {
      console.error("[phone-health] number_pool query error:", poolError)
      return NextResponse.json({ error: "Failed to query number_pool" }, { status: 500 })
    }

    if (!premeNumbers || premeNumbers.length === 0) {
      return NextResponse.json({ phones: [], timestamp: new Date().toISOString() })
    }

    // Fetch latest health data from number_health for these numbers
    const phoneList = premeNumbers.map(n => n.phone_number)
    const { data: healthRows } = await supabase
      .from("number_health")
      .select("phone_number, total_calls, connected_calls, voicemails, contact_rate, voicemail_rate, status, week_start")
      .in("phone_number", phoneList)
      .order("week_start", { ascending: false })

    // Build a map of latest health per phone number
    const healthMap: Record<string, any> = {}
    for (const row of (healthRows || [])) {
      if (!healthMap[row.phone_number]) {
        healthMap[row.phone_number] = row // first row is latest due to descending order
      }
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const results: PhoneHealthResult[] = []

    for (const num of premeNumbers) {
      const phoneNumber = num.phone_number
      const healthData = healthMap[phoneNumber] || null

      // Fetch recent calls from Retell for this number
      let allCalls: any[] = []
      try {
        const callsResp = await retell.call.list({
          filter_criteria: {
            from_number: [phoneNumber],
          } as any,
          limit: 500,
          sort_order: "descending",
        })
        const rawCalls = (callsResp as any).items || callsResp || []
        allCalls = Array.isArray(rawCalls) ? rawCalls.filter((c: any) =>
          c.start_timestamp && c.start_timestamp >= weekStart.getTime()
        ) : []
      } catch {
        // Some numbers may not have calls yet
      }

      const todayCalls = allCalls.filter((c: any) =>
        c.start_timestamp && c.start_timestamp >= todayStart.getTime()
      )

      const weekCalls = allCalls

      // Calculate rates from live Retell data
      const totalWeek = weekCalls.length
      const totalToday = todayCalls.length

      let answered = 0
      let voicemail = 0
      let noAnswer = 0

      for (const c of weekCalls) {
        const dr = c.disconnection_reason || ""
        if (dr === "voicemail_reached") voicemail++
        else if (["dial_no_answer", "dial_busy", "dial_failed", "invalid_destination"].includes(dr)) noAnswer++
        else if (["agent_hangup", "user_hangup", "max_duration_reached", "inactivity"].includes(dr)) answered++
      }

      const answerRate = totalWeek > 0 ? Math.round((answered / totalWeek) * 100) : 100
      const voicemailRate = totalWeek > 0 ? Math.round((voicemail / totalWeek) * 100) : 0
      const noAnswerRate = totalWeek > 0 ? Math.round((noAnswer / totalWeek) * 100) : 0

      // Calculate health score (0-100)
      const alerts: string[] = []
      let healthScore = 100

      // Volume penalties
      if (totalToday > DAILY_CALL_LIMIT) {
        const overBy = Math.round(((totalToday - DAILY_CALL_LIMIT) / DAILY_CALL_LIMIT) * 100)
        healthScore -= Math.min(40, overBy / 2)
        alerts.push(`${totalToday} calls today (limit: ${DAILY_CALL_LIMIT})`)
      }

      if (totalWeek > WEEKLY_CALL_LIMIT) {
        healthScore -= 15
        alerts.push(`${totalWeek} calls this week (limit: ${WEEKLY_CALL_LIMIT})`)
      }

      // Answer rate penalties
      if (answerRate < 5 && totalWeek > 10) {
        healthScore -= 35
        alerts.push(`Critical: ${answerRate}% answer rate — carriers will flag this`)
      } else if (answerRate < 15 && totalWeek > 10) {
        healthScore -= 20
        alerts.push(`Low answer rate: ${answerRate}%`)
      } else if (answerRate < 30 && totalWeek > 10) {
        healthScore -= 10
        alerts.push(`Below average answer rate: ${answerRate}%`)
      }

      // Voicemail flood penalty
      if (voicemailRate > 70 && totalWeek > 10) {
        healthScore -= 15
        alerts.push(`${voicemailRate}% going to voicemail`)
      }

      // Spike detection
      const dailyAvg = totalWeek > 0 ? totalWeek / 7 : 0
      if (totalToday > dailyAvg * 2 && totalToday > 20) {
        healthScore -= 10
        alerts.push(`Spike: ${totalToday} calls today vs ${Math.round(dailyAvg)} avg/day`)
      }

      // If number_health says burned, override score
      if (healthData?.status === "burned") {
        healthScore = Math.min(healthScore, 10)
        alerts.push("Marked as BURNED in number health tracking")
      } else if (healthData?.status === "warning") {
        healthScore = Math.min(healthScore, 60)
        if (!alerts.some(a => a.includes("answer rate"))) {
          alerts.push("Warning status in number health tracking")
        }
      }

      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))

      let status: PhoneHealthResult["status"] = "healthy"
      if (healthScore < 30) status = "critical"
      else if (healthScore < 50) status = "danger"
      else if (healthScore < 75) status = "warning"

      if (alerts.length === 0 && totalWeek === 0) {
        alerts.push("No outbound calls this week")
      } else if (alerts.length === 0) {
        alerts.push("All clear")
      }

      results.push({
        number: phoneNumber,
        nickname: num.role ? `${num.role.charAt(0).toUpperCase() + num.role.slice(1)} Line` : phoneNumber,
        role: num.role || "unknown",
        poolStatus: num.status || "unknown",
        callsToday: totalToday,
        callsWeek: totalWeek,
        answerRate,
        voicemailRate,
        noAnswerRate,
        healthScore,
        status,
        alerts,
        contactRate: healthData?.contact_rate ?? null,
        vmRate: healthData?.voicemail_rate ?? null,
        dbHealthStatus: healthData?.status ?? null,
      })
    }

    // Sort: worst health first
    results.sort((a, b) => a.healthScore - b.healthScore)

    return NextResponse.json({ phones: results, timestamp: now.toISOString() })
  } catch (error) {
    console.error("[phone-health] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
