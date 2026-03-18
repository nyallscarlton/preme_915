"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  FileWarning,
  Building2,
  Loader2,
  ArrowLeft,
  Landmark,
  ChevronRight,
  Upload,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoanRow {
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

interface PortalInfo {
  portalId: string
  portalName: string
  status: "connected" | "disconnected"
  activeLoanCount: number
}

// ---------------------------------------------------------------------------
// Portal registry — matches portal-config.ts
// ---------------------------------------------------------------------------

const PORTAL_REGISTRY: { id: string; name: string }[] = [
  { id: "uwm", name: "UWM (United Wholesale Mortgage)" },
  { id: "rocket_pro", name: "Rocket Pro TPO" },
  { id: "kiavi", name: "Kiavi" },
  { id: "lima_one", name: "Lima One Capital" },
  { id: "angel_oak", name: "Angel Oak Mortgage Solutions" },
  { id: "carrington", name: "Carrington Wholesale" },
  { id: "newfi", name: "NewFi Wholesale" },
  { id: "corevest", name: "CoreVest Finance" },
  { id: "logan_finance", name: "Logan Finance" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

function daysUntilClosing(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (24 * 60 * 60_000))
}

function getRowHighlight(loan: LoanRow): string {
  if (loan.status === "Closed") return "border-l-4 border-l-green-500"
  if (loan.status === "Suspended" || loan.status === "Cancelled") return "border-l-4 border-l-red-500"
  if (loan.closing_date) {
    const days = daysUntilClosing(loan.closing_date)
    if (days !== null && days <= 5) return "border-l-4 border-l-red-500"
  }
  if (loan.conditions_open > 0) return "border-l-4 border-l-[#997100]"
  return "border-l-4 border-l-transparent"
}

function getStatusColor(status: string): string {
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
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Portal Status Card
// ---------------------------------------------------------------------------

function PortalCard({ portal }: { portal: PortalInfo }) {
  const statusIcon =
    portal.status === "connected" ? (
      <Wifi size={16} className="text-green-500" />
    ) : (
      <WifiOff size={16} className="text-muted-foreground" />
    )

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Building2 size={20} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{portal.portalName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {statusIcon}
            <span className="text-xs text-muted-foreground">
              {portal.status === "connected" ? "Has loans" : "No active loans"}
            </span>
          </div>
        </div>
        {portal.activeLoanCount > 0 && (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold">{portal.activeLoanCount}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PortalsPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?next=/portals")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function fetchLoans() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("loans")
          .select("*")
          .order("updated_at", { ascending: false })

        if (!error && data) {
          setLoans(data)
        }
      } catch {
        // Failed to load
      } finally {
        setLoading(false)
      }
    }
    fetchLoans()
  }, [])

  // Build portal status from real loan data
  const lenderCounts = new Map<string, number>()
  for (const loan of loans) {
    if (loan.status === "Active") {
      const key = loan.lender.toLowerCase().replace(/\s+/g, "_")
      lenderCounts.set(key, (lenderCounts.get(key) || 0) + 1)
      // Also match by lender name directly
      lenderCounts.set(loan.lender, (lenderCounts.get(loan.lender) || 0) + 1)
    }
  }

  const portals: PortalInfo[] = PORTAL_REGISTRY.map((p) => {
    const count = lenderCounts.get(p.id) || lenderCounts.get(p.name) || 0
    return {
      portalId: p.id,
      portalName: p.name,
      status: count > 0 ? "connected" : "disconnected",
      activeLoanCount: count,
    }
  })

  // Also add any lenders from actual data that aren't in the registry
  const registryNames = new Set(PORTAL_REGISTRY.map((p) => p.name))
  const registryIds = new Set(PORTAL_REGISTRY.map((p) => p.id))
  const seenLenders = new Set<string>()
  for (const loan of loans) {
    if (loan.status === "Active" && !seenLenders.has(loan.lender)) {
      seenLenders.add(loan.lender)
      const key = loan.lender.toLowerCase().replace(/\s+/g, "_")
      if (!registryNames.has(loan.lender) && !registryIds.has(key)) {
        const count = loans.filter((l) => l.lender === loan.lender && l.status === "Active").length
        portals.push({
          portalId: key,
          portalName: loan.lender,
          status: "connected",
          activeLoanCount: count,
        })
      }
    }
  }

  // Sort portals: connected first, then alphabetical
  portals.sort((a, b) => {
    if (a.status !== b.status) return a.status === "connected" ? -1 : 1
    return a.portalName.localeCompare(b.portalName)
  })

  // Summary stats
  const activeLoans = loans.filter((l) => l.status === "Active")
  const totalActiveLoans = activeLoans.length
  const conditionsOutstanding = activeLoans.reduce((sum, l) => sum + l.conditions_open, 0)
  const closingSoon = activeLoans.filter((l) => {
    const days = daysUntilClosing(l.closing_date)
    return days !== null && days <= 7 && days > 0
  }).length
  const connectedCount = portals.filter((p) => p.status === "connected").length

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading portals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation bar */}
      <nav className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative">
                <span className="text-2xl font-bold tracking-wide">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
              </div>
            </Link>
            <Badge className="bg-black text-white">Lender Portals</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden md:inline">
              {user?.firstName} {user?.lastName}
            </span>
            <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" asChild>
              <Link href="/lender">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Lender Dashboard
              </Link>
            </Button>
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
      </nav>

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Landmark className="h-6 w-6 text-[#997100]" />
            <h1 className="text-2xl font-bold">Lender Portals</h1>
          </div>
          <p className="text-muted-foreground">
            Monitor loan status across all wholesale lender portals
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={<Wifi size={18} className="text-green-500" />} label="Lenders" value={`${connectedCount} active`} />
          <SummaryCard icon={<Building2 size={18} className="text-[#997100]" />} label="Active Loans" value={totalActiveLoans.toString()} />
          <SummaryCard icon={<FileWarning size={18} className="text-[#b8850a]" />} label="Open Conditions" value={conditionsOutstanding.toString()} />
          <SummaryCard icon={<Clock size={18} className="text-red-500" />} label="Closing Soon" value={closingSoon.toString()} subtitle="within 7 days" />
        </div>

        {/* Portal Status Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Portal Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {portals.map((portal) => (
              <PortalCard key={portal.portalId} portal={portal} />
            ))}
          </div>
        </div>

        {/* Active Loans Table */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Loans</h2>
          {loans.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-16 text-center">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No loans yet</h3>
                <p className="text-muted-foreground text-sm">
                  Loans will appear here once they are imported from lender portals or added manually.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left px-4 py-3 font-semibold">Loan #</th>
                      <th className="text-left px-4 py-3 font-semibold">Borrower</th>
                      <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Property</th>
                      <th className="text-right px-4 py-3 font-semibold">Amount</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                      <th className="text-center px-4 py-3 font-semibold hidden lg:table-cell">Conditions</th>
                      <th className="text-center px-4 py-3 font-semibold hidden lg:table-cell">Closing</th>
                      <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Lender</th>
                      <th className="text-center px-4 py-3 font-semibold w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map((loan) => {
                      const closeDays = daysUntilClosing(loan.closing_date)

                      return (
                        <tr
                          key={loan.id}
                          onClick={() => router.push(`/portals/${loan.id}`)}
                          className={`border-t border-border/60 hover:bg-muted/50 cursor-pointer ${getRowHighlight(loan)}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs">
                            {loan.loan_number}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {loan.borrower_name || <span className="text-muted-foreground">--</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[240px] truncate">
                            {loan.property_address || "--"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {loan.loan_amount ? formatCurrency(loan.loan_amount) : "--"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(loan.status)}`}
                            >
                              {loan.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center hidden lg:table-cell">
                            {loan.conditions_open > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[#997100] font-semibold text-xs">
                                <FileWarning size={14} />
                                {loan.conditions_open} open
                              </span>
                            ) : loan.conditions_total > 0 ? (
                              <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle2 size={14} />
                                All cleared
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center hidden lg:table-cell">
                            {loan.closing_date ? (
                              <span
                                className={`text-xs font-medium ${
                                  closeDays !== null && closeDays <= 5
                                    ? "text-red-600 font-bold"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {closeDays !== null && closeDays <= 0
                                  ? "PAST DUE"
                                  : closeDays === 1
                                    ? "1 day"
                                    : `${closeDays} days`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">{loan.lender}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ChevronRight size={16} className="text-muted-foreground" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
