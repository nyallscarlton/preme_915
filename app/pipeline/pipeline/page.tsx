"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Phone, Clock, Flame, Thermometer, Snowflake } from "lucide-react"

interface Lead {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  status: string
  temperature: string | null
  score: number | null
  source: string | null
  created_at: string
  updated_at: string
}

const PIPELINE_STAGES = [
  { key: "new", label: "New", color: "border-blue-400", bg: "bg-blue-50" },
  { key: "contacting", label: "Contacting", color: "border-indigo-400", bg: "bg-indigo-50" },
  { key: "contacted", label: "Contacted", color: "border-purple-400", bg: "bg-purple-50" },
  { key: "qualified", label: "Qualified", color: "border-green-400", bg: "bg-green-50" },
  { key: "application", label: "Application", color: "border-amber-400", bg: "bg-amber-50" },
  { key: "processing", label: "Processing", color: "border-orange-400", bg: "bg-orange-50" },
  { key: "closed_won", label: "Closed Won", color: "border-emerald-400", bg: "bg-emerald-50" },
]

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads?limit=200")
    if (res.ok) {
      const data = await res.json()
      setLeads(data.leads || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  async function moveToStage(leadId: string, newStatus: string) {
    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus } : l))

    await fetch(`/api/pipeline/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  function handleDragStart(e: React.DragEvent, leadId: string) {
    setDraggedId(leadId)
    e.dataTransfer.effectAllowed = "move"
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault()
    if (draggedId) {
      moveToStage(draggedId, status)
      setDraggedId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        <div className="text-sm text-gray-500">
          {leads.length} total leads &middot; Drag cards to move stages
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 200px)" }}>
        {PIPELINE_STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.status === stage.key)
          return (
            <div
              key={stage.key}
              className={`flex w-64 shrink-0 flex-col rounded-xl border-t-4 ${stage.color} bg-white`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="text-sm font-semibold text-gray-700">{stage.label}</h3>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${stage.bg} text-gray-700`}>
                  {stageLeads.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onDragStart={handleDragStart}
                  />
                ))}
                {stageLeads.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
                    Drop leads here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LeadCard({
  lead,
  onDragStart,
}: {
  lead: Lead
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  const tempIcon = lead.temperature === "hot"
    ? <Flame className="h-3 w-3 text-red-500" />
    : lead.temperature === "warm"
    ? <Thermometer className="h-3 w-3 text-orange-500" />
    : <Snowflake className="h-3 w-3 text-blue-400" />

  const daysSince = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      className="cursor-grab rounded-lg border bg-white p-3 shadow-sm hover:shadow-md transition active:cursor-grabbing"
    >
      <Link href={`/admin/leads/${lead.id}`} className="block">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 truncate">
            {lead.first_name} {lead.last_name}
          </p>
          {tempIcon}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <Phone className="h-3 w-3" />
          <span className="truncate">{lead.phone}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          {lead.score ? (
            <span className="text-gray-500">Score: {lead.score}</span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 text-gray-400">
            <Clock className="h-3 w-3" />
            {daysSince === 0 ? "Today" : `${daysSince}d ago`}
          </span>
        </div>
      </Link>
    </div>
  )
}
