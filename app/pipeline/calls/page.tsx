import { createClient } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CallsClient } from "./calls-client"

export const dynamic = "force-dynamic"

interface RetellCall {
  call_id: string
  agent_id: string
  call_type: "web_call" | "phone_call"
  from_number?: string
  to_number?: string
  direction: "inbound" | "outbound"
  call_status: string
  start_timestamp: number
  end_timestamp?: number
  duration_ms?: number
  transcript?: string
  transcript_object?: Array<{ role: string; content: string }>
  call_analysis?: {
    call_summary?: string
    user_sentiment?: string
    custom_analysis_data?: Record<string, unknown>
  }
  metadata?: Record<string, unknown>
  recording_url?: string
}

interface EnrichedCall {
  call_id: string
  caller_phone: string
  direction: "inbound" | "outbound"
  duration_seconds: number
  timestamp: string
  lead_name: string | null
  lead_id: string | null
  temperature: string | null
  score: number | null
  summary: string
  recording_url: string | null
  call_status: string
}

function formatPhone(phone: string | undefined): string {
  if (!phone) return "Unknown"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

function normalizePhone(phone: string | undefined): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`
}

async function fetchRetellCalls(): Promise<RetellCall[]> {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    console.error("[calls] RETELL_API_KEY not set")
    return []
  }

  try {
    const res = await fetch("https://api.retellai.com/v2/list-calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 50,
        sort_order: "descending",
        filter_criteria: {
          after_start_timestamp: Date.now() - 48 * 60 * 60 * 1000,
        },
      }),
      cache: "no-store",
    })

    if (!res.ok) {
      console.error("[calls] Retell API error:", res.status, await res.text())
      return []
    }

    return await res.json()
  } catch (err) {
    console.error("[calls] Failed to fetch Retell calls:", err)
    return []
  }
}

export default async function CallsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
  )

  const retellCalls = await fetchRetellCalls()

  // Collect all unique phone numbers from calls for bulk lead lookup
  const phoneNumbers = new Set<string>()
  for (const call of retellCalls) {
    const phone = call.direction === "inbound" ? call.from_number : call.to_number
    if (phone) phoneNumbers.add(normalizePhone(phone))
  }

  // Fetch matching leads by phone
  const leadsByPhone: Record<string, { id: string; first_name: string; last_name: string; temperature: string | null; score: number | null }> = {}

  if (phoneNumbers.size > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone, temperature, score")
      .in("phone", Array.from(phoneNumbers))
      .limit(200)

    if (leads) {
      for (const lead of leads) {
        const normalized = normalizePhone(lead.phone)
        // Keep the most recent lead per phone (first match since default order)
        if (!leadsByPhone[normalized]) {
          leadsByPhone[normalized] = lead
        }
      }
    }

    // Also try without +1 prefix for leads stored differently
    if (Object.keys(leadsByPhone).length === 0) {
      const rawPhones = Array.from(phoneNumbers).map((p) => p.replace(/^\+1/, ""))
      const { data: leads2 } = await supabase
        .from("leads")
        .select("id, first_name, last_name, phone, temperature, score")
        .or(rawPhones.map((p) => `phone.ilike.%${p.slice(-10)}`).join(","))
        .limit(200)

      if (leads2) {
        for (const lead of leads2) {
          const normalized = normalizePhone(lead.phone)
          if (!leadsByPhone[normalized]) {
            leadsByPhone[normalized] = lead
          }
        }
      }
    }
  }

  // Enrich calls with lead data
  const enrichedCalls: EnrichedCall[] = retellCalls.map((call) => {
    const callerPhone = call.direction === "inbound" ? call.from_number : call.to_number
    const normalizedPhone = normalizePhone(callerPhone)
    const matchedLead = leadsByPhone[normalizedPhone] || null

    const durationMs = call.duration_ms || (call.end_timestamp && call.start_timestamp ? call.end_timestamp - call.start_timestamp : 0)

    let summary = ""
    if (call.call_analysis?.call_summary) {
      summary = call.call_analysis.call_summary.slice(0, 100)
      if (call.call_analysis.call_summary.length > 100) summary += "..."
    } else if (call.transcript) {
      summary = call.transcript.slice(0, 100)
      if (call.transcript.length > 100) summary += "..."
    }

    return {
      call_id: call.call_id,
      caller_phone: callerPhone || "Unknown",
      direction: call.direction,
      duration_seconds: Math.round(durationMs / 1000),
      timestamp: new Date(call.start_timestamp).toISOString(),
      lead_name: matchedLead ? `${matchedLead.first_name} ${matchedLead.last_name}`.trim() : null,
      lead_id: matchedLead?.id || null,
      temperature: matchedLead?.temperature || null,
      score: matchedLead?.score || null,
      summary,
      recording_url: call.recording_url || null,
      call_status: call.call_status,
    }
  })

  const inboundCount = enrichedCalls.filter((c) => c.direction === "inbound").length
  const outboundCount = enrichedCalls.filter((c) => c.direction === "outbound").length
  const unknownCount = enrichedCalls.filter((c) => !c.lead_name).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recent Calls</h1>
        <p className="text-sm text-gray-500">
          Last 48 hours &mdash; {enrichedCalls.length} calls ({inboundCount} inbound, {outboundCount} outbound, {unknownCount} unknown callers)
        </p>
      </div>

      <CallsClient calls={enrichedCalls} />
    </div>
  )
}
