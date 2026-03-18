"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Upload,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PortalToggle } from "@/components/portal-toggle"

interface Loan {
  id: string
  loan_number: string
  borrower_name: string | null
  property_address: string | null
  lender: string
  loan_amount: number | null
  closing_date: string | null
  status: string
  conditions_total: number
  conditions_open: number
  conditions_closed: number
  has_blocking: boolean
}

function getHealthColor(loan: Loan) {
  if (loan.has_blocking) return "red"
  if (loan.conditions_open === 0) return "green"
  const closingDate = loan.closing_date ? new Date(loan.closing_date) : null
  const daysUntilClose = closingDate
    ? Math.ceil((closingDate.getTime() - Date.now()) / 86400000)
    : null
  if (daysUntilClose !== null && daysUntilClose <= 7 && loan.conditions_open > 5)
    return "red"
  if (daysUntilClose !== null && daysUntilClose <= 14 && loan.conditions_open > 10)
    return "yellow"
  if (loan.conditions_open > 20) return "yellow"
  return "green"
}

function getHealthBadge(color: string) {
  switch (color) {
    case "red":
      return (
        <Badge className="bg-red-600 text-white">
          <AlertTriangle className="h-3 w-3 mr-1" />
          At Risk
        </Badge>
      )
    case "yellow":
      return (
        <Badge className="bg-yellow-600 text-black">
          <Clock className="h-3 w-3 mr-1" />
          Needs Attention
        </Badge>
      )
    default:
      return (
        <Badge className="bg-green-600 text-white">
          <CheckCircle className="h-3 w-3 mr-1" />
          On Track
        </Badge>
      )
  }
}

function daysUntilClosing(dateStr: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

export default function ConditionsListPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?next=/conditions")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function fetchLoans() {
      try {
        const res = await fetch("/api/conditions/loans")
        if (res.ok) {
          const data = await res.json()
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

  const stats = {
    totalLoans: loans.length,
    totalOpen: loans.reduce((s, l) => s + l.conditions_open, 0),
    totalClosed: loans.reduce((s, l) => s + l.conditions_closed, 0),
    blocking: loans.filter((l) => l.has_blocking).length,
  }

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

  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Loan Conditions
          </h1>
          <p className="text-muted-foreground">
            Track underwriting conditions across all active loans
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Loans
              </CardTitle>
              <FileText className="h-4 w-4 text-[#997100]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLoans}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Conditions
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOpen}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cleared
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClosed}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Blocking
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.blocking}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loan Cards */}
        {loans.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No active loans</h3>
              <p className="text-muted-foreground text-sm">
                Import conditions from a lender to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => {
              const health = getHealthColor(loan)
              const days = daysUntilClosing(loan.closing_date)
              const pct =
                loan.conditions_total > 0
                  ? Math.round(
                      (loan.conditions_closed / loan.conditions_total) * 100
                    )
                  : 0
              return (
                <Link key={loan.id} href={`/conditions/${loan.id}`}>
                  <Card className="bg-card border-border hover:border-muted-foreground transition-colors cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {loan.loan_number}
                            </h3>
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground"
                            >
                              {loan.lender}
                            </Badge>
                            {getHealthBadge(health)}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground mb-3">
                            {loan.borrower_name && (
                              <span>{loan.borrower_name}</span>
                            )}
                            {loan.property_address && (
                              <span className="truncate max-w-[300px]">
                                {loan.property_address}
                              </span>
                            )}
                            {loan.loan_amount && (
                              <span>
                                $
                                {loan.loan_amount.toLocaleString(undefined, {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            )}
                          </div>
                          {/* Progress bar */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 max-w-md">
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor:
                                      health === "red"
                                        ? "#dc2626"
                                        : health === "yellow"
                                          ? "#ca8a04"
                                          : "#16a34a",
                                  }}
                                />
                              </div>
                            </div>
                            <span className="text-sm font-medium text-foreground whitespace-nowrap">
                              {loan.conditions_closed} / {loan.conditions_total}{" "}
                              cleared
                            </span>
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {loan.conditions_open} open
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 ml-6">
                          {days !== null && (
                            <div className="text-right">
                              {days < 0 ? (
                                <p className="text-sm font-bold text-red-600">
                                  PAST CLOSING DATE
                                </p>
                              ) : days === 0 ? (
                                <p className="text-sm font-bold text-red-600">
                                  CLOSING TODAY
                                </p>
                              ) : (
                                <>
                                  <p className="text-2xl font-bold text-foreground">
                                    {days}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    days to close
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
