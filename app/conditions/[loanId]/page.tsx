"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Upload,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Shield,
  Building2,
  Landmark,
  Home,
  User,
  HelpCircle,
  FileUp,
  X,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PortalToggle } from "@/components/portal-toggle"

// ── Types ────────────────────────────────────────────────────────────

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
}

interface Condition {
  id: string
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
  is_received: boolean
  is_cleared: boolean
  is_waived: boolean
  created_date: string | null
  received_date: string | null
  cleared_date: string | null
  status_date: string | null
  notes: string | null
}

interface ImportDiff {
  success: boolean
  summary: {
    total_parsed: number
    created: number
    updated: number
    unchanged: number
    skipped: number
    triaged: number
  }
  diff: {
    created: { title: string; status: string }[]
    updated: { title: string; changes: string[] }[]
    unchanged: number
  }
  errors: string[]
}

// ── Owner group config ───────────────────────────────────────────────

const OWNER_GROUPS = [
  {
    key: "broker",
    label: "YOUR ACTION",
    icon: User,
    color: "text-[#997100]",
    bgColor: "bg-[#997100]/10",
  },
  {
    key: "title_company",
    label: "CHASE TITLE COMPANY",
    icon: Building2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    key: "insurance_agent",
    label: "CHASE INSURANCE",
    icon: Shield,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    key: "lender_internal",
    label: "PENDING LENDER",
    icon: Landmark,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  {
    key: "closing_auto",
    label: "CLEARS AT CLOSING",
    icon: Home,
    color: "text-gray-500",
    bgColor: "bg-gray-50",
  },
  {
    key: "other",
    label: "OTHER",
    icon: HelpCircle,
    color: "text-gray-400",
    bgColor: "bg-gray-50",
  },
  {
    key: "_closed",
    label: "COMPLETED",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
]

// ── Helpers ──────────────────────────────────────────────────────────

function priorityOrder(p: string) {
  switch (p) {
    case "critical":
      return 0
    case "high":
      return 1
    case "normal":
      return 2
    case "low":
      return 3
    default:
      return 4
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "critical":
      return <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0">CRITICAL</Badge>
    case "high":
      return <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">HIGH</Badge>
    case "low":
      return <Badge className="bg-gray-400 text-white text-[10px] px-1.5 py-0">LOW</Badge>
    default:
      return null
  }
}

function StatusBadge({ condition }: { condition: Condition }) {
  if (condition.is_cleared)
    return <Badge className="bg-green-600 text-white">Cleared</Badge>
  if (condition.is_waived)
    return <Badge className="bg-blue-600 text-white">Waived</Badge>
  if (condition.is_received)
    return <Badge className="bg-yellow-600 text-black">Received</Badge>
  return <Badge className="bg-gray-500 text-white">Open</Badge>
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

// ── Main Component ───────────────────────────────────────────────────

export default function LoanConditionsPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const params = useParams()
  const loanId = params.loanId as string

  const [loan, setLoan] = useState<Loan | null>(null)
  const [conditions, setConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["broker", "title_company", "insurance_agent", "lender_internal", "closing_auto", "other"])
  )
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null)

  // Import state
  const [importing, setImporting] = useState(false)
  const [importDiff, setImportDiff] = useState<ImportDiff | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?next=/conditions")
    }
  }, [user, authLoading, router])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/conditions/loans/${loanId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.loan) setLoan(data.loan)
        if (data.conditions) setConditions(data.conditions)
      }
    } catch {
      // Failed to load
    } finally {
      setLoading(false)
    }
  }, [loanId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Import handler ─────────────────────────────────────────────────

  async function handleImport(file: File) {
    if (!loan) return
    setImporting(true)
    setImportDiff(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("loan_number", loan.loan_number)
      formData.append("lender", loan.lender)
      formData.append("imported_by", user?.firstName || "portal")

      const res = await fetch("/api/conditions/import", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      setImportDiff(data)

      if (data.success) {
        await fetchData()
      }
    } catch {
      setImportDiff({
        success: false,
        summary: { total_parsed: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, triaged: 0 },
        diff: { created: [], updated: [], unchanged: 0 },
        errors: ["Upload failed — check your connection"],
      })
    } finally {
      setImporting(false)
    }
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImport(file)
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImport(file)
  }

  // ── Group conditions ───────────────────────────────────────────────

  const grouped = OWNER_GROUPS.map((group) => {
    const items =
      group.key === "_closed"
        ? conditions.filter((c) => c.status === "Closed")
        : conditions.filter(
            (c) => c.status === "Open" && (c.action_owner || "other") === group.key
          )
    items.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority))
    return { ...group, items }
  }).filter((g) => g.items.length > 0)

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Closing countdown ─────────────────────────────────────────────

  const daysToClose = loan?.closing_date
    ? Math.ceil(
        (new Date(loan.closing_date).getTime() - Date.now()) / 86400000
      )
    : null

  const received = conditions.filter(
    (c) => c.is_received && !c.is_cleared && !c.is_waived && c.status === "Open"
  ).length

  // ── Render ─────────────────────────────────────────────────────────

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading conditions...</p>
        </div>
      </div>
    )
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Loan not found</p>
          <Button asChild>
            <Link href="/conditions">Back to loans</Link>
          </Button>
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
                  <span className="text-2xl font-bold tracking-wide text-foreground">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
                </div>
              </Link>
              <Badge variant="outline" className="border-[#997100] text-[#997100]">
                Conditions
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
        {/* Back + Loan Header */}
        <div className="mb-6">
          <Link
            href="/conditions"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            All Loans
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-foreground">
                  {loan.loan_number}
                </h1>
                <Badge
                  variant="outline"
                  className="border-border text-muted-foreground"
                >
                  {loan.lender}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {loan.borrower_name && <span>{loan.borrower_name}</span>}
                {loan.property_address && <span>{loan.property_address}</span>}
                {loan.loan_amount && (
                  <span>
                    $
                    {loan.loan_amount.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                    })}
                  </span>
                )}
                {loan.loan_type && <span>{loan.loan_type}</span>}
                {loan.loan_program && <span>{loan.loan_program}</span>}
              </div>
            </div>

            {/* Closing countdown */}
            {daysToClose !== null && (
              <div className="text-right">
                {daysToClose < 0 ? (
                  <div className="bg-red-600 text-white px-4 py-2 rounded-lg">
                    <p className="text-sm font-bold">PAST CLOSING DATE</p>
                    <p className="text-xs opacity-80">
                      {Math.abs(daysToClose)} days overdue
                    </p>
                  </div>
                ) : daysToClose === 0 ? (
                  <div className="bg-red-600 text-white px-4 py-2 rounded-lg">
                    <p className="text-sm font-bold">CLOSING TODAY</p>
                  </div>
                ) : daysToClose <= 7 ? (
                  <div className="bg-red-100 border border-red-200 px-4 py-2 rounded-lg">
                    <p className="text-2xl font-bold text-red-700">
                      {daysToClose}
                    </p>
                    <p className="text-xs text-red-600">days to close</p>
                  </div>
                ) : (
                  <div className="bg-muted px-4 py-2 rounded-lg">
                    <p className="text-2xl font-bold text-foreground">
                      {daysToClose}
                    </p>
                    <p className="text-xs text-muted-foreground">days to close</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scorecard + Import */}
        <div className="grid gap-6 md:grid-cols-5 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="pt-6 pb-4 text-center">
              <p className="text-3xl font-bold text-foreground">
                {loan.conditions_open}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Open</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6 pb-4 text-center">
              <p className="text-3xl font-bold text-green-600">
                {loan.conditions_closed}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Cleared</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6 pb-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{received}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pending Review
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-6 pb-4 text-center">
              <p className="text-3xl font-bold text-foreground">
                {loan.conditions_total}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total</p>
            </CardContent>
          </Card>

          {/* Import Upload */}
          <Card
            className={`border-2 border-dashed transition-colors ${
              dragOver
                ? "border-[#997100] bg-[#997100]/5"
                : "border-border bg-card hover:border-muted-foreground"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <CardContent className="pt-6 pb-4 text-center">
              {importing ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#997100] mb-1" />
              ) : (
                <FileUp className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFileSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#997100] hover:text-[#b8850a] p-0 h-auto"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? "Importing..." : "Import Excel"}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                or drag & drop
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Import Diff */}
        {importDiff && (
          <Card className="bg-card border-border mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {importDiff.success ? "Import Complete" : "Import Failed"}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImportDiff(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {importDiff.success ? (
                <div className="space-y-2 text-sm">
                  <div className="flex gap-4">
                    {importDiff.summary.created > 0 && (
                      <span className="text-blue-600">
                        +{importDiff.summary.created} new
                      </span>
                    )}
                    {importDiff.summary.updated > 0 && (
                      <span className="text-orange-600">
                        {importDiff.summary.updated} updated
                      </span>
                    )}
                    {importDiff.summary.unchanged > 0 && (
                      <span className="text-muted-foreground">
                        {importDiff.summary.unchanged} unchanged
                      </span>
                    )}
                    {importDiff.summary.triaged > 0 && (
                      <span className="text-green-600">
                        {importDiff.summary.triaged} triaged by AI
                      </span>
                    )}
                  </div>
                  {importDiff.diff.updated.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {importDiff.diff.updated.map((u, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {u.title}
                          </span>
                          : {u.changes.join(", ")}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-600">
                  {importDiff.errors.join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Condition Groups */}
        <div className="space-y-4">
          {grouped.map((group) => {
            const Icon = group.icon
            const isOpen = expandedGroups.has(group.key)
            const blockingCount = group.items.filter((c) => c.is_blocking).length
            return (
              <Card key={group.key} className="bg-card border-border">
                <CardHeader
                  className="cursor-pointer py-4"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded ${group.bgColor}`}
                      >
                        <Icon className={`h-4 w-4 ${group.color}`} />
                      </div>
                      <span className="font-semibold text-sm tracking-wide text-foreground">
                        {group.label}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-border text-muted-foreground"
                      >
                        {group.items.length}
                      </Badge>
                      {blockingCount > 0 && (
                        <Badge className="bg-red-600 text-white text-[10px]">
                          {blockingCount} blocking
                        </Badge>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0">
                    <div className="divide-y divide-border">
                      {group.items.map((condition) => {
                        const isExpanded =
                          expandedCondition === condition.id
                        const lastUpdate = daysSince(condition.status_date)
                        return (
                          <div
                            key={condition.id}
                            className="py-3 first:pt-0 last:pb-0"
                          >
                            <div
                              className="flex items-start justify-between cursor-pointer"
                              onClick={() =>
                                setExpandedCondition(
                                  isExpanded ? null : condition.id
                                )
                              }
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {condition.is_blocking && (
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                  )}
                                  <span className="text-sm font-medium text-foreground">
                                    {condition.title}
                                  </span>
                                  <PriorityBadge
                                    priority={condition.priority}
                                  />
                                </div>
                                {condition.action_summary && (
                                  <p className="text-sm text-muted-foreground ml-0 mt-0.5">
                                    {condition.action_summary}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-3 ml-4 shrink-0">
                                {lastUpdate !== null && (
                                  <span className="text-xs text-muted-foreground">
                                    {lastUpdate === 0
                                      ? "today"
                                      : `${lastUpdate}d ago`}
                                  </span>
                                )}
                                <StatusBadge condition={condition} />
                              </div>
                            </div>
                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="mt-3 ml-0 p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                                {condition.description && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                      Description
                                    </p>
                                    <p className="text-foreground">
                                      {condition.description}
                                    </p>
                                  </div>
                                )}
                                {condition.description_details && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                      Details
                                    </p>
                                    <p className="text-foreground">
                                      {condition.description_details}
                                    </p>
                                  </div>
                                )}
                                <div className="flex gap-6 text-xs text-muted-foreground pt-1">
                                  {condition.category && (
                                    <span>Category: {condition.category}</span>
                                  )}
                                  {condition.prior_to && (
                                    <span>Prior to: {condition.prior_to}</span>
                                  )}
                                  {condition.sub_status && (
                                    <span>
                                      Sub-status: {condition.sub_status}
                                    </span>
                                  )}
                                  {condition.created_date && (
                                    <span>
                                      Created:{" "}
                                      {new Date(
                                        condition.created_date
                                      ).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {condition.notes && (
                                  <div className="pt-1">
                                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                      Notes
                                    </p>
                                    <p className="text-foreground">
                                      {condition.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
