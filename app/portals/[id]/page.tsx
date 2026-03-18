"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Building2,
  DollarSign,
  FileWarning,
  CheckCircle,
  Clock,
  AlertTriangle,
  MapPin,
  User,
  Calendar,
  Plus,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Loan {
  id: string
  loan_number: string
  borrower_name: string | null
  property_address: string | null
  lender: string
  loan_amount: number | null
  loan_type: string | null
  loan_program: string | null
  closing_date: string | null
  status: string
  conditions_total: number
  conditions_open: number
  conditions_closed: number
  created_at: string
  updated_at: string
}

interface Condition {
  id: string
  loan_id: string
  external_id: string | null
  lender: string
  condition_type: string | null
  title: string
  description: string | null
  description_details: string | null
  category: string | null
  prior_to: string | null
  status: string
  sub_status: string | null
  action_owner: string | null
  action_owner_name: string | null
  priority: string
  is_blocking: boolean
  action_summary: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

function getConditionStatusColor(status: string): string {
  switch (status) {
    case "Open":
      return "bg-yellow-100 text-yellow-800"
    case "Received":
      return "bg-blue-100 text-blue-800"
    case "Cleared":
    case "Closed":
      return "bg-green-100 text-green-800"
    case "Waived":
      return "bg-gray-100 text-gray-600"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-600 text-white"
    case "high":
      return "bg-orange-500 text-white"
    case "normal":
      return "bg-gray-200 text-gray-700"
    case "low":
      return "bg-gray-100 text-gray-500"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

function getActionOwnerLabel(owner: string | null): string {
  switch (owner) {
    case "broker":
      return "Broker"
    case "title_company":
      return "Title Company"
    case "lender_internal":
      return "Lender"
    case "insurance_agent":
      return "Insurance"
    case "closing_auto":
      return "Auto at Closing"
    case "other":
      return "Other"
    default:
      return "--"
  }
}

function getLoanStatusColor(status: string): string {
  switch (status) {
    case "Active":
      return "bg-[#fff5e1] text-[#7a4a00]"
    case "Closed":
      return "bg-green-100 text-green-800"
    case "Cancelled":
    case "Suspended":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalLoanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const loanId = params.id as string

  const [loan, setLoan] = useState<Loan | null>(null)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "conditions" | "add">("overview")
  const [statusFilter, setStatusFilter] = useState("all")
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  // Edit loan fields
  const [editingLoan, setEditingLoan] = useState(false)
  const [editForm, setEditForm] = useState({
    borrower_name: "",
    property_address: "",
    loan_amount: "",
    loan_type: "",
    loan_program: "",
    closing_date: "",
  })

  // Add condition form
  const [newCondition, setNewCondition] = useState({
    title: "",
    description: "",
    priority: "normal",
    action_owner: "",
    prior_to: "",
    is_blocking: false,
  })
  const [addingCondition, setAddingCondition] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?next=/portals")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()

        const [loanRes, conditionsRes] = await Promise.all([
          supabase.from("loans").select("*").eq("id", loanId).single(),
          supabase
            .from("loan_conditions")
            .select("*")
            .eq("loan_id", loanId)
            .order("priority", { ascending: true })
            .order("created_at", { ascending: false }),
        ])

        if (loanRes.data) {
          setLoan(loanRes.data)
          setEditForm({
            borrower_name: loanRes.data.borrower_name || "",
            property_address: loanRes.data.property_address || "",
            loan_amount: loanRes.data.loan_amount?.toString() || "",
            loan_type: loanRes.data.loan_type || "",
            loan_program: loanRes.data.loan_program || "",
            closing_date: loanRes.data.closing_date || "",
          })
        }
        if (conditionsRes.data) {
          setConditions(conditionsRes.data)
        }
      } catch {
        // Failed
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [loanId])

  const handleUpdateLoanStatus = async (newStatus: string) => {
    if (!loan) return
    const supabase = createClient()
    const { error } = await supabase
      .from("loans")
      .update({ status: newStatus })
      .eq("id", loan.id)

    if (!error) {
      setLoan({ ...loan, status: newStatus })
    }
  }

  const handleSaveLoanDetails = async () => {
    if (!loan) return
    const supabase = createClient()
    const { error } = await supabase
      .from("loans")
      .update({
        borrower_name: editForm.borrower_name || null,
        property_address: editForm.property_address || null,
        loan_amount: editForm.loan_amount ? parseFloat(editForm.loan_amount) : null,
        loan_type: editForm.loan_type || null,
        loan_program: editForm.loan_program || null,
        closing_date: editForm.closing_date || null,
      })
      .eq("id", loan.id)

    if (!error) {
      setLoan({
        ...loan,
        borrower_name: editForm.borrower_name || null,
        property_address: editForm.property_address || null,
        loan_amount: editForm.loan_amount ? parseFloat(editForm.loan_amount) : null,
        loan_type: editForm.loan_type || null,
        loan_program: editForm.loan_program || null,
        closing_date: editForm.closing_date || null,
      })
      setEditingLoan(false)
    }
  }

  const handleUpdateConditionStatus = async (conditionId: string, newStatus: string) => {
    setUpdatingStatus(conditionId)
    const supabase = createClient()
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === "Cleared") updates.cleared_date = new Date().toISOString()
    if (newStatus === "Received") updates.received_date = new Date().toISOString()
    if (newStatus === "Waived") updates.waived_date = new Date().toISOString()

    const { error } = await supabase
      .from("loan_conditions")
      .update(updates)
      .eq("id", conditionId)

    if (!error) {
      setConditions((prev) =>
        prev.map((c) => (c.id === conditionId ? { ...c, status: newStatus } : c))
      )
      // Recalculate loan counts
      if (loan) {
        const updatedConditions = conditions.map((c) =>
          c.id === conditionId ? { ...c, status: newStatus } : c
        )
        const openCount = updatedConditions.filter((c) => c.status === "Open").length
        const closedCount = updatedConditions.filter((c) =>
          ["Cleared", "Closed", "Waived"].includes(c.status)
        ).length
        setLoan({
          ...loan,
          conditions_open: openCount,
          conditions_closed: closedCount,
        })
      }
    }
    setUpdatingStatus(null)
  }

  const handleAddCondition = async () => {
    if (!loan || !newCondition.title.trim()) return
    setAddingCondition(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from("loan_conditions")
      .insert({
        loan_id: loan.id,
        lender: loan.lender,
        title: newCondition.title.trim(),
        description: newCondition.description.trim() || null,
        priority: newCondition.priority,
        action_owner: newCondition.action_owner || null,
        prior_to: newCondition.prior_to || null,
        is_blocking: newCondition.is_blocking,
        status: "Open",
        source: "manual",
      })
      .select()
      .single()

    if (!error && data) {
      setConditions((prev) => [data, ...prev])
      if (loan) {
        setLoan({
          ...loan,
          conditions_total: loan.conditions_total + 1,
          conditions_open: loan.conditions_open + 1,
        })
      }
      setNewCondition({
        title: "",
        description: "",
        priority: "normal",
        action_owner: "",
        prior_to: "",
        is_blocking: false,
      })
      setActiveTab("conditions")
    }
    setAddingCondition(false)
  }

  // Filter conditions
  const filteredConditions =
    statusFilter === "all"
      ? conditions
      : conditions.filter((c) => c.status === statusFilter)

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading loan details...</p>
        </div>
      </div>
    )
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loan not found</h2>
          <Button asChild variant="outline">
            <Link href="/portals">Back to Portals</Link>
          </Button>
        </div>
      </div>
    )
  }

  const closeDays = loan.closing_date
    ? Math.ceil((new Date(loan.closing_date).getTime() - Date.now()) / (24 * 60 * 60_000))
    : null
  const pct =
    loan.conditions_total > 0
      ? Math.round((loan.conditions_closed / loan.conditions_total) * 100)
      : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portals">
                <ArrowLeft className="h-4 w-4 mr-1" />
                All Portals
              </Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-mono text-sm font-semibold">{loan.loan_number}</span>
            <Badge variant="outline" className="border-[#997100] text-[#997100]">
              {loan.lender}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" asChild>
              <Link href="/conditions">
                Conditions Tracker
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-6">
        {/* Loan Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {loan.loan_number}
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getLoanStatusColor(loan.status)}`}>
                {loan.status}
              </span>
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {loan.borrower_name && (
                <span className="flex items-center gap-1">
                  <User size={14} /> {loan.borrower_name}
                </span>
              )}
              {loan.property_address && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} /> {loan.property_address}
                </span>
              )}
              {loan.loan_amount && (
                <span className="flex items-center gap-1">
                  <DollarSign size={14} /> {formatCurrency(loan.loan_amount)}
                </span>
              )}
              {loan.closing_date && (
                <span className={`flex items-center gap-1 ${closeDays !== null && closeDays <= 7 ? "text-red-600 font-semibold" : ""}`}>
                  <Calendar size={14} />
                  Closing: {new Date(loan.closing_date).toLocaleDateString()}
                  {closeDays !== null && ` (${closeDays <= 0 ? "PAST DUE" : closeDays + "d"})`}
                </span>
              )}
            </div>
          </div>

          {/* Status buttons */}
          <div className="flex gap-2">
            {["Active", "Closed", "Suspended", "Cancelled"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={loan.status === s ? "default" : "outline"}
                className={
                  loan.status === s
                    ? "bg-[#997100] hover:bg-[#b8850a] text-white"
                    : "border-border text-muted-foreground hover:bg-muted"
                }
                disabled={loan.status === s}
                onClick={() => handleUpdateLoanStatus(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Conditions Progress</span>
              <span className="text-sm text-muted-foreground">
                {loan.conditions_closed} / {loan.conditions_total} cleared ({pct}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-[#997100]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileWarning size={12} className="text-[#997100]" />
                {loan.conditions_open} open
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle size={12} className="text-green-500" />
                {loan.conditions_closed} cleared
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle size={12} className="text-red-500" />
                {conditions.filter((c) => c.is_blocking && c.status === "Open").length} blocking
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {[
            { key: "overview", label: "Loan Details" },
            { key: "conditions", label: `Conditions (${conditions.length})` },
            { key: "add", label: "Add Condition" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#997100] text-[#997100]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Loan Information</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (editingLoan) handleSaveLoanDetails()
                    else setEditingLoan(true)
                  }}
                >
                  {editingLoan ? "Save" : "Edit"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingLoan ? (
                  <>
                    <div className="space-y-2">
                      <Label>Borrower Name</Label>
                      <Input
                        value={editForm.borrower_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, borrower_name: e.target.value }))}
                        placeholder="Enter borrower name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Property Address</Label>
                      <Input
                        value={editForm.property_address}
                        onChange={(e) => setEditForm((f) => ({ ...f, property_address: e.target.value }))}
                        placeholder="Enter property address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loan Amount</Label>
                      <Input
                        type="number"
                        value={editForm.loan_amount}
                        onChange={(e) => setEditForm((f) => ({ ...f, loan_amount: e.target.value }))}
                        placeholder="Enter loan amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loan Type</Label>
                      <Input
                        value={editForm.loan_type}
                        onChange={(e) => setEditForm((f) => ({ ...f, loan_type: e.target.value }))}
                        placeholder="e.g., DSCR, Commercial"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Loan Program</Label>
                      <Input
                        value={editForm.loan_program}
                        onChange={(e) => setEditForm((f) => ({ ...f, loan_program: e.target.value }))}
                        placeholder="e.g., 30yr Fixed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Closing Date</Label>
                      <Input
                        type="date"
                        value={editForm.closing_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, closing_date: e.target.value }))}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingLoan(false)}
                      className="text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loan Number</span>
                      <span className="font-mono font-medium">{loan.loan_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lender</span>
                      <span className="font-medium">{loan.lender}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Borrower</span>
                      <span className="font-medium">{loan.borrower_name || "--"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Property</span>
                      <span className="font-medium text-right max-w-[200px]">{loan.property_address || "--"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{loan.loan_amount ? formatCurrency(loan.loan_amount) : "--"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{loan.loan_type || "--"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Program</span>
                      <span className="font-medium">{loan.loan_program || "--"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closing Date</span>
                      <span className="font-medium">
                        {loan.closing_date ? new Date(loan.closing_date).toLocaleDateString() : "--"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">{new Date(loan.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Conditions Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{loan.conditions_total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-[#997100]">{loan.conditions_open}</p>
                    <p className="text-xs text-muted-foreground">Open</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{loan.conditions_closed}</p>
                    <p className="text-xs text-muted-foreground">Cleared</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {conditions.filter((c) => c.is_blocking && c.status === "Open").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Blocking</p>
                  </div>
                </div>

                {/* Breakdown by action owner */}
                <div>
                  <p className="text-sm font-medium mb-2">Open by Owner</p>
                  <div className="space-y-2">
                    {(() => {
                      const openConditions = conditions.filter((c) => c.status === "Open")
                      const owners = new Map<string, number>()
                      for (const c of openConditions) {
                        const key = c.action_owner || "unassigned"
                        owners.set(key, (owners.get(key) || 0) + 1)
                      }
                      return Array.from(owners.entries())
                        .sort((a, b) => b[1] - a[1])
                        .map(([owner, count]) => (
                          <div key={owner} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{getActionOwnerLabel(owner === "unassigned" ? null : owner)}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))
                    })()}
                  </div>
                </div>

                <Button
                  className="w-full bg-[#997100] hover:bg-[#b8850a] text-white"
                  onClick={() => setActiveTab("conditions")}
                >
                  View All Conditions
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "conditions" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Received">Received</SelectItem>
                  <SelectItem value="Cleared">Cleared</SelectItem>
                  <SelectItem value="Waived">Waived</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {filteredConditions.length} condition{filteredConditions.length !== 1 ? "s" : ""}
              </span>
              <div className="flex-1" />
              <Button
                size="sm"
                className="bg-[#997100] hover:bg-[#b8850a] text-white"
                onClick={() => setActiveTab("add")}
              >
                <Plus size={14} className="mr-1" />
                Add Condition
              </Button>
            </div>

            {/* Conditions List */}
            {filteredConditions.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {statusFilter === "all" ? "No conditions on this loan" : `No ${statusFilter.toLowerCase()} conditions`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredConditions.map((c) => (
                  <Card key={c.id} className={`border-border/60 ${c.is_blocking && c.status === "Open" ? "border-l-4 border-l-red-500" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold">{c.title}</h3>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getConditionStatusColor(c.status)}`}>
                              {c.status}
                            </span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPriorityColor(c.priority)}`}>
                              {c.priority}
                            </span>
                            {c.is_blocking && c.status === "Open" && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                BLOCKING
                              </Badge>
                            )}
                          </div>
                          {c.description && (
                            <p className="text-xs text-muted-foreground mb-1">{c.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {c.action_owner && (
                              <span>Owner: {getActionOwnerLabel(c.action_owner)}</span>
                            )}
                            {c.prior_to && <span>Prior to: {c.prior_to}</span>}
                            {c.category && <span>Category: {c.category}</span>}
                          </div>
                        </div>

                        {/* Quick status actions */}
                        {c.status === "Open" && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              disabled={updatingStatus === c.id}
                              onClick={() => handleUpdateConditionStatus(c.id, "Received")}
                            >
                              {updatingStatus === c.id ? <Loader2 size={12} className="animate-spin" /> : "Received"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 text-green-600 hover:bg-green-50"
                              disabled={updatingStatus === c.id}
                              onClick={() => handleUpdateConditionStatus(c.id, "Cleared")}
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              disabled={updatingStatus === c.id}
                              onClick={() => handleUpdateConditionStatus(c.id, "Waived")}
                            >
                              Waive
                            </Button>
                          </div>
                        )}
                        {c.status === "Received" && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 text-green-600 hover:bg-green-50"
                              disabled={updatingStatus === c.id}
                              onClick={() => handleUpdateConditionStatus(c.id, "Cleared")}
                            >
                              {updatingStatus === c.id ? <Loader2 size={12} className="animate-spin" /> : "Clear"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "add" && (
          <Card className="border-border/60 max-w-xl">
            <CardHeader>
              <CardTitle className="text-base">Add New Condition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newCondition.title}
                  onChange={(e) => setNewCondition((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Proof of Insurance"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newCondition.description}
                  onChange={(e) => setNewCondition((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Additional details about this condition"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={newCondition.priority}
                    onValueChange={(v) => setNewCondition((f) => ({ ...f, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action Owner</Label>
                  <Select
                    value={newCondition.action_owner}
                    onValueChange={(v) => setNewCondition((f) => ({ ...f, action_owner: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broker">Broker</SelectItem>
                      <SelectItem value="title_company">Title Company</SelectItem>
                      <SelectItem value="lender_internal">Lender</SelectItem>
                      <SelectItem value="insurance_agent">Insurance</SelectItem>
                      <SelectItem value="closing_auto">Auto at Closing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prior To</Label>
                <Input
                  value={newCondition.prior_to}
                  onChange={(e) => setNewCondition((f) => ({ ...f, prior_to: e.target.value }))}
                  placeholder="e.g., Closing, Funding, Docs"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-blocking"
                  checked={newCondition.is_blocking}
                  onChange={(e) => setNewCondition((f) => ({ ...f, is_blocking: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is-blocking" className="text-sm font-normal cursor-pointer">
                  This condition is blocking (prevents closing)
                </Label>
              </div>
              <Button
                className="w-full bg-[#997100] hover:bg-[#b8850a] text-white"
                disabled={!newCondition.title.trim() || addingCondition}
                onClick={handleAddCondition}
              >
                {addingCondition ? (
                  <Loader2 size={14} className="animate-spin mr-2" />
                ) : (
                  <Plus size={14} className="mr-2" />
                )}
                Add Condition
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
