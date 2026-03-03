"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calculator,
  DollarSign,
  ArrowLeftRight,
} from "lucide-react"
import Link from "next/link"
import { PortalToggle } from "@/components/portal-toggle"
import {
  matchAllLenders,
  calculateDSCR,
  estimateClosingCosts,
  type DscrLender,
  type DscrApplication,
  type LenderMatchResult,
} from "@/lib/dscr-matcher"

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
]
const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",
  IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",
  RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",
  UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",
  WI:"Wisconsin",WY:"Wyoming",
}

const PROPERTY_TYPES = [
  { value: "singleFamily", label: "Single Family" },
  { value: "duplex", label: "Duplex (2 Unit)" },
  { value: "34unit", label: "3-4 Units" },
  { value: "manufactured", label: "Manufactured Home" },
  { value: "mixedUse", label: "Mixed Use" },
  { value: "nwCondo", label: "Non-Warrantable Condo" },
  { value: "condotel", label: "Condotel" },
  { value: "str", label: "Short Term Rental" },
]

const LOAN_PURPOSES = [
  { value: "purchase", label: "Purchase" },
  { value: "rt", label: "Rate/Term Refinance" },
  { value: "cashout", label: "Cash-Out Refinance" },
]

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function DSCRMatcherPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [lenders, setLenders] = useState<DscrLender[]>([])
  const [loadingLenders, setLoadingLenders] = useState(true)
  const [expandedLender, setExpandedLender] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [showCalc, setShowCalc] = useState(false)

  const [app, setApp] = useState<DscrApplication>({
    state: "MI",
    propertyType: "singleFamily",
    loanPurpose: "purchase",
    fico: 700,
    purchasePrice: 200000,
    loanAmount: 160000,
    ltv: 0.8,
    dscr: 1.25,
    foreignNational: false,
    section8: false,
    layeredLLC: false,
    firstTimeBuyer: false,
    subordinateFinancing: false,
  })

  // DSCR calculator state
  const [calcInputs, setCalcInputs] = useState({
    interestRate: 0.08,
    loanTermYears: 30,
    annualTaxes: 3000,
    annualInsurance: 1500,
    annualHOA: 0,
    monthlyRent: 1800,
    interestOnly: false,
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth?next=/admin/dscr-matcher")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function fetchLenders() {
      try {
        const res = await fetch("/api/dscr/lenders")
        if (res.ok) {
          const data = await res.json()
          setLenders(data)
        }
      } catch {
        // Failed to load
      } finally {
        setLoadingLenders(false)
      }
    }
    fetchLenders()
  }, [])

  const update = (field: string, val: unknown) => {
    setApp((prev) => {
      const next = { ...prev, [field]: val }
      if (field === "loanAmount" || field === "purchasePrice") {
        const pp = field === "purchasePrice" ? (val as number) : prev.purchasePrice
        const la = field === "loanAmount" ? (val as number) : prev.loanAmount
        if (pp > 0) next.ltv = la / pp
      }
      return next
    })
  }

  const results = useMemo(() => {
    if (lenders.length === 0) return null
    return matchAllLenders(app, lenders)
  }, [app, lenders])

  const dscrCalcResult = useMemo(() => {
    return calculateDSCR({
      loanAmount: app.loanAmount,
      ...calcInputs,
    })
  }, [app.loanAmount, calcInputs])

  const applyCalculatedDSCR = () => {
    update("dscr", Math.round(dscrCalcResult.dscr * 100) / 100)
  }

  if (authLoading || loadingLenders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4" />
          <p className="text-muted-foreground">Loading DSCR Lender Match Engine...</p>
        </div>
      </div>
    )
  }

  if (!user || (user.role !== "admin" && user.role !== "lender")) {
    return null
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
                  <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]" />
                  <span className="text-2xl font-bold tracking-wide text-foreground">PREME</span>
                </div>
              </Link>
              <Badge variant="outline" className="border-[#997100] text-[#997100]">
                DSCR Lender Match
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
                onClick={() => { signOut(); window.location.href = "/" }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ═══ LEFT PANEL: Application Inputs ═══ */}
          <div className="lg:col-span-4 space-y-4">
            {/* Main Form */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Loan Scenario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">State</label>
                  <select
                    value={app.state}
                    onChange={(e) => update("state", e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                  >
                    {STATES.map((s) => (
                      <option key={s} value={s}>{STATE_NAMES[s]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Property Type</label>
                  <select
                    value={app.propertyType}
                    onChange={(e) => update("propertyType", e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                  >
                    {PROPERTY_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>{pt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Loan Purpose</label>
                  <select
                    value={app.loanPurpose}
                    onChange={(e) => update("loanPurpose", e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                  >
                    {LOAN_PURPOSES.map((lp) => (
                      <option key={lp.value} value={lp.value}>{lp.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">FICO Score</label>
                  <input
                    type="number"
                    step={1}
                    value={app.fico}
                    onChange={(e) => update("fico", parseInt(e.target.value) || 0)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Purchase Price / Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      step={1000}
                      value={app.purchasePrice}
                      onChange={(e) => update("purchasePrice", parseFloat(e.target.value) || 0)}
                      className="w-full bg-muted border border-border rounded-lg pl-7 pr-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Loan Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input
                      type="number"
                      step={1000}
                      value={app.loanAmount}
                      onChange={(e) => update("loanAmount", parseFloat(e.target.value) || 0)}
                      className="w-full bg-muted border border-border rounded-lg pl-7 pr-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">LTV</label>
                    <div className="bg-muted border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-[#997100]">
                      {(app.ltv * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">DSCR Ratio</label>
                    <input
                      type="number"
                      step={0.01}
                      value={app.dscr}
                      onChange={(e) => update("dscr", parseFloat(e.target.value) || 0)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:border-[#997100] focus:ring-1 focus:ring-[#997100] outline-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Filters */}
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  <span>Additional Filters</span>
                  {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showFilters && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {[
                      { label: "Foreign National", field: "foreignNational" },
                      { label: "Section 8 Tenants", field: "section8" },
                      { label: "Layered LLC", field: "layeredLLC" },
                      { label: "First Time Homebuyer", field: "firstTimeBuyer" },
                      { label: "Subordinate Financing", field: "subordinateFinancing" },
                    ].map((toggle) => (
                      <label key={toggle.field} className="flex items-center justify-between gap-2 cursor-pointer py-1.5">
                        <span className="text-sm text-foreground">{toggle.label}</span>
                        <button
                          type="button"
                          onClick={() => update(toggle.field, !app[toggle.field as keyof DscrApplication])}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            app[toggle.field as keyof DscrApplication] ? "bg-[#997100]" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                              app[toggle.field as keyof DscrApplication] ? "translate-x-5" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DSCR Calculator */}
            <Card className="bg-card border-border">
              <CardContent className="pt-4 pb-4">
                <button
                  onClick={() => setShowCalc(!showCalc)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  <span className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    DSCR Calculator
                  </span>
                  {showCalc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showCalc && (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Interest Rate</label>
                        <div className="relative">
                          <input
                            type="number"
                            step={0.005}
                            value={calcInputs.interestRate}
                            onChange={(e) => setCalcInputs((p) => ({ ...p, interestRate: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Monthly Rent</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <input
                            type="number"
                            step={50}
                            value={calcInputs.monthlyRent}
                            onChange={(e) => setCalcInputs((p) => ({ ...p, monthlyRent: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-muted border border-border rounded-lg pl-5 pr-3 py-2 text-foreground text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Annual Taxes</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <input
                            type="number"
                            step={100}
                            value={calcInputs.annualTaxes}
                            onChange={(e) => setCalcInputs((p) => ({ ...p, annualTaxes: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-muted border border-border rounded-lg pl-5 pr-3 py-2 text-foreground text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Annual Insurance</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <input
                            type="number"
                            step={100}
                            value={calcInputs.annualInsurance}
                            onChange={(e) => setCalcInputs((p) => ({ ...p, annualInsurance: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-muted border border-border rounded-lg pl-5 pr-3 py-2 text-foreground text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Annual HOA</label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                          <input
                            type="number"
                            step={100}
                            value={calcInputs.annualHOA}
                            onChange={(e) => setCalcInputs((p) => ({ ...p, annualHOA: parseFloat(e.target.value) || 0 }))}
                            className="w-full bg-muted border border-border rounded-lg pl-5 pr-3 py-2 text-foreground text-sm outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Term (years)</label>
                        <input
                          type="number"
                          step={5}
                          value={calcInputs.loanTermYears}
                          onChange={(e) => setCalcInputs((p) => ({ ...p, loanTermYears: parseInt(e.target.value) || 30 }))}
                          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-foreground text-sm outline-none"
                        />
                      </div>
                    </div>

                    {/* Calculator Results */}
                    <div className="bg-muted rounded-lg p-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Monthly P&I</span>
                        <span className="font-mono">${fmt(dscrCalcResult.monthlyPI)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Monthly PITI</span>
                        <span className="font-mono">${fmt(dscrCalcResult.totalPITI)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Monthly Rent</span>
                        <span className="font-mono">${fmt(dscrCalcResult.monthlyRent)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-border pt-1 mt-1">
                        <span className="text-muted-foreground">Cashflow</span>
                        <span className={`font-mono font-bold ${dscrCalcResult.monthlyCashflow >= 0 ? "text-green-500" : "text-red-500"}`}>
                          ${fmt(dscrCalcResult.monthlyCashflow)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-1 mt-1">
                        <span className="font-semibold text-foreground">Calculated DSCR</span>
                        <span className="font-mono font-bold text-[#997100]">{dscrCalcResult.dscr.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={applyCalculatedDSCR}
                      className="w-full bg-[#997100] hover:bg-[#7a5a00] text-white"
                    >
                      Apply DSCR {dscrCalcResult.dscr.toFixed(2)} to Scenario
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ RIGHT PANEL: Results ═══ */}
          <div className="lg:col-span-8 space-y-4">
            {/* Summary Bar */}
            {results && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-green-500">{results.qualifiedCount}</div>
                      <div className="text-xs text-green-400/70 uppercase tracking-wider mt-1">Qualified</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-500/10 border-red-500/30">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-red-500">{results.disqualifiedCount}</div>
                      <div className="text-xs text-red-400/70 uppercase tracking-wider mt-1">Disqualified</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted border-border">
                    <CardContent className="p-4 text-center">
                      <div className="text-3xl font-bold text-foreground">{results.totalLenders}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Lenders</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Qualified Lenders */}
                <div>
                  <h2 className="text-sm font-semibold text-green-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Qualified Lenders
                  </h2>
                  {results.qualified.length === 0 ? (
                    <Card className="bg-card border-border">
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No lenders match this scenario. Try adjusting your inputs.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {results.qualified.map((r) => (
                        <QualifiedLenderCard
                          key={r.lender.id}
                          result={r}
                          expanded={expandedLender === r.lender.id}
                          onToggle={() => setExpandedLender(expandedLender === r.lender.id ? null : r.lender.id)}
                          loanAmount={app.loanAmount}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Closing Cost Comparison */}
                {results.qualified.length > 1 && (
                  <ClosingCostComparison qualified={results.qualified} loanAmount={app.loanAmount} />
                )}

                {/* Disqualified Lenders */}
                <div>
                  <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Disqualified ({results.disqualifiedCount})
                  </h2>
                  <div className="space-y-1.5">
                    {results.disqualified.map((r) => (
                      <Card key={r.lender.id} className="bg-card/50 border-border">
                        <CardContent className="px-4 py-2.5 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center text-red-500 text-xs mt-0.5 flex-shrink-0">
                              <XCircle className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">{r.lender.name}</div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {r.issues.map((issue, i) => (
                                  <span key={i} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">
                                    {issue.message}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Qualified Lender Card Component
// ═══════════════════════════════════════════════════════

function QualifiedLenderCard({
  result,
  expanded,
  onToggle,
  loanAmount,
}: {
  result: LenderMatchResult
  expanded: boolean
  onToggle: () => void
  loanAmount: number
}) {
  const { lender } = result

  const closingCosts = useMemo(() => {
    if (!expanded || !lender.total_lender_fees) return null
    return estimateClosingCosts({ lender, loanAmount })
  }, [expanded, lender, loanAmount])

  return (
    <Card className="bg-card border-green-500/20 hover:border-green-500/40 transition-colors">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm text-foreground">{lender.name}</div>
            <div className="text-xs text-muted-foreground">
              Max LTV: {result.maxLtv ? `${(result.maxLtv * 100).toFixed(0)}%` : "N/A"}
              {" · "}Min FICO: {lender.min_fico}
              {" · "}DSCR: {lender.min_dscr ? lender.min_dscr : "No min"}
              {" · "}${fmt(lender.min_loan || 0)}-{lender.max_loan ? `$${fmt(lender.max_loan)}` : "No max"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result.warnings.length > 0 && (
            <Badge className="bg-yellow-500/20 text-yellow-500 border-0 text-xs">
              {result.warnings.length} note{result.warnings.length > 1 ? "s" : ""}
            </Badge>
          )}
          {lender.total_lender_fees ? (
            <Badge variant="outline" className="border-border text-muted-foreground text-xs">
              ${fmt(lender.total_lender_fees)} fees
            </Badge>
          ) : null}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-xs">
            <div className="text-muted-foreground">
              Max Units: <span className="text-foreground">{lender.max_units || "No limit"}</span>
            </div>
            <div className="text-muted-foreground">
              LLC Layering: <span className="text-foreground">{lender.llc_layering === "true" ? "Yes" : lender.llc_layering === "false" ? "No" : lender.llc_layering || "---"}</span>
            </div>
            <div className="text-muted-foreground">
              Section 8: <span className="text-foreground">{lender.section8 === "true" ? "Yes" : lender.section8 === "false" ? "No" : lender.section8 || "---"}</span>
            </div>
            <div className="text-muted-foreground">
              Blanket Loans: <span className="text-foreground">{lender.blanket_loans === true ? "Yes" : lender.blanket_loans === false ? "No" : "---"}</span>
            </div>
            <div className="text-muted-foreground">
              Reports Credit: <span className="text-foreground">{lender.report_credit === true ? "Yes" : lender.report_credit === false ? "No" : "---"}</span>
            </div>
            <div className="text-muted-foreground">
              State License: <span className="text-foreground">{lender.state_req === true ? "Yes" : lender.state_req === false ? "No" : "---"}</span>
            </div>
            <div className="text-muted-foreground">
              Recourse: <span className="text-foreground">{lender.recourse || "---"}</span>
            </div>
            <div className="text-muted-foreground">
              Max Term: <span className="text-foreground">{lender.max_term || "---"}</span>
            </div>
            <div className="text-muted-foreground">
              PPP: <span className="text-foreground">{lender.ppp || "---"}</span>
            </div>
            {lender.if_unrented && (
              <div className="text-muted-foreground col-span-2">
                If Unrented: <span className="text-foreground">{lender.if_unrented}</span>
              </div>
            )}
            {lender.contact_email && (
              <div className="text-muted-foreground col-span-2">
                Contact: <span className="text-foreground">{lender.contact_email}</span>
              </div>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="text-xs text-yellow-500 bg-yellow-500/10 rounded px-2 py-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {closingCosts && (
            <div className="mt-3 bg-muted rounded-lg p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Estimated Closing Costs
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lender Fees</span>
                  <span className="font-mono">${fmt(closingCosts.lenderFees)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Broker Fee</span>
                  <span className="font-mono">${fmt(closingCosts.brokerFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Appraisal</span>
                  <span className="font-mono">${fmt(closingCosts.appraisalFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-mono">${fmt(closingCosts.titleFees)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prepaids</span>
                  <span className="font-mono">${fmt(closingCosts.prepaids.total)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-mono font-bold text-[#997100]">${fmt(closingCosts.totalClosingCosts)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════
// Closing Cost Comparison Component
// ═══════════════════════════════════════════════════════

function ClosingCostComparison({
  qualified,
  loanAmount,
}: {
  qualified: LenderMatchResult[]
  loanAmount: number
}) {
  const lendersWithFees = qualified.filter((r) => r.lender.total_lender_fees)
  if (lendersWithFees.length < 2) return null

  const comparison = lendersWithFees
    .map((r) => ({
      name: r.lender.short_name || r.lender.name,
      ...estimateClosingCosts({ lender: r.lender, loanAmount }),
    }))
    .sort((a, b) => a.totalClosingCosts - b.totalClosingCosts)

  const lowest = comparison[0]?.totalClosingCosts || 0

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          Closing Cost Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {comparison.map((c, i) => (
            <div key={c.name} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24 truncate">{c.name}</span>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${lowest > 0 ? Math.min((c.totalClosingCosts / (comparison[comparison.length - 1]?.totalClosingCosts || 1)) * 100, 100) : 0}%`,
                    backgroundColor: i === 0 ? "#16a34a" : i === 1 ? "#997100" : "#6b7280",
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold text-foreground">
                  ${fmt(c.totalClosingCosts)}
                </span>
              </div>
              {i === 0 && (
                <Badge className="bg-green-500/20 text-green-500 border-0 text-xs">Lowest</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
