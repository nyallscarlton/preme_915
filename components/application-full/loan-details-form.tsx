"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, ArrowLeft } from "lucide-react"

interface LoanDetailsFormProps {
  onNext: () => void
  onPrevious?: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function LoanDetailsForm({ onNext, onPrevious, onDataChange, initialData }: LoanDetailsFormProps) {
  const [formData, setFormData] = useState({
    loanAmount: initialData.loanAmount || "",
    loanPurpose: initialData.loanPurpose || "",
    mortgageType: initialData.mortgageType || "Conventional",
    loanTermMonths: initialData.loanTermMonths || "360",
    amortizationType: initialData.amortizationType || "Fixed",
    noteRatePercent: initialData.noteRatePercent || "",
    interestOnly: initialData.interestOnly || false,
    balloon: initialData.balloon || false,
    hasPrepayPenalty: initialData.hasPrepayPenalty || true,
    isRenovationLoan: initialData.isRenovationLoan || false,
    totalMortgagedPropertiesCount: initialData.totalMortgagedPropertiesCount || "",
    // Refi-only
    propertyAcquiredDate: initialData.propertyAcquiredDate || "",
    propertyOriginalCost: initialData.propertyOriginalCost || "",
    propertyExistingLienAmount: initialData.propertyExistingLienAmount || "",
    ...initialData,
  })

  const update = (f: string, v: string | boolean) => {
    const next = { ...formData, [f]: v }
    setFormData(next)
    onDataChange(next)
  }

  const isRefi = /refi/i.test(formData.loanPurpose)
  const valid = formData.loanAmount && formData.loanPurpose && formData.loanTermMonths

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Loan Details</CardTitle>
          <CardDescription>Terms of the loan you're requesting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Amount *</Label>
              <Input type="number" value={formData.loanAmount} onChange={(e) => update("loanAmount", e.target.value)} placeholder="250000" />
            </div>
            <div className="space-y-2">
              <Label>Loan Purpose *</Label>
              <Select value={formData.loanPurpose} onValueChange={(v) => update("loanPurpose", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="Refinance">Rate/Term Refinance</SelectItem>
                  <SelectItem value="CashOutRefinance">Cash-Out Refinance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Mortgage Type</Label>
              <Select value={formData.mortgageType} onValueChange={(v) => update("mortgageType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conventional">Conventional</SelectItem>
                  <SelectItem value="FHA">FHA</SelectItem>
                  <SelectItem value="VA">VA</SelectItem>
                  <SelectItem value="USDARuralDevelopment">USDA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Term (months) *</Label>
              <Select value={formData.loanTermMonths} onValueChange={(v) => update("loanTermMonths", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="120">10 years (120 mo)</SelectItem>
                  <SelectItem value="180">15 years (180 mo)</SelectItem>
                  <SelectItem value="240">20 years (240 mo)</SelectItem>
                  <SelectItem value="300">25 years (300 mo)</SelectItem>
                  <SelectItem value="360">30 years (360 mo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amortization</Label>
              <Select value={formData.amortizationType} onValueChange={(v) => update("amortizationType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">Fixed</SelectItem>
                  <SelectItem value="AdjustableRate">Adjustable (ARM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Note Rate % (if known)</Label>
              <Input type="number" step="0.001" value={formData.noteRatePercent} onChange={(e) => update("noteRatePercent", e.target.value)} placeholder="7.875" />
            </div>
            <div className="space-y-2">
              <Label>Total financed rental properties you own</Label>
              <Input type="number" min={0} value={formData.totalMortgagedPropertiesCount} onChange={(e) => update("totalMortgagedPropertiesCount", e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.interestOnly} onChange={(e) => update("interestOnly", e.target.checked)} /> Interest-only</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.balloon} onChange={(e) => update("balloon", e.target.checked)} /> Balloon</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.hasPrepayPenalty} onChange={(e) => update("hasPrepayPenalty", e.target.checked)} /> Prepayment penalty acceptable</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formData.isRenovationLoan} onChange={(e) => update("isRenovationLoan", e.target.checked)} /> Renovation loan</label>
          </div>

          {isRefi && (
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="px-2 text-sm font-semibold">Refinance Details</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Property Acquired Date</Label>
                  <Input type="date" value={formData.propertyAcquiredDate} onChange={(e) => update("propertyAcquiredDate", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Original Purchase Price</Label>
                  <Input type="number" value={formData.propertyOriginalCost} onChange={(e) => update("propertyOriginalCost", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Existing Lien Balance</Label>
                  <Input type="number" value={formData.propertyExistingLienAmount} onChange={(e) => update("propertyExistingLienAmount", e.target.value)} />
                </div>
              </div>
            </fieldset>
          )}

          <div className="flex justify-between pt-4">
            {onPrevious && <Button onClick={onPrevious} variant="outline" className="px-8"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>}
            <Button onClick={onNext} disabled={!valid} className="px-8 ml-auto">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
