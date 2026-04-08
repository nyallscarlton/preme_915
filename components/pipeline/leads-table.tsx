"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, ExternalLink, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react"
import Link from "next/link"

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  calling: "bg-yellow-100 text-yellow-800",
  contacted: "bg-purple-100 text-purple-800",
  qualified: "bg-green-100 text-green-800",
  handed_off: "bg-emerald-100 text-emerald-800",
  converted: "bg-teal-100 text-teal-800",
  dead: "bg-gray-100 text-gray-800",
}

const temperatureColors: Record<string, string> = {
  hot: "bg-red-100 text-red-800",
  warm: "bg-orange-100 text-orange-800",
  cold: "bg-blue-100 text-blue-800",
}

interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: string
  temperature: string | null
  score: number | null
  source: string | null
  custom_fields: Record<string, unknown>
  handoff_status: string | null
  retell_summary: string | null
  created_at: string
  zx_verticals?: { slug: string; name: string } | null
  zx_buyers?: { name: string } | null
}

interface Props {
  leads: Lead[]
  verticals: { slug: string; name: string }[]
  burnedCallLeadIds?: string[]
}

export function LeadsTable({ leads, verticals, burnedCallLeadIds = [] }: Props) {
  const burnedSet = useMemo(() => new Set(burnedCallLeadIds), [burnedCallLeadIds])
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [verticalFilter, setVerticalFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = leads.filter((lead) => {
    if (statusFilter !== "all" && lead.status !== statusFilter) return false
    if (verticalFilter !== "all" && lead.zx_verticals?.slug !== verticalFilter) return false
    return true
  })

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-4 border-b p-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="calling">Calling</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="handed_off">Handed Off</option>
          <option value="converted">Converted</option>
          <option value="not_qualified">Not Qualified</option>
          <option value="dead">Dead</option>
          <option value="contacting">Contacting</option>
          <option value="application">Application</option>
          <option value="processing">Processing</option>
          <option value="closed_won">Closed Won</option>
          <option value="closed_lost">Closed Lost</option>
        </select>

        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          <option value="all">All Verticals</option>
          {verticals.map((v) => (
            <option key={v.slug} value={v.slug}>{v.name}</option>
          ))}
        </select>

        <span className="ml-auto text-sm text-gray-400 self-center">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Vertical</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Handoff</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  No leads found
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <>
                  <tr
                    key={lead.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/admin/leads/${lead.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600">
                      <div className="flex items-center gap-1.5">
                        {lead.first_name} {lead.last_name}
                        {burnedSet.has(lead.id) && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 border border-red-200"
                            title="Last call was from a burned number -- re-contact from a clean number"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Burned #
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <a href={`mailto:${lead.email}`} className="text-gray-500 hover:text-blue-600">
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                        <a href={`tel:${lead.phone}`} className="text-gray-500 hover:text-blue-600">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {lead.zx_verticals?.name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[lead.status] || "bg-gray-100"}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.temperature ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${temperatureColors[lead.temperature] || ""}`}>
                          {lead.temperature}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{lead.source || "-"}</td>
                    <td className="px-4 py-3">
                      {lead.handoff_status ? (
                        <span className="text-xs text-gray-500">{lead.handoff_status}</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(lead.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
