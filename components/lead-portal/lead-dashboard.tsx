"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Phone,
  MessageSquare,
  Flame,
  Clock,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  ArrowUpDown,
  UserPlus,
  Sparkles,
  Skull,
  Mail,
  ExternalLink,
  Trash2,
  ArrowLeftRight,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import { PortalToggle } from "@/components/portal-toggle"
import { LeadDetail } from "@/components/lead-portal/lead-detail"

/** Map raw source + UTM data to a human-readable channel label */
function formatLeadSource(lead: Lead): string {
  const src = (lead.utm_source || "").toLowerCase()
  const med = (lead.utm_medium || "").toLowerCase()
  const raw = (lead.source || "").toLowerCase()

  // Google Ads
  if (src === "google" || src === "gclid" || raw.includes("google")) {
    if (med === "cpc" || med === "ppc" || med === "paid") {
      if (raw.includes("phone") || raw.includes("call") || raw === "retell_voice") return "Google Ads (Phone)"
      return "Google Ads (Form)"
    }
    return "Google (Organic)"
  }

  // Facebook / Meta Ads
  if (src === "facebook" || src === "fb" || src === "meta" || src === "ig" || raw.includes("facebook")) {
    if (med === "cpc" || med === "paid" || med === "social_paid") {
      if (raw.includes("phone") || raw.includes("call") || raw === "retell_voice") return "Facebook Ads (Phone)"
      return "Facebook Ads (Form)"
    }
    return "Facebook (Organic)"
  }

  // Voice / Phone calls
  if (raw === "retell_voice" || raw.includes("voice") || raw.includes("phone") || raw.includes("call")) {
    return "Phone Call (Inbound)"
  }

  // Landing pages
  if (raw.startsWith("landing:") || raw.includes("landing")) {
    const page = raw.replace("landing:", "").replace(/-/g, " ")
    if (src) return `${src} → ${page}`
    return `Landing Page (${page})`
  }

  // Zentryx
  if (raw === "zentryx") return "Zentryx (Qualified)"

  // Website / Contact form
  if (raw === "website" || raw === "contact") return "Website (Form)"

  // Referral
  if (raw.includes("referral") || src === "referral") return "Referral"

  // Default
  if (raw) return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return "Unknown"
}

export interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  loan_type: string | null
  loan_amount: number | null
  message: string | null
  source: string | null
  status: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  retell_call_id: string | null
  call_transcript: string | null
  call_recording_url: string | null
  call_summary: string | null
  qualification_data: Record<string, any> | null
  created_at: string
  updated_at: string | null
}

type SortField = "created_at" | "status" | "last_name"
type SortDirection = "asc" | "desc"

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-600 text-white" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-600 text-black" },
  { value: "qualified", label: "Qualified", color: "bg-emerald-600 text-white" },
  { value: "nurturing", label: "Nurturing", color: "bg-purple-600 text-white" },
  { value: "converted", label: "Converted", color: "bg-green-600 text-white" },
  { value: "dead", label: "Dead", color: "bg-gray-600 text-white" },
] as const

const SOURCE_OPTIONS = [
  { value: "google_ads", label: "Google Ads" },
  { value: "facebook_ads", label: "Facebook Ads" },
  { value: "phone", label: "Phone Call" },
  { value: "website", label: "Website (Form)" },
  { value: "organic", label: "Organic" },
  { value: "referral", label: "Referral" },
  { value: "zentryx", label: "Zentryx" },
  { value: "other", label: "Other" },
]

function getStatusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status)
  return opt || { value: status, label: status, color: "bg-gray-600 text-white" }
}

function getTemperature(lead: Lead): { label: string; color: string; score: number } {
  let score = 0

  // Recency boost
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceCreated <= 1) score += 30
  else if (daysSinceCreated <= 3) score += 20
  else if (daysSinceCreated <= 7) score += 10

  // Data completeness
  if (lead.phone) score += 15
  if (lead.email) score += 10
  if (lead.loan_type) score += 10
  if (lead.loan_amount) score += 10

  // Engagement signals
  if (lead.call_transcript) score += 15
  if (lead.retell_call_id) score += 10
  if (lead.message) score += 5

  // Status-based
  if (lead.status === "qualified") score += 20
  if (lead.status === "contacted") score += 10
  if (lead.status === "dead") score = Math.min(score, 10)

  if (score >= 60) return { label: "Hot", color: "text-red-500", score }
  if (score >= 35) return { label: "Warm", color: "text-orange-400", score }
  return { label: "Cold", color: "text-blue-400", score }
}

function formatPhone(phone: string | null): string {
  if (!phone) return "-"
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function LeadDashboard() {
  const { user, signOut } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [tempFilter, setTempFilter] = useState<string>("all")

  // Sort
  const [sortField, setSortField] = useState<SortField>("created_at")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")

  // Detail view
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLeadTab, setSelectedLeadTab] = useState<string>("messages")
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/leads")
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch leads")
      }
      setLeads(data.leads || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch leads")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      setUpdatingStatus(leadId)
      try {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error)
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: newStatus, updated_at: new Date().toISOString() } : l
          )
        )
      } catch (err) {
        console.error("Failed to update status:", err)
      } finally {
        setUpdatingStatus(null)
      }
    },
    []
  )

  const handleConvert = useCallback(
    async (leadId: string) => {
      if (!confirm("Convert this lead to a loan application?")) return
      setUpdatingStatus(leadId)
      try {
        const res = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error)
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, status: "converted", updated_at: new Date().toISOString() }
              : l
          )
        )
        alert(`Application created: ${data.application_number}`)
      } catch (err: any) {
        alert(err.message || "Failed to convert lead")
      } finally {
        setUpdatingStatus(null)
      }
    },
    []
  )

  const handleDelete = useCallback(
    async (leadId: string) => {
      if (!confirm("Delete this lead permanently? This cannot be undone.")) return
      try {
        const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error)
        setLeads((prev) => prev.filter((l) => l.id !== leadId))
        if (selectedLeadId === leadId) setSelectedLeadId(null)
      } catch (err: any) {
        alert(err.message || "Failed to delete lead")
      }
    },
    [selectedLeadId]
  )

  // Filtered + sorted leads
  const filteredLeads = useMemo(() => {
    let result = [...leads]

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (l) =>
          `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.includes(q)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter)
    }

    // Source filter — match against formatted source label
    if (sourceFilter !== "all") {
      result = result.filter((l) => {
        const label = formatLeadSource(l).toLowerCase()
        return label.includes(sourceFilter.replace("_", " "))
      })
    }

    // Temperature filter
    if (tempFilter !== "all") {
      result = result.filter((l) => {
        const temp = getTemperature(l)
        return temp.label.toLowerCase() === tempFilter
      })
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      if (sortField === "created_at") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortField === "status") {
        const order = ["new", "contacted", "qualified", "nurturing", "converted", "dead"]
        cmp = order.indexOf(a.status) - order.indexOf(b.status)
      } else if (sortField === "last_name") {
        cmp = (a.last_name || "").localeCompare(b.last_name || "")
      }
      return sortDir === "desc" ? -cmp : cmp
    })

    return result
  }, [leads, searchQuery, statusFilter, sourceFilter, tempFilter, sortField, sortDir])

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return {
      total: leads.length,
      newToday: leads.filter(
        (l) => l.status === "new" && l.created_at.startsWith(today)
      ).length,
      hot: leads.filter((l) => getTemperature(l).label === "Hot").length,
      needsFollowUp: leads.filter(
        (l) =>
          l.status === "contacted" &&
          l.updated_at &&
          Date.now() - new Date(l.updated_at).getTime() > 48 * 60 * 60 * 1000
      ).length +
        leads.filter(
          (l) =>
            l.status === "new" &&
            Date.now() - new Date(l.created_at).getTime() > 24 * 60 * 60 * 1000
        ).length,
    }
  }, [leads])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="flex items-center">
                <div className="relative">
                  <span className="text-2xl font-bold tracking-wide text-foreground">
                    PR
                    <span className="relative">
                      E
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span>
                    </span>
                    ME
                  </span>
                </div>
              </Link>
              <Badge className="bg-[#997100] text-black hidden md:inline-flex">Lead Portal</Badge>
              <p className="text-sm text-muted-foreground hidden md:block">
                Welcome, {user?.firstName || user?.email}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <PortalToggle />
              <Button
                variant="outline"
                className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Lead Management</h1>
            <p className="text-muted-foreground">
              Track and manage all inbound leads from calls, forms, and campaigns
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchLeads}
            disabled={isLoading}
            className="border-border text-foreground hover:bg-muted bg-transparent"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Leads
              </CardTitle>
              <Users className="h-4 w-4 text-[#997100]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.total}
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                New Today
              </CardTitle>
              <Sparkles className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.newToday}
              </div>
              <p className="text-xs text-muted-foreground">Since midnight</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hot Leads</CardTitle>
              <Flame className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.hot}
              </div>
              <p className="text-xs text-muted-foreground">Score 60+</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Needs Follow-Up
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.needsFollowUp}
              </div>
              <p className="text-xs text-muted-foreground">Overdue contact</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or email..."
                  className="pl-10 bg-background border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-background border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px] bg-background border-border">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tempFilter} onValueChange={setTempFilter}>
                <SelectTrigger className="w-[150px] bg-background border-border">
                  <SelectValue placeholder="Temperature" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Temps</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                </SelectContent>
              </Select>

              {(searchQuery || statusFilter !== "all" || sourceFilter !== "all" || tempFilter !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                  onClick={() => {
                    setSearchQuery("")
                    setStatusFilter("all")
                    setSourceFilter("all")
                    setTempFilter("all")
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {error && (
          <div className="mb-6 bg-red-950/50 border border-red-800 text-red-300 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">Error: {error}</p>
            <Button
              variant="link"
              className="text-red-300 underline p-0 h-auto"
              onClick={fetchLeads}
            >
              Try again
            </Button>
          </div>
        )}

        {/* Lead Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg mb-2">
                  {leads.length === 0 ? "No leads yet" : "No leads match your filters"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {leads.length === 0
                    ? "Leads will appear here when people call, fill out forms, or submit info."
                    : "Try adjusting your search or filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort("last_name")}
                        >
                          Name
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                        Email
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Source
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden xl:table-cell">
                        Loan Type
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Temp
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort("status")}
                        >
                          Status
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        <button
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort("created_at")}
                        >
                          Created
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const temp = getTemperature(lead)
                      const statusBadge = getStatusBadge(lead.status)
                      const isUpdating = updatingStatus === lead.id

                      return (
                        <tr
                          key={lead.id}
                          className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {lead.first_name} {lead.last_name}
                              </p>
                              {lead.loan_amount && (
                                <p className="text-xs text-muted-foreground">
                                  ${lead.loan_amount.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                className="text-[#997100] hover:underline text-sm flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3 w-3" />
                                {formatPhone(lead.phone)}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {lead.email ? (
                              <a
                                href={`mailto:${lead.email}`}
                                className="text-sm text-muted-foreground hover:text-foreground truncate block max-w-[200px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lead.email}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-muted-foreground capitalize">
                              {formatLeadSource(lead)}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-sm text-muted-foreground capitalize">
                              {lead.loan_type?.replace(/_/g, " ") || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Flame className={`h-4 w-4 ${temp.color}`} />
                              <span className={`text-xs font-medium ${temp.color}`}>
                                {temp.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {temp.score}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={`${statusBadge.color} text-xs`}>
                              {statusBadge.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {timeAgo(lead.created_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.phone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={`border-border hover:bg-muted bg-transparent h-8 px-2 ${
                                    callingLeadId === lead.id
                                      ? "text-emerald-400 border-emerald-700"
                                      : "text-foreground"
                                  }`}
                                  disabled={callingLeadId === lead.id}
                                  onClick={async () => {
                                    setCallingLeadId(lead.id)
                                    try {
                                      const res = await fetch(`/api/leads/${lead.id}/call`, { method: "POST" })
                                      const data = await res.json()
                                      if (!res.ok || !data.success) throw new Error(data.error)
                                      // Auto-clear after 5s
                                      setTimeout(() => setCallingLeadId(null), 5000)
                                    } catch {
                                      setCallingLeadId(null)
                                    }
                                  }}
                                >
                                  {callingLeadId === lead.id ? (
                                    <Phone className="h-3.5 w-3.5 animate-pulse" />
                                  ) : (
                                    <Phone className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                              {lead.phone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-border text-foreground hover:bg-muted bg-transparent h-8 px-2"
                                  onClick={() => {
                                    setSelectedLeadTab("messages")
                                    setSelectedLeadId(lead.id)
                                  }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-border text-foreground hover:bg-muted bg-transparent h-8 px-2"
                                    disabled={isUpdating}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => setSelectedLeadId(lead.id)}
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {STATUS_OPTIONS.filter(
                                    (s) => s.value !== lead.status
                                  ).map((s) => (
                                    <DropdownMenuItem
                                      key={s.value}
                                      onClick={() => handleStatusChange(lead.id, s.value)}
                                    >
                                      <Badge
                                        className={`${s.color} text-[10px] mr-2 px-1.5 py-0`}
                                      >
                                        {s.label}
                                      </Badge>
                                      Set {s.label}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  {lead.status !== "converted" && (
                                    <DropdownMenuItem
                                      onClick={() => handleConvert(lead.id)}
                                    >
                                      <UserPlus className="h-4 w-4 mr-2 text-[#997100]" />
                                      <span className="text-[#997100] font-medium">
                                        Convert to Application
                                      </span>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(lead.id)}
                                    className="text-red-500 focus:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Lead
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Results count */}
            {!isLoading && filteredLeads.length > 0 && (
              <div className="px-4 py-3 border-t border-border text-sm text-muted-foreground">
                Showing {filteredLeads.length} of {leads.length} leads
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Lead Detail Sheet */}
      {selectedLeadId && (
        <LeadDetail
          leadId={selectedLeadId}
          onClose={() => {
            setSelectedLeadId(null)
            setSelectedLeadTab("messages")
          }}
          onStatusChange={handleStatusChange}
          onConvert={handleConvert}
          onDelete={handleDelete}
          initialTab={selectedLeadTab}
        />
      )}
    </div>
  )
}
