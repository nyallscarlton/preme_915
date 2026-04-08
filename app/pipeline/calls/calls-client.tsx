"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneCall,
  UserPlus,
  Clock,
  Loader2,
  Play,
  Pause,
} from "lucide-react"

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHrs < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return `${diffMins}m ago`
  }
  if (diffHrs < 24) return `${diffHrs}h ago`

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatPhone(phone: string): string {
  if (!phone || phone === "Unknown") return "Unknown"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

const tempColors: Record<string, string> = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-orange-100 text-orange-700",
  cold: "bg-blue-100 text-blue-700",
}

const statusColors: Record<string, string> = {
  ended: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  ongoing: "bg-yellow-100 text-yellow-700",
}

export function CallsClient({ calls }: { calls: EnrichedCall[] }) {
  const [filter, setFilter] = useState<"all" | "inbound">("all")
  const [callingId, setCallingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const filtered = filter === "inbound" ? calls.filter((c) => c.direction === "inbound") : calls

  async function handleCallBack(call: EnrichedCall) {
    setCallingId(call.call_id)
    try {
      const res = await fetch("/api/pipeline/call-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: call.lead_id || undefined,
          leadPhone: call.caller_phone,
          leadName: call.lead_name || "Unknown Caller",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`Call failed: ${data.error}`)
      }
    } catch (err) {
      alert(`Call failed: ${err}`)
    } finally {
      setCallingId(null)
    }
  }

  const [creatingLeadId, setCreatingLeadId] = useState<string | null>(null)

  async function handleCreateLead(call: EnrichedCall) {
    setCreatingLeadId(call.call_id)
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: call.lead_name?.split(" ")[0] || "Inbound",
          last_name: call.lead_name?.split(" ").slice(1).join(" ") || "Caller",
          phone: call.caller_phone,
          email: "",
          source: "inbound_call",
          vertical_slug: "real-estate",
        }),
      })
      const result = await res.json()
      if (result.lead_id || result.success) {
        window.location.href = `/admin/leads/${result.lead_id}`
      } else if (result.duplicate && result.lead_id) {
        window.location.href = `/admin/leads/${result.lead_id}`
      } else {
        alert("Failed to create lead: " + (result.error || "Unknown error"))
      }
    } catch (err) {
      alert("Error creating lead: " + String(err))
    } finally {
      setCreatingLeadId(null)
    }
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            filter === "all"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          All Calls
        </button>
        <button
          onClick={() => setFilter("inbound")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            filter === "inbound"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          Inbound Only
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No calls in the last 48 hours
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Caller</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Temp</th>
                    <th className="px-4 py-3 min-w-[200px]">Summary</th>
                    <th className="px-4 py-3">Recording</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((call) => (
                    <tr key={call.call_id} className="hover:bg-gray-50 transition">
                      {/* Caller */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {call.lead_name || "Unknown Caller"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatPhone(call.caller_phone)}
                          </span>
                          {call.score !== null && (
                            <span className="text-xs text-gray-400">
                              Score: {call.score}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Direction */}
                      <td className="px-4 py-3">
                        {call.direction === "inbound" ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <PhoneIncoming className="h-3.5 w-3.5" />
                            In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <PhoneOutgoing className="h-3.5 w-3.5" />
                            Out
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {formatDuration(call.duration_seconds)}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 text-gray-500">
                        {formatTimestamp(call.timestamp)}
                      </td>

                      {/* Temperature */}
                      <td className="px-4 py-3">
                        {call.temperature ? (
                          <Badge
                            variant="secondary"
                            className={tempColors[call.temperature] || ""}
                          >
                            {call.temperature}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>

                      {/* Summary */}
                      <td className="px-4 py-3 text-gray-600 max-w-[300px]">
                        <p className="truncate">
                          {call.summary || <span className="text-gray-300">No summary</span>}
                        </p>
                      </td>

                      {/* Recording */}
                      <td className="px-4 py-3">
                        {call.recording_url ? (
                          <div className="flex flex-col gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setPlayingId(playingId === call.call_id ? null : call.call_id)}
                            >
                              {playingId === call.call_id ? (
                                <Pause className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Play className="h-4 w-4 text-gray-600" />
                              )}
                            </Button>
                            {playingId === call.call_id && (
                              <audio
                                src={call.recording_url}
                                controls
                                autoPlay
                                className="w-48 h-8"
                                onEnded={() => setPlayingId(null)}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">&mdash;</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={statusColors[call.call_status] || "bg-gray-100 text-gray-600"}
                        >
                          {call.call_status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={callingId === call.call_id || call.caller_phone === "Unknown"}
                            onClick={() => handleCallBack(call)}
                          >
                            {callingId === call.call_id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <PhoneCall className="mr-1 h-3 w-3" />
                            )}
                            Call Back
                          </Button>

                          {!call.lead_id && call.caller_phone !== "Unknown" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => handleCreateLead(call)}
                              disabled={creatingLeadId === call.call_id}
                            >
                              {creatingLeadId === call.call_id ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <UserPlus className="mr-1 h-3 w-3" />
                              )}
                              {creatingLeadId === call.call_id ? "Creating..." : "Create Lead"}
                            </Button>
                          )}

                          {call.lead_id && (
                            <a
                              href={`/admin/leads/${call.lead_id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View Lead
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
