"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Navigation } from "@/components/shared/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Helpers ───────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "")
  return parseFloat(cleaned) || 0
}

function formatInputCurrency(raw: string): string {
  const num = parseCurrencyInput(raw)
  if (num === 0 && raw === "") return ""
  return num.toLocaleString("en-US")
}

// ─── Rate Calculation Logic ────────────────────────────

function getDscrAdjustment(dscr: number): number {
  if (dscr >= 1.25) return -0.25
  if (dscr >= 1.0) return 0
  if (dscr >= 0.75) return 0.5
  return 1.0 // below 0.75
}

function getCreditAdjustment(creditRange: string): number {
  const map: Record<string, number> = {
    "760+": -0.25,
    "740-759": -0.125,
    "720-739": 0,
    "700-719": 0.25,
    "680-699": 0.5,
    "660-679": 0.75,
    "640-659": 1.0,
    "620-639": 1.25,
  }
  return map[creditRange] ?? 0
}

function getLtvAdjustment(ltv: number): number {
  if (ltv <= 65) return -0.25
  if (ltv <= 70) return -0.125
  if (ltv <= 75) return 0
  if (ltv <= 80) return 0.25
  return 0.5
}

function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number = 30
): number {
  const monthlyRate = annualRate / 100 / 12
  const numPayments = termYears * 12
  if (monthlyRate === 0) return principal / numPayments
  return (
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  )
}

// ─── DSCR Color & Status ──────────────────────────────

function getDscrColor(dscr: number): string {
  if (dscr >= 1.25) return "text-green-500"
  if (dscr >= 1.0) return "text-yellow-500"
  if (dscr >= 0.75) return "text-orange-500"
  return "text-red-500"
}

function getDscrBgColor(dscr: number): string {
  if (dscr >= 1.25) return "bg-green-500/10 border-green-500/30"
  if (dscr >= 1.0) return "bg-yellow-500/10 border-yellow-500/30"
  if (dscr >= 0.75) return "bg-orange-500/10 border-orange-500/30"
  return "bg-red-500/10 border-red-500/30"
}

function getQualificationStatus(dscr: number, creditRange: string, ltv: number) {
  const creditScore = parseInt(creditRange)
  const minCredit = creditRange === "760+" ? 760 : creditScore

  if (dscr >= 1.0 && minCredit >= 680 && ltv <= 80) {
    return {
      label: "Likely Qualified",
      color: "bg-green-500/10 text-green-400 border-green-500/30",
      description: "Based on your inputs, you likely meet standard DSCR guidelines.",
    }
  }
  if (dscr >= 0.75 && minCredit >= 620 && ltv <= 85) {
    return {
      label: "May Need Review",
      color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      description: "You may qualify with certain lenders. A specialist can review your scenario.",
    }
  }
  return {
    label: "Does Not Meet Minimums",
    color: "bg-red-500/10 text-red-400 border-red-500/30",
    description:
      "Based on these inputs, standard DSCR guidelines are not met. Reach out — we may have alternative solutions.",
  }
}

// ─── Currency Input Component ──────────────────────────

function CurrencyInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-300">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
        <Input
          type="text"
          inputMode="numeric"
          className="pl-7 bg-[#111] border-gray-700 text-white placeholder:text-gray-600 focus:border-[#997100] focus:ring-[#997100]/20"
          placeholder={placeholder || "0"}
          value={formatInputCurrency(value)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, "")
            onChange(raw)
          }}
        />
      </div>
    </div>
  )
}

// ─── Main Calculator Component ─────────────────────────

export function DscrCalculator() {
  // Input state
  const [propertyValue, setPropertyValue] = useState("")
  const [loanAmount, setLoanAmount] = useState("")
  const [monthlyRent, setMonthlyRent] = useState("")
  const [monthlyExpenses, setMonthlyExpenses] = useState("")
  const [creditScore, setCreditScore] = useState("720-739")
  const [propertyType, setPropertyType] = useState("single-family")
  const [loanPurpose, setLoanPurpose] = useState("purchase")

  // Parsed values
  const pv = parseCurrencyInput(propertyValue)
  const la = parseCurrencyInput(loanAmount)
  const rent = parseCurrencyInput(monthlyRent)
  const expenses = parseCurrencyInput(monthlyExpenses)

  // Calculations
  const calc = useMemo(() => {
    const dscr = expenses > 0 ? rent / expenses : 0
    const ltv = pv > 0 ? (la / pv) * 100 : 0

    const baseRate = 7.5
    const dscrAdj = getDscrAdjustment(dscr)
    const creditAdj = getCreditAdjustment(creditScore)
    const ltvAdj = getLtvAdjustment(ltv)
    const cashOutAdj = loanPurpose === "cash-out" ? 0.125 : 0
    const strAdj = propertyType === "str" ? 0.25 : 0

    const estimatedRate = baseRate + dscrAdj + creditAdj + ltvAdj + cashOutAdj + strAdj
    const rateLow = Math.max(estimatedRate - 0.25, 5.0)
    const rateHigh = estimatedRate + 0.25

    const monthlyPayment = la > 0 ? calculateMonthlyPayment(la, estimatedRate) : 0

    const closingCostLow = la * 0.02
    const closingCostHigh = la * 0.05

    const qualification = getQualificationStatus(dscr, creditScore, ltv)

    return {
      dscr,
      ltv,
      estimatedRate,
      rateLow,
      rateHigh,
      monthlyPayment,
      closingCostLow,
      closingCostHigh,
      qualification,
    }
  }, [pv, la, rent, expenses, creditScore, propertyType, loanPurpose])

  const hasInputs = pv > 0 && la > 0 && rent > 0 && expenses > 0

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navigation currentPage="/calculator" />

      {/* Hero */}
      <section className="border-b border-gray-800">
        <div className="container mx-auto px-6 py-12 md:py-16">
          <div className="max-w-3xl">
            <Badge className="mb-4 bg-[#997100]/10 text-[#997100] border-[#997100]/30 hover:bg-[#997100]/20">
              Rate Quote Tool
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              DSCR Loan Calculator
            </h1>
            <p className="text-lg text-gray-400">
              Estimate your rate, monthly payment, and qualification status in seconds.
              No personal income needed — just your property numbers.
            </p>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Inputs (left) ── */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="bg-[#111] border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Property &amp; Loan Details</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <CurrencyInput
                  label="Property Value"
                  value={propertyValue}
                  onChange={setPropertyValue}
                  placeholder="350,000"
                />
                <CurrencyInput
                  label="Loan Amount"
                  value={loanAmount}
                  onChange={setLoanAmount}
                  placeholder="262,500"
                />
                <CurrencyInput
                  label="Monthly Rental Income"
                  value={monthlyRent}
                  onChange={setMonthlyRent}
                  placeholder="2,500"
                />
                <CurrencyInput
                  label="Monthly Expenses (PITIA)"
                  value={monthlyExpenses}
                  onChange={setMonthlyExpenses}
                  placeholder="1,800"
                />
              </div>
            </Card>

            <Card className="bg-[#111] border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Borrower &amp; Property Info</h2>
              <div className="grid sm:grid-cols-3 gap-5">
                {/* Credit Score */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-300">Credit Score Range</Label>
                  <Select value={creditScore} onValueChange={setCreditScore}>
                    <SelectTrigger className="bg-[#111] border-gray-700 text-white focus:ring-[#997100]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-gray-700">
                      {[
                        "760+",
                        "740-759",
                        "720-739",
                        "700-719",
                        "680-699",
                        "660-679",
                        "640-659",
                        "620-639",
                      ].map((range) => (
                        <SelectItem key={range} value={range} className="text-white hover:bg-gray-800">
                          {range}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Property Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-300">Property Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="bg-[#111] border-gray-700 text-white focus:ring-[#997100]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-gray-700">
                      <SelectItem value="single-family" className="text-white hover:bg-gray-800">Single Family</SelectItem>
                      <SelectItem value="2-4-unit" className="text-white hover:bg-gray-800">2-4 Unit</SelectItem>
                      <SelectItem value="condo" className="text-white hover:bg-gray-800">Condo</SelectItem>
                      <SelectItem value="townhome" className="text-white hover:bg-gray-800">Townhome</SelectItem>
                      <SelectItem value="str" className="text-white hover:bg-gray-800">Short-Term Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Loan Purpose */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-300">Loan Purpose</Label>
                  <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                    <SelectTrigger className="bg-[#111] border-gray-700 text-white focus:ring-[#997100]/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1a] border-gray-700">
                      <SelectItem value="purchase" className="text-white hover:bg-gray-800">Purchase</SelectItem>
                      <SelectItem value="rate-term" className="text-white hover:bg-gray-800">Rate/Term Refinance</SelectItem>
                      <SelectItem value="cash-out" className="text-white hover:bg-gray-800">Cash-Out Refinance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Results (right) ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* DSCR Ratio */}
            <Card className={`border p-5 ${hasInputs ? getDscrBgColor(calc.dscr) : "bg-[#111] border-gray-800"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-400">DSCR Ratio</span>
                {hasInputs && calc.dscr >= 1.25 && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Strong</Badge>
                )}
                {hasInputs && calc.dscr >= 1.0 && calc.dscr < 1.25 && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Acceptable</Badge>
                )}
                {hasInputs && calc.dscr >= 0.75 && calc.dscr < 1.0 && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Below Break-Even</Badge>
                )}
                {hasInputs && calc.dscr < 0.75 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Low</Badge>
                )}
              </div>
              <p className={`text-3xl font-bold ${hasInputs ? getDscrColor(calc.dscr) : "text-gray-600"}`}>
                {hasInputs ? calc.dscr.toFixed(2) : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Rental Income / PITIA</p>
            </Card>

            {/* LTV */}
            <Card className="bg-[#111] border-gray-800 p-5">
              <span className="text-sm font-medium text-gray-400">Loan-to-Value (LTV)</span>
              <p className="text-3xl font-bold text-white mt-1">
                {hasInputs ? `${calc.ltv.toFixed(1)}%` : "—"}
              </p>
            </Card>

            {/* Estimated Rate */}
            <Card className="bg-[#111] border-gray-800 p-5">
              <span className="text-sm font-medium text-gray-400">Estimated Rate Range</span>
              <p className="text-3xl font-bold text-[#997100] mt-1">
                {hasInputs ? `${calc.rateLow.toFixed(2)}% – ${calc.rateHigh.toFixed(2)}%` : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-1">30-year fixed, full amortization</p>
            </Card>

            {/* Monthly Payment */}
            <Card className="bg-[#111] border-gray-800 p-5">
              <span className="text-sm font-medium text-gray-400">Est. Monthly Payment (P&amp;I)</span>
              <p className="text-3xl font-bold text-white mt-1">
                {hasInputs ? formatCurrency(calc.monthlyPayment) : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Principal &amp; interest only, excludes escrow</p>
            </Card>

            {/* Closing Costs */}
            <Card className="bg-[#111] border-gray-800 p-5">
              <span className="text-sm font-medium text-gray-400">Est. Closing Costs</span>
              <p className="text-2xl font-bold text-white mt-1">
                {hasInputs
                  ? `${formatCurrency(calc.closingCostLow)} – ${formatCurrency(calc.closingCostHigh)}`
                  : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-1">2–5% of loan amount (title, appraisal, lender fees, prepaids)</p>
            </Card>

            {/* Qualification */}
            <Card className={`border p-5 ${hasInputs ? calc.qualification.color.replace("text-", "bg-").split(" ")[0] + " " + calc.qualification.color.split(" ").slice(1).join(" ") : "bg-[#111] border-gray-800"}`}>
              <span className="text-sm font-medium text-gray-400">Qualification Status</span>
              {hasInputs ? (
                <>
                  <p className={`text-xl font-bold mt-1 ${calc.qualification.color.split(" ")[1]}`}>
                    {calc.qualification.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{calc.qualification.description}</p>
                </>
              ) : (
                <p className="text-xl font-bold text-gray-600 mt-1">—</p>
              )}
            </Card>

            {/* CTAs */}
            <div className="space-y-3 pt-2">
              <Button
                asChild
                className="w-full bg-[#997100] hover:bg-[#b8850a] text-white font-semibold py-6 text-base"
              >
                <Link href="/start?next=/apply">Start My Application</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white py-6 text-base"
              >
                <Link href="/contact">Talk to a Specialist</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="container mx-auto px-6 pb-8">
        <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
          This calculator provides estimates only. Actual rates, terms, and qualification depend on
          full underwriting review, property appraisal, and lender guidelines. Rates are subject to
          change without notice. This is not a commitment to lend or a loan approval. Contact a Preme
          Home Loans specialist for a personalized quote. NMLS 2560616.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-800">
        <div className="container mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-white mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
            <Card className="bg-[#111] border-gray-800 p-6">
              <h3 className="text-base font-semibold text-white mb-2">What is a DSCR loan?</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                A DSCR (Debt Service Coverage Ratio) loan is an investment property mortgage that
                qualifies borrowers based on the property&apos;s rental income rather than personal
                income. If the property&apos;s rent covers the mortgage payment, you can qualify — no
                tax returns or W-2s needed.
              </p>
            </Card>
            <Card className="bg-[#111] border-gray-800 p-6">
              <h3 className="text-base font-semibold text-white mb-2">
                What DSCR ratio do I need to qualify?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Most lenders require a minimum DSCR of 0.75, meaning the property&apos;s rental income
                covers at least 75% of the total mortgage payment (PITIA). A DSCR of 1.25 or higher
                typically gets the best rates and most lender options.
              </p>
            </Card>
            <Card className="bg-[#111] border-gray-800 p-6">
              <h3 className="text-base font-semibold text-white mb-2">
                How are DSCR loan rates determined?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                DSCR loan rates depend on several factors: your DSCR ratio, credit score,
                loan-to-value (LTV), property type, and loan purpose. Higher DSCR ratios, higher
                credit scores, and lower LTVs all lead to better rates.
              </p>
            </Card>
            <Card className="bg-[#111] border-gray-800 p-6">
              <h3 className="text-base font-semibold text-white mb-2">
                Can I get a DSCR loan with no rental history?
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Yes. Many DSCR lenders accept market rent projections from an appraiser, even if the
                property has no current tenants. This is common for purchase transactions and newly
                renovated properties.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
