"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  Building2,
  Loader2,
  ArrowLeft,
  Landmark,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types (mirrors lib/browser/types.ts for client use)
// ---------------------------------------------------------------------------

type PortalStatus = "connected" | "disconnected" | "error"
type LoanStatusValue =
  | "processing"
  | "submitted"
  | "conditional_approval"
  | "clear_to_close"
  | "funded"
  | "suspended"
  | "denied"

interface PortalInfo {
  portalId: string
  portalName: string
  status: PortalStatus
  lastSyncedAt?: string
  error?: string
  activeLoanCount: number
}

interface LoanRow {
  loanNumber: string
  borrowerName: string
  propertyAddress: string
  loanAmount: number
  status: LoanStatusValue
  lockExpiration?: string
  conditionsCount: number
  portalId: string
  portalName: string
}

// ---------------------------------------------------------------------------
// Mock Data (renders the page without live portal connections)
// ---------------------------------------------------------------------------

const MOCK_PORTALS: PortalInfo[] = [
  { portalId: "uwm", portalName: "UWM (United Wholesale Mortgage)", status: "connected", lastSyncedAt: new Date(Date.now() - 45 * 60_000).toISOString(), activeLoanCount: 6 },
  { portalId: "rocket_pro", portalName: "Rocket Pro TPO", status: "connected", lastSyncedAt: new Date(Date.now() - 120 * 60_000).toISOString(), activeLoanCount: 3 },
  { portalId: "kiavi", portalName: "Kiavi", status: "disconnected", activeLoanCount: 0 },
  { portalId: "lima_one", portalName: "Lima One Capital", status: "connected", lastSyncedAt: new Date(Date.now() - 30 * 60_000).toISOString(), activeLoanCount: 2 },
  { portalId: "angel_oak", portalName: "Angel Oak Mortgage Solutions", status: "error", lastSyncedAt: new Date(Date.now() - 360 * 60_000).toISOString(), error: "Session timeout — re-login required", activeLoanCount: 1 },
  { portalId: "carrington", portalName: "Carrington Wholesale", status: "disconnected", activeLoanCount: 0 },
  { portalId: "newfi", portalName: "NewFi Wholesale", status: "disconnected", activeLoanCount: 0 },
  { portalId: "corevest", portalName: "CoreVest Finance", status: "disconnected", activeLoanCount: 0 },
]

const MOCK_LOANS: LoanRow[] = [
  { loanNumber: "UWM-2026-001234", borrowerName: "James & Maria Rodriguez", propertyAddress: "1452 Peachtree St NE, Atlanta, GA 30309", loanAmount: 385000, status: "clear_to_close", conditionsCount: 0, portalId: "uwm", portalName: "UWM", lockExpiration: new Date(Date.now() + 12 * 24 * 60 * 60_000).toISOString() },
  { loanNumber: "UWM-2026-001198", borrowerName: "David Thompson", propertyAddress: "834 Spring St NW, Atlanta, GA 30308", loanAmount: 275000, status: "conditional_approval", conditionsCount: 3, portalId: "uwm", portalName: "UWM", lockExpiration: new Date(Date.now() + 8 * 24 * 60 * 60_000).toISOString() },
  { loanNumber: "UWM-2026-001201", borrowerName: "Sarah Chen", propertyAddress: "2100 Howell Mill Rd, Atlanta, GA 30318", loanAmount: 520000, status: "processing", conditionsCount: 0, portalId: "uwm", portalName: "UWM" },
  { loanNumber: "UWM-2026-001156", borrowerName: "Marcus Williams", propertyAddress: "445 Boulevard SE, Atlanta, GA 30312", loanAmount: 195000, status: "conditional_approval", conditionsCount: 5, portalId: "uwm", portalName: "UWM", lockExpiration: new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString() },
  { loanNumber: "UWM-2026-001210", borrowerName: "Emily & Robert Park", propertyAddress: "901 Memorial Dr SE, Atlanta, GA 30316", loanAmount: 310000, status: "submitted", conditionsCount: 0, portalId: "uwm", portalName: "UWM" },
  { loanNumber: "UWM-2026-001089", borrowerName: "Antonio Reyes", propertyAddress: "1677 N Decatur Rd, Atlanta, GA 30307", loanAmount: 440000, status: "suspended", conditionsCount: 2, portalId: "uwm", portalName: "UWM" },
  { loanNumber: "RPT-2026-007821", borrowerName: "Lisa & Kevin O'Brien", propertyAddress: "3200 Cobb Pkwy, Kennesaw, GA 30144", loanAmount: 350000, status: "conditional_approval", conditionsCount: 2, portalId: "rocket_pro", portalName: "Rocket Pro TPO", lockExpiration: new Date(Date.now() + 15 * 24 * 60 * 60_000).toISOString() },
  { loanNumber: "RPT-2026-007835", borrowerName: "Tanisha Jackson", propertyAddress: "510 Flat Shoals Ave SE, Atlanta, GA 30316", loanAmount: 225000, status: "clear_to_close", conditionsCount: 0, portalId: "rocket_pro", portalName: "Rocket Pro TPO", lockExpiration: new Date(Date.now() + 20 * 24 * 60 * 60_000).toISOString() },
  { loanNumber: "RPT-2026-007840", borrowerName: "Andrew Kim", propertyAddress: "1890 Piedmont Ave NE, Atlanta, GA 30324", loanAmount: 415000, status: "processing", conditionsCount: 0, portalId: "rocket_pro", portalName: "Rocket Pro TPO" },
  { loanNumber: "L1-2026-004501", borrowerName: "Marathon Empire LLC", propertyAddress: "1233 Donald Lee Hollowell Pkwy, Atlanta, GA 30318", loanAmount: 180000, status: "conditional_approval", conditionsCount: 4, portalId: "lima_one", portalName: "Lima One", lockExpiration: new Date(Date.now() + 6 * 24 * 60 * 60_000).toISOString() },
  { loanNumber: "L1-2026-004489", borrowerName: "Marathon Empire LLC", propertyAddress: "789 Simpson Rd NW, Atlanta, GA 30314", loanAmount: 155000, status: "funded", conditionsCount: 0, portalId: "lima_one", portalName: "Lima One" },
  { loanNumber: "AO-2026-012345", borrowerName: "Patricia Gonzalez", propertyAddress: "2401 Campbellton Rd SW, Atlanta, GA 30311", loanAmount: 290000, status: "conditional_approval", conditionsCount: 6, portalId: "angel_oak", portalName: "Angel Oak", lockExpiration: new Date(Date.now() + 4 * 24 * 60 * 60_000).toISOString() },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<LoanStatusValue, string> = {
  processing: "Processing",
  submitted: "Submitted",
  conditional_approval: "Conditional",
  clear_to_close: "Clear to Close",
  funded: "Funded",
  suspended: "Suspended",
  denied: "Denied",
}

function getStatusColor(status: LoanStatusValue): string {
  switch (status) {
    case "clear_to_close":
    case "funded":
      return "bg-green-100 text-green-800"
    case "conditional_approval":
    case "submitted":
    case "processing":
      return "bg-[#fff5e1] text-[#7a4a00]"
    case "suspended":
    case "denied":
      return "bg-red-100 text-red-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

function getRowHighlight(loan: LoanRow): string {
  if (loan.status === "clear_to_close" || loan.status === "funded") return "border-l-4 border-l-green-500"
  if (loan.status === "suspended" || loan.status === "denied") return "border-l-4 border-l-red-500"
  if (loan.lockExpiration) {
    const daysUntilExpiry = (new Date(loan.lockExpiration).getTime() - Date.now()) / (24 * 60 * 60_000)
    if (daysUntilExpiry <= 5) return "border-l-4 border-l-red-500"
  }
  if (loan.conditionsCount > 0) return "border-l-4 border-l-[#997100]"
  return "border-l-4 border-l-transparent"
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function daysUntil(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60_000))
  if (days <= 0) return "EXPIRED"
  if (days === 1) return "1 day"
  return `${days} days`
}

// ---------------------------------------------------------------------------
// Portal Status Card
// ---------------------------------------------------------------------------

function PortalCard({
  portal,
  onRefresh,
  refreshing,
}: {
  portal: PortalInfo
  onRefresh: (id: string) => void
  refreshing: boolean
}) {
  const statusIcon =
    portal.status === "connected" ? (
      <Wifi size={16} className="text-green-500" />
    ) : portal.status === "error" ? (
      <AlertTriangle size={16} className="text-red-500" />
    ) : (
      <WifiOff size={16} className="text-muted-foreground" />
    )

  const statusLabel =
    portal.status === "connected"
      ? "Connected"
      : portal.status === "error"
        ? "Error"
        : "Not configured"

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
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
            {portal.lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                &middot; synced {timeAgo(portal.lastSyncedAt)}
              </span>
            )}
          </div>
          {portal.error && (
            <p className="text-xs text-red-500 mt-1 truncate">{portal.error}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          {portal.activeLoanCount > 0 && (
            <p className="text-lg font-bold">{portal.activeLoanCount}</p>
          )}
          <button
            onClick={() => onRefresh(portal.portalId)}
            disabled={refreshing || portal.status === "disconnected"}
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#997100] hover:text-[#b8850a] disabled:text-muted-foreground disabled:cursor-not-allowed"
          >
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
      </CardContent>
    </Card>
  )
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
// Page Component
// ---------------------------------------------------------------------------

export default function PortalsPage() {
  const [portals] = useState<PortalInfo[]>(MOCK_PORTALS)
  const [loans] = useState<LoanRow[]>(MOCK_LOANS)
  const [refreshingPortal, setRefreshingPortal] = useState<string | null>(null)

  const handleRefresh = async (portalId: string) => {
    setRefreshingPortal(portalId)
    try {
      await fetch("/api/portals/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portalId }),
      })
    } catch {
      // Silently fail for demo
    } finally {
      setTimeout(() => setRefreshingPortal(null), 1500)
    }
  }

  // Summary stats
  const connectedCount = portals.filter((p) => p.status === "connected").length
  const totalActiveLoans = loans.length
  const conditionsOutstanding = loans.reduce((sum, l) => sum + l.conditionsCount, 0)
  const lockExpiringSoon = loans.filter((l) => {
    if (!l.lockExpiration) return false
    const days = (new Date(l.lockExpiration).getTime() - Date.now()) / (24 * 60 * 60_000)
    return days <= 5 && days > 0
  }).length

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation bar */}
      <nav className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-2xl font-bold tracking-wide">PREME</span>
              </div>
            </Link>
            <Badge className="bg-black text-white">Lender Portals</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-muted" asChild>
              <Link href="/lender">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back to Lender
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white" asChild>
              <Link href="/admin">Admin</Link>
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
            Monitor loan status across all connected wholesale lender portals
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={<Wifi size={18} className="text-green-500" />} label="Connected" value={`${connectedCount}/${portals.length}`} />
          <SummaryCard icon={<Building2 size={18} className="text-[#997100]" />} label="Active Loans" value={totalActiveLoans.toString()} />
          <SummaryCard icon={<FileWarning size={18} className="text-[#b8850a]" />} label="Conditions" value={conditionsOutstanding.toString()} />
          <SummaryCard icon={<Clock size={18} className="text-red-500" />} label="Lock Expiring" value={lockExpiringSoon.toString()} subtitle="within 5 days" />
        </div>

        {/* Portal Status Grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Portal Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {portals.map((portal) => (
              <PortalCard
                key={portal.portalId}
                portal={portal}
                onRefresh={handleRefresh}
                refreshing={refreshingPortal === portal.portalId}
              />
            ))}
          </div>
        </div>

        {/* Active Loans Table */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Active Loans</h2>
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
                    <th className="text-center px-4 py-3 font-semibold hidden lg:table-cell">Lock Exp.</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => {
                    const lockDaysLeft = loan.lockExpiration
                      ? (new Date(loan.lockExpiration).getTime() - Date.now()) / (24 * 60 * 60_000)
                      : null

                    return (
                      <tr
                        key={`${loan.portalId}-${loan.loanNumber}`}
                        className={`border-t border-border/60 hover:bg-muted/50 ${getRowHighlight(loan)}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {loan.loanNumber}
                        </td>
                        <td className="px-4 py-3 font-medium">{loan.borrowerName}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[240px] truncate">
                          {loan.propertyAddress}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(loan.loanAmount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(loan.status)}`}
                          >
                            {STATUS_LABELS[loan.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {loan.conditionsCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[#997100] font-semibold text-xs">
                              <FileWarning size={14} />
                              {loan.conditionsCount}
                            </span>
                          ) : (
                            <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {loan.lockExpiration ? (
                            <span
                              className={`text-xs font-medium ${
                                lockDaysLeft !== null && lockDaysLeft <= 5
                                  ? "text-red-600 font-bold"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {daysUntil(loan.lockExpiration)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <span className="text-xs text-muted-foreground">{loan.portalName}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
