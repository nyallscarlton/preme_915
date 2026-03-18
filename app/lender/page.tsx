"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Eye,
  Users,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Filter,
  X,
  ArrowUpDown,
  Loader2,
  TrendingUp,
  Calendar,
  MoveRight,
  Download,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { PortalToggle } from "@/components/portal-toggle"

// --- Types ---

interface Application {
  id: string
  application_number: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  status: string
  loan_amount: number
  loan_type: string
  property_type: string
  property_address: string
  property_city: string
  property_state: string
  submitted_at: string
  created_at: string
  updated_at: string
}

type ViewMode = "list" | "pipeline"
type SortOption = "newest" | "oldest" | "highest" | "lowest"

const ALL_STATUSES = ["submitted", "under_review", "approved", "funded", "rejected", "on_hold"] as const
const PIPELINE_STATUSES = ["submitted", "under_review", "approved", "funded"] as const
const LOAN_TYPES = ["DSCR", "Conventional", "FHA", "VA", "Hard Money", "Bridge", "Commercial"]
const PROPERTY_TYPES = ["Single Family", "Multi-Family", "Condo", "Townhouse", "Commercial", "Mixed Use", "Land"]

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  submitted: { label: "Submitted", color: "bg-blue-600 text-white", bgColor: "bg-blue-600/10", borderColor: "border-blue-600" },
  under_review: { label: "Under Review", color: "bg-yellow-600 text-black", bgColor: "bg-yellow-600/10", borderColor: "border-yellow-600" },
  approved: { label: "Approved", color: "bg-green-600 text-white", bgColor: "bg-green-600/10", borderColor: "border-green-600" },
  funded: { label: "Funded", color: "bg-[#997100] text-white", bgColor: "bg-[#997100]/10", borderColor: "border-[#997100]" },
  rejected: { label: "Rejected", color: "bg-red-600 text-white", bgColor: "bg-red-600/10", borderColor: "border-red-600" },
  on_hold: { label: "On Hold", color: "bg-orange-600 text-white", bgColor: "bg-orange-600/10", borderColor: "border-orange-600" },
}

// --- Helpers ---

function daysSince(dateStr: string): number {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  start.setHours(0, 0, 0, 0)
  return new Date(dateStr) >= start
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toLocaleString()}`
}

// --- Component ---

export default function LenderDashboard() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()

  // Data
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  // View
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [loanTypeFilter, setLoanTypeFilter] = useState("all")
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [amountMin, setAmountMin] = useState("")
  const [amountMax, setAmountMax] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkTargetStatus, setBulkTargetStatus] = useState("")

  // Inline status update
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // --- Auth guard ---
  useEffect(() => {
    if (!authLoading && user && user.role !== "lender" && user.role !== "admin") {
      router.push("/dashboard")
    }
    if (!authLoading && !user) {
      router.push("/auth?next=/lender")
    }
  }, [user, authLoading, router])

  // --- Fetch data ---
  const fetchApplications = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setApplications(data)
      }
    } catch {
      // Failed to load
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  // --- Status update ---
  const updateStatus = useCallback(async (appId: string, newStatus: string) => {
    setUpdatingId(appId)
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setApplications((prev) =>
          prev.map((a) => (a.id === appId ? { ...a, status: newStatus, updated_at: new Date().toISOString() } : a))
        )
      }
    } catch {
      // Failed
    } finally {
      setUpdatingId(null)
    }
  }, [])

  // --- Bulk status update ---
  const executeBulkUpdate = useCallback(async () => {
    if (!bulkTargetStatus || selectedIds.size === 0) return
    setBulkDialogOpen(false)
    const ids = Array.from(selectedIds)
    await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: bulkTargetStatus }),
        })
      )
    )
    setApplications((prev) =>
      prev.map((a) =>
        selectedIds.has(a.id) ? { ...a, status: bulkTargetStatus, updated_at: new Date().toISOString() } : a
      )
    )
    setSelectedIds(new Set())
    setBulkTargetStatus("")
  }, [bulkTargetStatus, selectedIds])

  // --- Export ---
  const exportSelected = useCallback(() => {
    const apps = applications.filter((a) => selectedIds.has(a.id))
    if (apps.length === 0) return
    const headers = ["App #", "Name", "Email", "Loan Amount", "Loan Type", "Property", "Status", "Submitted"]
    const rows = apps.map((a) => [
      a.application_number,
      a.applicant_name,
      a.applicant_email,
      a.loan_amount,
      a.loan_type || "",
      [a.property_address, a.property_city, a.property_state].filter(Boolean).join(", "),
      a.status,
      a.submitted_at || a.created_at,
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `applications-export-${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [applications, selectedIds])

  // --- Filtering & sorting ---
  const filtered = useMemo(() => {
    let result = applications.filter((app) => {
      // Status filter
      if (statusFilters.length > 0 && !statusFilters.includes(app.status)) return false

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          app.applicant_name?.toLowerCase().includes(q) ||
          app.applicant_email?.toLowerCase().includes(q) ||
          app.application_number?.toLowerCase().includes(q) ||
          app.property_address?.toLowerCase().includes(q)
        if (!match) return false
      }

      // Loan type
      if (loanTypeFilter !== "all" && app.loan_type !== loanTypeFilter) return false

      // Property type
      if (propertyTypeFilter !== "all" && app.property_type !== propertyTypeFilter) return false

      // Date range
      if (dateFrom) {
        const submitted = new Date(app.submitted_at || app.created_at)
        if (submitted < new Date(dateFrom)) return false
      }
      if (dateTo) {
        const submitted = new Date(app.submitted_at || app.created_at)
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        if (submitted > end) return false
      }

      // Amount range
      if (amountMin && app.loan_amount < Number(amountMin)) return false
      if (amountMax && app.loan_amount > Number(amountMax)) return false

      return true
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()
        case "oldest":
          return new Date(a.submitted_at || a.created_at).getTime() - new Date(b.submitted_at || b.created_at).getTime()
        case "highest":
          return (b.loan_amount || 0) - (a.loan_amount || 0)
        case "lowest":
          return (a.loan_amount || 0) - (b.loan_amount || 0)
        default:
          return 0
      }
    })

    return result
  }, [applications, statusFilters, searchQuery, loanTypeFilter, propertyTypeFilter, dateFrom, dateTo, amountMin, amountMax, sortBy])

  // --- Stats ---
  const stats = useMemo(() => {
    const active = applications.filter((a) => !["rejected", "on_hold"].includes(a.status))
    const pipelineValue = active.reduce((sum, a) => sum + (a.loan_amount || 0), 0)
    const funded = applications.filter((a) => a.status === "funded")
    const avgDaysToClose =
      funded.length > 0
        ? Math.round(
            funded.reduce((sum, a) => {
              const start = new Date(a.submitted_at || a.created_at).getTime()
              const end = new Date(a.updated_at || a.created_at).getTime()
              return sum + (end - start) / (1000 * 60 * 60 * 24)
            }, 0) / funded.length
          )
        : 0
    const thisWeekNew = applications.filter((a) => isThisWeek(a.submitted_at || a.created_at)).length

    return {
      total: applications.length,
      submitted: applications.filter((a) => a.status === "submitted").length,
      underReview: applications.filter((a) => a.status === "under_review").length,
      approved: applications.filter((a) => a.status === "approved").length,
      funded: applications.filter((a) => a.status === "funded").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
      onHold: applications.filter((a) => a.status === "on_hold").length,
      pipelineValue,
      avgDaysToClose,
      thisWeekNew,
    }
  }, [applications])

  const pipelineChartData = [
    { name: "Submitted", count: stats.submitted, fill: "#3b82f6" },
    { name: "In Review", count: stats.underReview, fill: "#eab308" },
    { name: "Approved", count: stats.approved, fill: "#22c55e" },
    { name: "Funded", count: stats.funded, fill: "#997100" },
    { name: "Rejected", count: stats.rejected, fill: "#ef4444" },
    { name: "On Hold", count: stats.onHold, fill: "#f97316" },
  ].filter((d) => d.count > 0)

  // --- Selection helpers ---
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)))
    }
  }

  const clearFilters = () => {
    setStatusFilters([])
    setSearchQuery("")
    setLoanTypeFilter("all")
    setPropertyTypeFilter("all")
    setDateFrom("")
    setDateTo("")
    setAmountMin("")
    setAmountMax("")
    setSortBy("newest")
  }

  const hasActiveFilters =
    statusFilters.length > 0 ||
    searchQuery ||
    loanTypeFilter !== "all" ||
    propertyTypeFilter !== "all" ||
    dateFrom ||
    dateTo ||
    amountMin ||
    amountMax

  const toggleStatusFilter = (status: string) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  // --- Pipeline helpers ---
  const pipelineColumns = PIPELINE_STATUSES.map((status) => ({
    status,
    ...STATUS_CONFIG[status],
    apps: filtered.filter((a) => a.status === status),
  }))

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pipeline...</p>
        </div>
      </div>
    )
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
              <Badge variant="outline" className="border-[#997100] text-[#997100]">
                Lender Portal
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {user?.firstName} {user?.lastName}
              </span>
              <PortalToggle />
              <Button
                variant="outline"
                size="sm"
                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
                onClick={() => {
                  signOut()
                  window.location.href = "/"
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Title + view toggle */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Loan Pipeline</h1>
            <p className="text-muted-foreground">Manage loan applications and borrower activity</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={
                viewMode === "list"
                  ? "bg-[#997100] hover:bg-[#b8850a] text-black"
                  : "border-border text-muted-foreground hover:bg-muted bg-transparent"
              }
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
            <Button
              variant={viewMode === "pipeline" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("pipeline")}
              className={
                viewMode === "pipeline"
                  ? "bg-[#997100] hover:bg-[#b8850a] text-black"
                  : "border-border text-muted-foreground hover:bg-muted bg-transparent"
              }
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Pipeline
            </Button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
              <DollarSign className="h-4 w-4 text-[#997100]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.pipelineValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Active applications</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">By Status</CardTitle>
              <Users className="h-4 w-4 text-[#997100]" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {stats.submitted > 0 && (
                  <Badge className="bg-blue-600 text-white text-xs">{stats.submitted} New</Badge>
                )}
                {stats.underReview > 0 && (
                  <Badge className="bg-yellow-600 text-black text-xs">{stats.underReview} Review</Badge>
                )}
                {stats.approved > 0 && (
                  <Badge className="bg-green-600 text-white text-xs">{stats.approved} Approved</Badge>
                )}
                {stats.funded > 0 && (
                  <Badge className="bg-[#997100] text-white text-xs">{stats.funded} Funded</Badge>
                )}
                {stats.total === 0 && <span className="text-sm text-muted-foreground">No applications</span>}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Days to Close</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgDaysToClose || "—"}</div>
              <p className="text-xs text-muted-foreground mt-1">Funded applications</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisWeekNew}</div>
              <p className="text-xs text-muted-foreground mt-1">New submissions</p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Section */}
        <Card className="bg-card border-border mb-8">
          <CardHeader className="cursor-pointer" onClick={() => setAnalyticsOpen(!analyticsOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">Pipeline Analytics</CardTitle>
              {analyticsOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {analyticsOpen && (
            <CardContent>
              {pipelineChartData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No application data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={pipelineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                      {pipelineChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          )}
        </Card>

        {/* Filter Bar */}
        <div className="space-y-4 mb-6">
          {/* Primary row: search, sort, filter toggle */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, app #, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card border-border"
              />
            </div>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-44 bg-card border-border">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Amount</SelectItem>
                <SelectItem value="lowest">Lowest Amount</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-border hover:bg-muted bg-transparent ${showFilters ? "text-[#997100] border-[#997100]" : "text-muted-foreground"}`}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {hasActiveFilters && (
                <Badge className="ml-1.5 bg-[#997100] text-black text-[10px] px-1.5 py-0">
                  {[statusFilters.length > 0, loanTypeFilter !== "all", propertyTypeFilter !== "all", dateFrom, dateTo, amountMin, amountMax].filter(Boolean).length}
                </Badge>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {filtered.length} of {applications.length} applications
            </span>
          </div>

          {/* Advanced filters row */}
          {showFilters && (
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Status checkboxes */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Status</p>
                    <div className="space-y-2">
                      {ALL_STATUSES.map((status) => (
                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={statusFilters.includes(status)}
                            onCheckedChange={() => toggleStatusFilter(status)}
                          />
                          <Badge className={`${STATUS_CONFIG[status].color} text-xs`}>
                            {STATUS_CONFIG[status].label}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Loan & Property type */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Loan Type</p>
                      <Select value={loanTypeFilter} onValueChange={setLoanTypeFilter}>
                        <SelectTrigger className="bg-card border-border">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {LOAN_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Property Type</p>
                      <Select value={propertyTypeFilter} onValueChange={setPropertyTypeFilter}>
                        <SelectTrigger className="bg-card border-border">
                          <SelectValue placeholder="All properties" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Properties</SelectItem>
                          {PROPERTY_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Date range */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Submitted Date</p>
                    <div className="space-y-2">
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="bg-card border-border"
                        placeholder="From"
                      />
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="bg-card border-border"
                        placeholder="To"
                      />
                    </div>
                  </div>

                  {/* Amount range */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Loan Amount</p>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        placeholder="Min ($)"
                        value={amountMin}
                        onChange={(e) => setAmountMin(e.target.value)}
                        className="bg-card border-border"
                      />
                      <Input
                        type="number"
                        placeholder="Max ($)"
                        value={amountMax}
                        onChange={(e) => setAmountMax(e.target.value)}
                        className="bg-card border-border"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {viewMode === "list" && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-[#997100]/10 border border-[#997100]/30 rounded-lg">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="bg-[#997100] hover:bg-[#b8850a] text-black">
                    <MoveRight className="h-4 w-4 mr-1" />
                    Move to...
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {ALL_STATUSES.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => {
                        setBulkTargetStatus(status)
                        setBulkDialogOpen(true)
                      }}
                    >
                      <Badge className={`${STATUS_CONFIG[status].color} text-xs mr-2`}>
                        {STATUS_CONFIG[status].label}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={exportSelected}
                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Bulk Confirmation Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Confirm Bulk Status Change</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                You are about to change the status of{" "}
                <span className="font-semibold text-foreground">{selectedIds.size} application{selectedIds.size > 1 ? "s" : ""}</span>{" "}
                to{" "}
                <Badge className={`${STATUS_CONFIG[bulkTargetStatus]?.color || ""} text-xs`}>
                  {STATUS_CONFIG[bulkTargetStatus]?.label || bulkTargetStatus}
                </Badge>
                . This will notify borrowers via email. This action cannot be undone easily.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkDialogOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={executeBulkUpdate}
                className="bg-[#997100] hover:bg-[#b8850a] text-black"
              >
                Confirm Change
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* === PIPELINE VIEW === */}
        {viewMode === "pipeline" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pipelineColumns.map((col) => (
              <div key={col.status} className="flex flex-col">
                {/* Column header */}
                <div className={`flex items-center justify-between p-3 rounded-t-lg border-t-2 ${col.borderColor} ${col.bgColor}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                    <Badge variant="outline" className="text-xs border-border">
                      {col.apps.length}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(col.apps.reduce((s, a) => s + (a.loan_amount || 0), 0))}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-3 p-2 bg-muted/30 rounded-b-lg border border-t-0 border-border min-h-[200px]">
                  {col.apps.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No applications</p>
                  )}
                  {col.apps.map((app) => (
                    <Card key={app.id} className="bg-card border-border hover:border-[#997100]/50 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-medium text-sm text-foreground truncate max-w-[140px]">
                            {app.applicant_name}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {daysSince(app.updated_at || app.submitted_at || app.created_at)}d
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-[#997100] mb-1">
                          ${(app.loan_amount || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mb-3">
                          {[app.property_address, app.property_city].filter(Boolean).join(", ") || "No address"}
                        </p>
                        {app.loan_type && (
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{app.loan_type}</p>
                        )}

                        {/* Actions row */}
                        <div className="flex items-center gap-1.5">
                          {/* Move status buttons */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-border text-muted-foreground hover:bg-muted bg-transparent flex-1"
                                disabled={updatingId === app.id}
                              >
                                {updatingId === app.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <MoveRight className="h-3 w-3 mr-1" />
                                    Move
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {ALL_STATUSES.filter((s) => s !== app.status).map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() => updateStatus(app.id, status)}
                                >
                                  <Badge className={`${STATUS_CONFIG[status].color} text-xs mr-2`}>
                                    {STATUS_CONFIG[status].label}
                                  </Badge>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                            <Link href={`/lender/${app.id}`}>
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* === LIST VIEW === */}
        {viewMode === "list" && (
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="p-4 w-10">
                        <Checkbox
                          checked={filtered.length > 0 && selectedIds.size === filtered.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Application</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Borrower</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Property</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          No applications found
                        </td>
                      </tr>
                    ) : (
                      filtered.map((app) => (
                        <tr
                          key={app.id}
                          className={`border-b border-border hover:bg-muted/50 ${selectedIds.has(app.id) ? "bg-[#997100]/5" : ""}`}
                        >
                          <td className="p-4">
                            <Checkbox
                              checked={selectedIds.has(app.id)}
                              onCheckedChange={() => toggleSelect(app.id)}
                            />
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-foreground text-sm">{app.application_number}</p>
                            <p className="text-xs text-muted-foreground">{app.loan_type || "—"}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm text-foreground">{app.applicant_name}</p>
                            <p className="text-xs text-muted-foreground">{app.applicant_email}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-medium text-foreground">
                              ${(app.loan_amount || 0).toLocaleString()}
                            </p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm text-foreground truncate max-w-[200px]">
                              {[app.property_address, app.property_city, app.property_state]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </p>
                          </td>
                          <td className="p-4">
                            {/* Inline status dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#997100] focus:ring-offset-1 rounded"
                                  disabled={updatingId === app.id}
                                >
                                  {updatingId === app.id ? (
                                    <Badge className="bg-muted text-muted-foreground">
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      Updating...
                                    </Badge>
                                  ) : (
                                    <Badge className={`${STATUS_CONFIG[app.status]?.color || "bg-gray-600 text-white"} hover:opacity-80 transition-opacity`}>
                                      {STATUS_CONFIG[app.status]?.label || app.status}
                                      <ChevronDown className="h-3 w-3 ml-1" />
                                    </Badge>
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {ALL_STATUSES.filter((s) => s !== app.status).map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={() => updateStatus(app.id, status)}
                                    className="cursor-pointer"
                                  >
                                    <Badge className={`${STATUS_CONFIG[status].color} text-xs mr-2`}>
                                      {STATUS_CONFIG[status].label}
                                    </Badge>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {app.submitted_at
                              ? new Date(app.submitted_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/lender/${app.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
