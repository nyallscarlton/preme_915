import Retell from "retell-sdk"
import { createClient } from "@supabase/supabase-js"
import { VoiceLabClient } from "./voice-lab-client"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "zentryx" } }
)

const PREME_AGENTS = [
  "agent_a6b1d2e882775997b0c4e286b2", // Preme Home Loans - Riley
]

interface CallData {
  call_id: string
  direction: string
  from_number: string
  to_number: string
  duration_ms: number
  duration_formatted: string
  disconnection_reason: string
  start_timestamp: number
  recording_url: string | null
  transcript: string | null
  summary: string | null
  temperature: string | null
  score: number | null
  caller_name: string | null
  caller_phone: string
  lead_id: string | null
  property_address: string | null
  loan_type: string | null
}

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return `${min}:${String(rem).padStart(2, "0")}`
}

export default async function VoiceLabPage() {
  const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! })

  // Fetch last 50 calls from all Preme agents
  let allCalls: CallData[] = []

  for (const agentId of PREME_AGENTS) {
    try {
      const resp = await retell.call.list({
        filter_criteria: { agent_id: [agentId] } as any,
        limit: 50,
        sort_order: "descending",
      }) as any
      const calls = resp.items || resp || []

      for (const c of calls) {
        const analysis = c.call_analysis?.custom_analysis_data || {}
        const callerPhone = c.direction === "inbound" ? (c.from_number || "") : (c.to_number || "")
        const phoneDigits = callerPhone.replace(/\D/g, "").slice(-10)

        // Look up lead
        let leadId: string | null = null
        let callerName: string | null = null
        if (phoneDigits.length === 10) {
          const { data: lead } = await supabase
            .from("zx_leads")
            .select("id, first_name, last_name")
            .like("phone", `%${phoneDigits}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          if (lead) {
            leadId = lead.id
            callerName = `${lead.first_name} ${lead.last_name}`.trim()
          }
        }

        if (!callerName) {
          const fn = analysis.first_name || ""
          const ln = analysis.last_name || ""
          if (fn) callerName = `${fn} ${ln}`.trim()
        }

        allCalls.push({
          call_id: c.call_id,
          direction: c.direction || "outbound",
          from_number: c.from_number || "",
          to_number: c.to_number || "",
          duration_ms: c.duration_ms || 0,
          duration_formatted: formatDuration(c.duration_ms || 0),
          disconnection_reason: c.disconnection_reason || "",
          start_timestamp: c.start_timestamp || 0,
          recording_url: c.recording_url || null,
          transcript: c.transcript || null,
          summary: c.call_analysis?.call_summary || null,
          temperature: (analysis.lead_temperature || "").toLowerCase() || null,
          score: analysis.score ? parseInt(analysis.score) : null,
          caller_name: callerName,
          caller_phone: callerPhone,
          lead_id: leadId,
          property_address: analysis.property_address || null,
          loan_type: analysis.loan_type_confirmed || null,
        })
      }
    } catch (err) {
      console.error(`[voice-lab] Failed to fetch calls for ${agentId}:`, err)
    }
  }

  // Sort by timestamp descending
  allCalls.sort((a, b) => b.start_timestamp - a.start_timestamp)

  // Stats
  const totalCalls = allCalls.length
  const inbound = allCalls.filter(c => c.direction === "inbound").length
  const outbound = allCalls.filter(c => c.direction === "outbound").length
  const hot = allCalls.filter(c => c.temperature === "hot").length
  const warm = allCalls.filter(c => c.temperature === "warm").length
  const avgDuration = totalCalls > 0
    ? Math.round(allCalls.reduce((s, c) => s + c.duration_ms, 0) / totalCalls / 1000)
    : 0
  const connected = allCalls.filter(c => c.duration_ms > 10000).length
  const connectRate = totalCalls > 0 ? Math.round(connected / totalCalls * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Voice Lab</h1>
        <p className="text-sm text-gray-500">Riley call recordings, transcripts, and analysis</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Total" value={totalCalls} />
        <Stat label="Inbound" value={inbound} />
        <Stat label="Outbound" value={outbound} />
        <Stat label="Hot" value={hot} color="red" />
        <Stat label="Warm" value={warm} color="yellow" />
        <Stat label="Avg Duration" value={`${avgDuration}s`} />
        <Stat label="Connect Rate" value={`${connectRate}%`} />
      </div>

      <VoiceLabClient calls={allCalls} />
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClass = color === "red" ? "text-red-600" : color === "yellow" ? "text-yellow-600" : "text-gray-900"
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
