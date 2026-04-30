"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, Mail, Phone, User, Loader2, CheckCircle2 } from "lucide-react"

export type PrequalResult = {
  applicationId: string
  guestToken: string
  applicationNumber: string
  qualifiedCount: number
  topLender: { name: string | null; min_fico: number | null; maxLtvPurchase: number | null } | null
  matchReason: string | null
}

interface PrequalifyFormProps {
  onApproved: (result: PrequalResult) => void
}

export function PrequalifyForm({ onApproved }: PrequalifyFormProps) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    loanPurpose: "Purchase",
    loanAmount: "",
    propertyValue: "",
    propertyState: "",
    propertyType: "single-family",
    creditScore: "",
    rentalGrossMonthly: "",
    vestingType: "Individual",
    tcpaConsent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (f: string, v: string | boolean) => setForm({ ...form, [f]: v })

  const valid =
    form.firstName && form.lastName && form.email && form.phone &&
    form.loanPurpose && form.loanAmount && form.propertyValue &&
    form.propertyState && form.creditScore && form.tcpaConsent

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        is_pre_qual: true,
        is_guest: true,
        applicant_email: form.email,
        applicant_name: `${form.firstName} ${form.lastName}`.trim(),
        applicant_first_name: form.firstName,
        applicant_last_name: form.lastName,
        applicant_phone: form.phone,
        loan_purpose: form.loanPurpose,
        loan_amount: Number(form.loanAmount) || 0,
        property_value: Number(form.propertyValue) || 0,
        property_state: form.propertyState.toUpperCase(),
        property_type: form.propertyType,
        property_usage_type: "Investment",
        credit_score_range: form.creditScore,
        rental_gross_monthly: Number(form.rentalGrossMonthly) || null,
        vesting_type: form.vestingType,
        credit_report_authorization_indicator: true,
      }
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Submission failed")
      onApproved({
        applicationId: j.application.id,
        guestToken: j.application.guest_token,
        applicationNumber: j.application.application_number,
        qualifiedCount: j.lenderMatch?.qualifiedCount ?? 0,
        topLender: j.lenderMatch?.topLender ?? null,
        matchReason: j.lenderMatch?.reason ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Get Pre-Qualified in 60 Seconds</CardTitle>
          <CardDescription>
            Ten quick questions. We'll match you against our DSCR lender guidelines and show you where you stand — no credit pull, no SSN required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jane" className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Tester" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 123-4567" className="pl-10" />
              </div>
            </div>
          </div>

          {/* Loan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Purpose *</Label>
              <Select value={form.loanPurpose} onValueChange={(v) => set("loanPurpose", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Purchase">Purchase</SelectItem>
                  <SelectItem value="Refinance">Rate/Term Refinance</SelectItem>
                  <SelectItem value="CashOutRefinance">Cash-Out Refinance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Amount *</Label>
              <Input type="number" value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)} placeholder="250000" />
            </div>
          </div>

          {/* Property */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Property State *</Label>
              <Input value={form.propertyState} onChange={(e) => set("propertyState", e.target.value)} maxLength={2} placeholder="GA" />
            </div>
            <div className="space-y-2">
              <Label>Property Type</Label>
              <Select value={form.propertyType} onValueChange={(v) => set("propertyType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-family">Single Family</SelectItem>
                  <SelectItem value="multi-family">2–4 Unit</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="townhouse">Townhouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estimated Value *</Label>
              <Input type="number" value={form.propertyValue} onChange={(e) => set("propertyValue", e.target.value)} placeholder="350000" />
            </div>
          </div>

          {/* Credit + Rent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated Credit Score *</Label>
              <Select value={form.creditScore} onValueChange={(v) => set("creditScore", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="800+">Excellent (800+)</SelectItem>
                  <SelectItem value="740-799">Very Good (740–799)</SelectItem>
                  <SelectItem value="670-739">Good (670–739)</SelectItem>
                  <SelectItem value="580-669">Fair (580–669)</SelectItem>
                  <SelectItem value="300-579">Poor (&lt;580)</SelectItem>
                  <SelectItem value="unknown">Don't Know</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expected Monthly Rent</Label>
              <Input type="number" value={form.rentalGrossMonthly} onChange={(e) => set("rentalGrossMonthly", e.target.value)} placeholder="2400" />
              <p className="text-xs text-muted-foreground">Market rent or actual lease — used for DSCR check.</p>
            </div>
          </div>

          {/* Vesting */}
          <div className="space-y-2">
            <Label>How will you take title?</Label>
            <Select value={form.vestingType} onValueChange={(v) => set("vestingType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Individual">My personal name</SelectItem>
                <SelectItem value="Entity">An LLC or Corp (you'll add details later)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* TCPA */}
          <div className="flex items-start gap-3 pt-2">
            <input type="checkbox" id="tcpa" checked={form.tcpaConsent} onChange={(e) => set("tcpaConsent", e.target.checked)} className="mt-1 h-4 w-4" />
            <label htmlFor="tcpa" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I consent to receive texts and calls (including automated) from Preme Home Loans about my inquiry. Reply STOP to opt out.
            </label>
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{error}</div>}

          <Button onClick={submit} disabled={!valid || submitting} className="w-full py-6 text-base">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking lenders…</>
                         : <>Get My Pre-Qualification<ArrowRight className="ml-2 h-4 w-4" /></>}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            <CheckCircle2 className="inline h-3 w-3 mr-1" /> Soft check — no impact on credit score
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
