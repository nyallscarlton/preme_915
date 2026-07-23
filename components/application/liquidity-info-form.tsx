"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight, Wallet } from "lucide-react"

interface LiquidityInfoFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function LiquidityInfoForm({ onNext, onPrevious, onDataChange, initialData }: LiquidityInfoFormProps) {
  const [formData, setFormData] = useState({
    cashReserves: initialData.cashReserves || "",
    investmentAccounts: initialData.investmentAccounts || "",
    retirementAccounts: initialData.retirementAccounts || "",
    otherAssets: initialData.otherAssets || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const totalLiquidity = [
    formData.cashReserves,
    formData.investmentAccounts,
    formData.retirementAccounts,
    formData.otherAssets,
  ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0)

  // ── Preliminary cash-to-close floor ────────────────────────────────────
  // Conservative LOWEST-case planning number from what we know so far:
  //   down payment (purchase price − loan, purchases only)
  //   + closing costs (~3% of loan)
  //   + lender reserves (6 months est. P&I — most DSCR lenders' minimum)
  // Educational only — clearly disclaimed as not a Loan Estimate below.
  const loanAmt = Number.parseFloat(formData.loanAmount) || 0
  const purpose = formData.loanPurpose || ""
  const priceBasis =
    purpose === "purchase"
      ? Number.parseFloat(formData.purchasePrice) || Number.parseFloat(formData.propertyValue) || 0
      : 0
  const estDownPayment = purpose === "purchase" ? Math.max(0, priceBasis - loanAmt) : 0
  const estClosingCosts = loanAmt * 0.03
  const estMonthlyPI = loanAmt * 0.007 // ≈ 30-yr amortized at high-7s — planning figure only
  const estReserves = estMonthlyPI * 6
  const estCashToClose = loanAmt > 0 ? estDownPayment + estClosingCosts + estReserves : 0
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Liquidity & Assets</CardTitle>
          <CardDescription className="text-muted-foreground">
            Tell us about your available assets and reserves
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {estCashToClose > 0 && (
            <div className="rounded-lg border border-[#997100]/40 bg-[#997100]/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-[#997100]/10 p-2">
                  <Wallet className="h-5 w-5 text-[#997100]" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">
                    Heads up — based on what you've told us so far, plan on having about{" "}
                    <span className="text-[#997100]">{fmt(estCashToClose)}</span> in immediately
                    accessible funds at closing.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    That's our lowest-case planning figure:
                    {estDownPayment > 0 && <> down payment ≈ {fmt(estDownPayment)},</>}{" "}
                    closing costs ≈ {fmt(estClosingCosts)}, and the ~6 months of payment reserves
                    ({fmt(estReserves)}) most lenders want to see in your accounts.
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground/80">
                    This is a preliminary, non-binding estimate for planning purposes only — it is
                    not a Loan Estimate, a loan offer, or a commitment to lend. Your actual
                    cash-to-close and reserve requirements are set by the lender and disclosed in
                    your official Loan Estimate after your application is processed.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cashReserves" className="text-foreground">
                Cash Reserves
              </Label>
              <Input
                id="cashReserves"
                type="number"
                placeholder="50000"
                value={formData.cashReserves}
                onChange={(e) => handleInputChange("cashReserves", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Checking, savings, money market accounts</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="investmentAccounts" className="text-foreground">
                Investment Accounts
              </Label>
              <Input
                id="investmentAccounts"
                type="number"
                placeholder="100000"
                value={formData.investmentAccounts}
                onChange={(e) => handleInputChange("investmentAccounts", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Stocks, bonds, mutual funds, brokerage accounts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="retirementAccounts" className="text-foreground">
                Retirement Accounts
              </Label>
              <Input
                id="retirementAccounts"
                type="number"
                placeholder="200000"
                value={formData.retirementAccounts}
                onChange={(e) => handleInputChange("retirementAccounts", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">401(k), IRA, pension funds</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherAssets" className="text-foreground">
                Other Assets
              </Label>
              <Input
                id="otherAssets"
                type="number"
                placeholder="25000"
                value={formData.otherAssets}
                onChange={(e) => handleInputChange("otherAssets", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Real estate, vehicles, collectibles, etc.</p>
            </div>
          </div>

          {totalLiquidity > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">Total Liquidity:</span>
                <span className="text-primary font-bold text-lg">${totalLiquidity.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6">
            <Button
              onClick={onPrevious}
              variant="outline"
              className="border-border text-foreground hover:bg-muted bg-transparent font-semibold px-8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={onNext}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
            >
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
