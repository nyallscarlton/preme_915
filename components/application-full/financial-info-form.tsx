"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight } from "lucide-react"

interface FinancialInfoFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

const DECLARATIONS: Array<{ key: string; label: string }> = [
  { key: "intent_to_occupy", label: "Will you occupy the property as your primary residence?" },
  { key: "homeowner_past_3yrs", label: "Have you owned a home in the past 3 years?" },
  { key: "bankruptcy", label: "Have you declared bankruptcy in the past 7 years?" },
  { key: "outstanding_judgments", label: "Are there outstanding judgments against you?" },
  { key: "party_to_lawsuit", label: "Are you currently a party to a lawsuit?" },
  { key: "presently_delinquent_federal_debt", label: "Are you delinquent on any federal debt?" },
  { key: "undisclosed_borrowed_funds", label: "Have you undisclosed borrowed funds for down payment?" },
  { key: "undisclosed_mortgage_application", label: "Have you applied for another mortgage not disclosed?" },
  { key: "undisclosed_credit_application", label: "Have you applied for other credit not disclosed?" },
  { key: "undisclosed_comaker", label: "Are you a co-maker or endorser on any note?" },
  { key: "prior_deed_in_lieu", label: "Have you conveyed title via deed-in-lieu in past 7 years?" },
  { key: "prior_short_sale", label: "Have you completed a short sale in past 7 years?" },
  { key: "prior_foreclosure", label: "Have you had a foreclosure in past 7 years?" },
  { key: "proposed_clean_energy_lien", label: "Is there a proposed clean-energy (PACE) lien?" },
]

export function FinancialInfoForm({ onNext, onPrevious, onDataChange, initialData }: FinancialInfoFormProps) {
  const [formData, setFormData] = useState<any>({
    creditScore: initialData.creditScore || "",
    creditScoreExact: initialData.creditScoreExact || "",
    employerName: initialData.employerName || "",
    employmentStatus: initialData.employmentStatus || "",
    annualIncome: initialData.annualIncome || "",
    // Declarations (prefix decl_ to keep state flat)
    ...Object.fromEntries(DECLARATIONS.map((d) => [`decl_${d.key}`, initialData[`decl_${d.key}`] ?? null])),
    decl_bankruptcy_chapter: initialData.decl_bankruptcy_chapter || "",
    decl_bankruptcy_filed_date: initialData.decl_bankruptcy_filed_date || "",
    decl_bankruptcy_discharged_date: initialData.decl_bankruptcy_discharged_date || "",
    decl_undisclosed_borrowed_funds_amount: initialData.decl_undisclosed_borrowed_funds_amount || "",
    hmda_gender: initialData.hmda_gender || "",
    hmda_ethnicity_refused: initialData.hmda_ethnicity_refused ?? true,
    hmda_race_refused: initialData.hmda_race_refused ?? true,
    ...initialData,
  })

  const update = (f: string, v: any) => {
    const next = { ...formData, [f]: v }
    setFormData(next)
    onDataChange(next)
  }

  const setDecl = (key: string, answer: boolean) => update(`decl_${key}`, answer)

  const valid = formData.creditScore

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Financial & Declarations</CardTitle>
          <CardDescription>Credit profile and the standard 1003 disclosures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Credit Score Range *</Label>
              <Select value={formData.creditScore} onValueChange={(v) => update("creditScore", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="800+">Excellent (800+)</SelectItem>
                  <SelectItem value="740-799">Very Good (740-799)</SelectItem>
                  <SelectItem value="670-739">Good (670-739)</SelectItem>
                  <SelectItem value="580-669">Fair (580-669)</SelectItem>
                  <SelectItem value="300-579">Poor (300-579)</SelectItem>
                  <SelectItem value="unknown">Don't Know</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exact Credit Score (if known)</Label>
              <Input type="number" min={300} max={900} value={formData.creditScoreExact} onChange={(e) => update("creditScoreExact", e.target.value)} placeholder="745" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Employer Name</Label>
              <Input value={formData.employerName} onChange={(e) => update("employerName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employment Status</Label>
              <Select value={formData.employmentStatus} onValueChange={(v) => update("employmentStatus", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employed">Employed</SelectItem>
                  <SelectItem value="SelfEmployed">Self-Employed</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                  <SelectItem value="NotEmployed">Not Employed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Annual Income (optional)</Label>
              <Input type="number" value={formData.annualIncome} onChange={(e) => update("annualIncome", e.target.value)} placeholder="0 for pure-DSCR" />
            </div>
          </div>

          <fieldset className="border rounded-lg p-4 space-y-3">
            <legend className="px-2 text-sm font-semibold">Borrower Declarations (1003 Section 5)</legend>
            {DECLARATIONS.map((d) => {
              const v = formData[`decl_${d.key}`]
              return (
                <div key={d.key} className="flex items-start gap-4 py-1">
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className={`px-3 py-1 text-xs rounded border ${v === true ? "bg-primary text-primary-foreground border-primary" : "border-border"}`} onClick={() => setDecl(d.key, true)}>Yes</button>
                    <button type="button" className={`px-3 py-1 text-xs rounded border ${v === false ? "bg-primary text-primary-foreground border-primary" : "border-border"}`} onClick={() => setDecl(d.key, false)}>No</button>
                  </div>
                  <span className="text-sm pt-1">{d.label}</span>
                </div>
              )
            })}
            {formData.decl_bankruptcy === true && (
              <div className="border-t pt-3 mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Bankruptcy Chapter</Label>
                  <Select value={formData.decl_bankruptcy_chapter} onValueChange={(v) => update("decl_bankruptcy_chapter", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Chapter7">Chapter 7</SelectItem>
                      <SelectItem value="Chapter11">Chapter 11</SelectItem>
                      <SelectItem value="Chapter12">Chapter 12</SelectItem>
                      <SelectItem value="Chapter13">Chapter 13</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Filed Date</Label>
                  <Input type="date" value={formData.decl_bankruptcy_filed_date} onChange={(e) => update("decl_bankruptcy_filed_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Discharged Date</Label>
                  <Input type="date" value={formData.decl_bankruptcy_discharged_date} onChange={(e) => update("decl_bankruptcy_discharged_date", e.target.value)} />
                </div>
              </div>
            )}
            {formData.decl_undisclosed_borrowed_funds === true && (
              <div className="space-y-2 pt-2">
                <Label>Undisclosed Borrowed Funds Amount</Label>
                <Input type="number" value={formData.decl_undisclosed_borrowed_funds_amount} onChange={(e) => update("decl_undisclosed_borrowed_funds_amount", e.target.value)} />
              </div>
            )}
          </fieldset>

          <fieldset className="border rounded-lg p-4 space-y-3">
            <legend className="px-2 text-sm font-semibold">HMDA Demographics (Optional)</legend>
            <p className="text-xs text-muted-foreground">You may decline to answer. Most DSCR loans are HMDA-exempt; lenders ask anyway.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select value={formData.hmda_gender} onValueChange={(v) => update("hmda_gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select or decline" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="NotProvided">I do not wish to provide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm pt-8">
                <input type="checkbox" checked={formData.hmda_ethnicity_refused} onChange={(e) => update("hmda_ethnicity_refused", e.target.checked)} /> I decline to provide ethnicity
              </label>
              <label className="flex items-center gap-2 text-sm pt-8">
                <input type="checkbox" checked={formData.hmda_race_refused} onChange={(e) => update("hmda_race_refused", e.target.checked)} /> I decline to provide race
              </label>
            </div>
          </fieldset>

          <div className="flex justify-between pt-4">
            <Button onClick={onPrevious} variant="outline" className="px-8"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={onNext} disabled={!valid} className="px-8">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
