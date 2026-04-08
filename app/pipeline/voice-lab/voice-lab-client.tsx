"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Play, Pause, ChevronDown, ChevronUp, Phone, PhoneIncoming,
  PhoneOutgoing, Flame, Clock, FileText, ExternalLink, Filter,
} from "lucide-react"

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

const TEMP_CONFIG: Record<string, { icon: string; bg: string; text: string }> = {
  hot: { icon: "🔥", bg: "bg-red-100", text: "text-red-700" },
  warm: { icon: "🟡", bg: "bg-yellow-100", text: "text-yellow-700" },
  cold: { icon: "🔵", bg: "bg-blue-100", text: "text-blue-700" },
}

const OUTCOME_LABELS: Record<string, string> = {
  voicemail_reached: "Voicemail",
  user_hangup: "Lead hung up",
  agent_hangup: "Riley ended",
  dial_no_answer: "No answer",
  inactivity: "No response",
  max_duration_reached: "Max duration",
  invalid_destination: "Invalid number",
}

export function VoiceLabClient({ calls }: { calls: CallData[] }) {
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound" | "hot" | "connected">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const filtered = calls.filter(c => {
    if (filter === "inbound") return c.direction === "inbound"
    if (filter === "outbound") return c.direction === "outbound"
    if (filter === "hot") return c.temperature === "hot"
    if (filter === "connected") return c.duration_ms > 10000
    return true
  })

  function timeAgo(ts: number): string {
    const diff = Date.now() - ts
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return "Just now"
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const days = Math.floor(hr / 24)
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  function getRecordingSrc(url: string): string {
    if (url.includes("api.twilio.com")) {
      return `/api/pipeline/recording?url=${encodeURIComponent(url)}`
    }
    return url
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-400" />
        {(["all", "inbound", "outbound", "hot", "connected"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 border hover:bg-gray-50"
            }`}
          >
            {f === "all" ? `All (${calls.length})` :
             f === "hot" ? `🔥 Hot (${calls.filter(c => c.temperature === "hot").length})` :
             f === "connected" ? `Connected (${calls.filter(c => c.duration_ms > 10000).length})` :
             `${f.charAt(0).toUpperCase() + f.slice(1)} (${calls.filter(c => c.direction === f).length})`}
          </button>
        ))}
      </div>

      {/* Call cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">No calls match this filter</div>
        )}
        {filtered.map((call, idx) => {
          const isExpanded = expandedId === call.call_id
          const isPlaying = playingId === call.call_id
          const temp = TEMP_CONFIG[call.temperature || ""] || null
          const outcome = OUTCOME_LABELS[call.disconnection_reason] || call.disconnection_reason

          return (
            <div
              key={call.call_id}
              className={`rounded-xl border bg-white overflow-hidden transition ${
                isExpanded ? "ring-2 ring-blue-200" : ""
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Number */}
                <span className="text-xs font-mono text-gray-400 w-6">#{filtered.length - idx}</span>

                {/* Direction icon */}
                {call.direction === "inbound" ? (
                  <PhoneIncoming className="h-4 w-4 text-green-500 flex-shrink-0" />
                ) : (
                  <PhoneOutgoing className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}

                {/* Caller info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {call.lead_id ? (
                      <Link href={`/admin/leads/${call.lead_id}`} className="font-medium text-sm text-blue-600 hover:underline truncate">
                        {call.caller_name || "Unknown"}
                      </Link>
                    ) : (
                      <span className="font-medium text-sm text-gray-800 truncate">{call.caller_name || "Unknown Caller"}</span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">{call.caller_phone}</span>
                  </div>
                  {call.summary && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{call.summary}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {temp && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${temp.bg} ${temp.text}`}>
                      {temp.icon} {call.temperature}
                    </span>
                  )}
                  {call.score && call.score > 0 && (
                    <span className="text-xs text-gray-400">{call.score}/100</span>
                  )}
                </div>

                {/* Duration + time */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-medium ${call.duration_ms > 30000 ? "text-green-600" : call.duration_ms > 5000 ? "text-gray-700" : "text-gray-400"}`}>
                    {call.duration_formatted}
                  </p>
                  <p className="text-xs text-gray-400">{timeAgo(call.start_timestamp)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {call.recording_url && (
                    <button
                      onClick={() => setPlayingId(isPlaying ? null : call.call_id)}
                      className={`rounded-lg p-2 transition ${
                        isPlaying ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  )}
                  {call.transcript && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : call.call_id)}
                      className={`rounded-lg p-2 transition ${
                        isExpanded ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Audio player */}
              {isPlaying && call.recording_url && (
                <div className="px-4 pb-3 border-t bg-gray-50">
                  <audio
                    controls
                    autoPlay
                    preload="auto"
                    className="w-full h-10 mt-2"
                    onEnded={() => setPlayingId(null)}
                  >
                    <source src={getRecordingSrc(call.recording_url)} type="audio/wav" />
                    <source src={getRecordingSrc(call.recording_url)} type="audio/mpeg" />
                  </audio>
                </div>
              )}

              {/* Expanded: transcript + details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t bg-gray-50 space-y-3">
                  {/* Call details */}
                  <div className="flex flex-wrap gap-3 pt-3 text-xs text-gray-500">
                    <span>Outcome: <strong>{outcome}</strong></span>
                    {call.property_address && <span>Property: <strong>{call.property_address}</strong></span>}
                    {call.loan_type && <span>Loan: <strong>{call.loan_type}</strong></span>}
                    <span>ID: {call.call_id.substring(0, 15)}...</span>
                  </div>

                  {/* Summary */}
                  {call.summary && (
                    <div className="rounded-lg bg-white border p-3">
                      <p className="text-xs font-medium text-gray-500 mb-1">Summary</p>
                      <p className="text-sm text-gray-700">{call.summary}</p>
                    </div>
                  )}

                  {/* Transcript */}
                  {call.transcript && (
                    <div className="rounded-lg bg-white border p-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Transcript</p>
                      <div className="text-sm space-y-1 max-h-96 overflow-y-auto">
                        {call.transcript.split("\n").map((line, i) => {
                          const isAgent = line.startsWith("Agent:")
                          const isUser = line.startsWith("User:")
                          return (
                            <p key={i} className={
                              isAgent ? "text-blue-700" :
                              isUser ? "text-gray-800" :
                              "text-gray-400 text-xs"
                            }>
                              {isAgent ? line.replace("Agent:", "Riley:") : line}
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
