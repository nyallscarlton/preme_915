"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calculator, ExternalLink, Loader2, Send } from "lucide-react"
import {
  computeScenario,
  stateFeeDefaults,
  TERM_SHEET_DISCLAIMER,
  type TermSheetInputs,
  type LoanProduct,
} from "@/lib/term-sheet-math"

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`

function Num({
  label,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  suffix?: string
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}{suffix ? ` (${suffix})` : ""}
      </span>
      <Input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number.parseFloat(e.target.value) || 0)}
        className="h-8 bg-input border-border text-sm"
      />
    </label>
  )
}

interface Lever { label: string; ratePercent: number; brokerPoints: number; lenderPoints: number }

export function TermSheetCalculator({ app }: { app: Record<string, any> }) {
  const [open, setOpen] = useState(false)

  const initialPurpose: LoanProduct =
    app.loan_purpose === "purchase" ? "purchase"
    : app.loan_purpose === "cash-out-refinance" ? "cash-out-refinance"
    : app.loan_purpose === "bridge-loan" ? "bridge"
    : app.loan_purpose === "renovation" || app.loan_purpose === "construction" ? "fix-flip"
    : "refinance"
  const state = (app.property_state || "GA").toUpperCase().slice(0, 2)
  const loanAmount = Number(app.loan_amount) || 0

  const feeDefaults = stateFeeDefaults(state, loanAmount)
  const [base, setBase] = useState<Omit<TermSheetInputs, "ratePercent" | "brokerPoints" | "lenderPoints">>({
    purpose: initialPurpose,
    state,
    purchasePrice: Number(app.purchase_price) || Number(app.property_value) || 0,
    propertyValue: Number(app.property_value) || 0,
    loanAmount,
    currentBalance: Number(app.current_mortgage_balance) || 0,
    monthlyRent: Number(app.rental_gross_monthly) || 0,
    annualTaxes: Number(app.annual_property_tax) || Math.round((Number(app.property_value) || 0) * 0.012),
    annualInsurance: Math.round(((Number(app.property_value) || 0) * 0.005) || 1200),
    monthlyHoa: Number(app.hoa_monthly) || 0,
    termMonths: ["bridge", "fix-flip"].includes(initialPurpose) ? 12 : 360,
    interestOnly: false,
    rehabBudget: 0,
    arv: 0,
    pctRehabFinanced: 100,
    holdMonths: 6,
    sellerCredit: 0,
    lenderFlatFees: 1495,
    ...feeDefaults,
    escrowMonthsTaxes: 3,
    escrowMonthsInsurance: 2,
    prepaidInterestDays: 15,
  })

  const [levers, setLevers] = useState<Lever[]>([
    { label: "Lower Rate", ratePercent: 7.375, brokerPoints: 2.5, lenderPoints: 1.5 },
    { label: "Balanced", ratePercent: 7.625, brokerPoints: 2.25, lenderPoints: 1.0 },
    { label: "Lower Cash", ratePercent: 7.99, brokerPoints: 2.0, lenderPoints: 0 },
  ])

  // Reopen where the last term sheet left off — product, inputs, and levers
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!open || hydrated) return
    ;(async () => {
      try {
        const res = await fetch(`/api/applications/${app.id}/term-sheet`)
        const data = await res.json()
        if (data.latest?.inputs) {
          const { ratePercent: _r, brokerPoints: _b, lenderPoints: _l, ...savedBase } = data.latest.inputs
          setBase((prev) => ({ ...prev, ...savedBase }))
          if (Array.isArray(data.latest.scenarios) && data.latest.scenarios.length === 3) {
            setLevers(
              data.latest.scenarios.map((sc: any) => ({
                label: sc.label,
                ratePercent: sc.ratePercent,
                brokerPoints: sc.brokerPoints,
                lenderPoints: sc.lenderPoints,
              }))
            )
          }
        }
      } catch {
        // no saved sheet — file defaults stand
      } finally {
        setHydrated(true)
      }
    })()
  }, [open, hydrated, app.id])

  // LTV is a READOUT (loan ÷ value), never an input. Red when it exceeds
  // what this client's matched lender allows.
  const clientMaxLtv = (() => {
    const m = app.pre_qual_lender_match?.topLender?.maxLtvPurchase
    return typeof m === "number" && m > 0 ? (m <= 1 ? m * 100 : m) : 80
  })()
  const lenderName = app.pre_qual_lender_match?.topLender?.name || null

  const [sending, setSending] = useState<"pdf" | "send" | null>(null)
  const [result, setResult] = useState<{ msg: string; pdfUrl?: string | null } | null>(null)

  const scenarios = useMemo(
    () =>
      levers.map((l) =>
        computeScenario(
          { ...base, ratePercent: l.ratePercent, brokerPoints: l.brokerPoints, lenderPoints: l.lenderPoints },
          l.label
        )
      ),
    [base, levers]
  )

  const setB = (k: keyof typeof base) => (v: number) => setBase((p) => ({ ...p, [k]: v }))
  const setL = (idx: number, k: keyof Lever) => (v: number) =>
    setLevers((p) => p.map((l, i) => (i === idx ? { ...l, [k]: v } : l)))

  const generate = async (send: boolean) => {
    setSending(send ? "send" : "pdf")
    setResult(null)
    try {
      const res = await fetch(`/api/applications/${app.id}/term-sheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: { ...base, ratePercent: 0, brokerPoints: 0, lenderPoints: 0 }, scenarios: levers, send }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setResult({
        msg: send
          ? `Sent${data.smsSent ? " · text ✓" : ""}${data.emailSent ? " · email ✓" : ""}`
          : "PDF generated",
        pdfUrl: data.pdfUrl,
      })
    } catch (e) {
      setResult({ msg: e instanceof Error ? e.message : "Failed" })
    } finally {
      setSending(null)
    }
  }

  const isPurchase = base.purpose === "purchase"
  const isShortTerm = base.purpose === "bridge" || base.purpose === "fix-flip"
  const isFlip = base.purpose === "fix-flip"

  const switchProduct = (p: LoanProduct) => {
    setBase((prev) => ({ ...prev, purpose: p, termMonths: p === "bridge" || p === "fix-flip" ? 12 : 360 }))
    // Short-term money prices differently — reset scenario rates to the product's range
    if (p === "bridge" || p === "fix-flip") {
      setLevers([
        { label: "Lower Rate", ratePercent: 10.5, brokerPoints: 2.5, lenderPoints: 2 },
        { label: "Balanced", ratePercent: 11.25, brokerPoints: 2.25, lenderPoints: 1.5 },
        { label: "Lower Cash", ratePercent: 12.25, brokerPoints: 2.0, lenderPoints: 1 },
      ])
    } else {
      setLevers([
        { label: "Lower Rate", ratePercent: 7.375, brokerPoints: 2.5, lenderPoints: 1.5 },
        { label: "Balanced", ratePercent: 7.625, brokerPoints: 2.25, lenderPoints: 1.0 },
        { label: "Lower Cash", ratePercent: 7.99, brokerPoints: 2.0, lenderPoints: 0 },
      ])
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-black bg-transparent"
      >
        <Calculator className="mr-1.5 h-4 w-4" />
        Term Sheet
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto bg-card border-border sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Term Sheet — {app.applicant_name} <span className="ml-2 text-sm font-normal text-muted-foreground">{state} · {base.purpose.replace(/-/g, " ")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Product switcher */}
          <div className="flex flex-wrap gap-1.5">
            {([["purchase","Purchase"],["refinance","Rate/Term Refi"],["cash-out-refinance","Cash-Out Refi"],["bridge","Bridge / Hard Money"],["fix-flip","Fix & Flip"]] as [LoanProduct,string][]).map(([v,l]) => (
              <button
                key={v}
                onClick={() => switchProduct(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${base.purpose === v ? "bg-[#997100] text-black" : "border border-border text-muted-foreground hover:text-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Deal basics */}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Num label="Loan Amount" value={base.loanAmount} onChange={setB("loanAmount")} step={1000} />
            {isPurchase || isShortTerm ? (
              <Num label={isFlip ? "Purchase Price" : "Purchase Price / Basis"} value={base.purchasePrice} onChange={setB("purchasePrice")} step={1000} />
            ) : (
              <Num label="Payoff Balance" value={base.currentBalance} onChange={setB("currentBalance")} step={1000} />
            )}
            <Num label="Property Value" value={base.propertyValue} onChange={setB("propertyValue")} step={1000} />
            <Num label="Monthly Rent" value={base.monthlyRent} onChange={setB("monthlyRent")} step={50} />
            <Num label="Annual Taxes" value={base.annualTaxes} onChange={setB("annualTaxes")} step={100} />
            <Num label="Annual Insurance" value={base.annualInsurance} onChange={setB("annualInsurance")} step={100} />
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Num label="Lender Flat Fees" value={base.lenderFlatFees} onChange={setB("lenderFlatFees")} step={50} />
            <Num label="Title Settlement" value={base.titleSettlement} onChange={setB("titleSettlement")} step={50} />
            <Num label="Title Insurance" value={base.titleInsurance} onChange={setB("titleInsurance")} step={50} />
            <Num label="Appraisal" value={base.appraisal} onChange={setB("appraisal")} step={25} />
            <Num label={state === "GA" ? "GA Intangibles Tax" : "Gov/Stamp Taxes"} value={base.intangiblesTax} onChange={setB("intangiblesTax")} step={25} />
            {isPurchase ? (
              <Num label="Seller Credit" value={base.sellerCredit} onChange={setB("sellerCredit")} step={500} />
            ) : (
              <Num label="Recording" value={base.recording} onChange={setB("recording")} step={25} />
            )}
          </div>

          {isShortTerm && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {isFlip && <Num label="Rehab Budget" value={base.rehabBudget} onChange={setB("rehabBudget")} step={5000} />}
              {isFlip && <Num label="ARV (after repair)" value={base.arv} onChange={setB("arv")} step={5000} />}
              {isFlip && <Num label="% Rehab Financed" value={base.pctRehabFinanced} onChange={setB("pctRehabFinanced")} step={5} />}
              <Num label="Term (months)" value={base.termMonths} onChange={setB("termMonths")} step={1} />
              <Num label="Est. Hold (months)" value={base.holdMonths} onChange={setB("holdMonths")} step={1} />
            </div>
          )}

          {/* LTV readout — computed, never typed */}
          {(() => {
            const basis = base.propertyValue || base.purchasePrice
            const ltvNow = basis > 0 && base.loanAmount > 0 ? (base.loanAmount / basis) * 100 : null
            if (ltvNow == null) return null
            const over = ltvNow > clientMaxLtv + 0.05
            return (
              <div className={`flex items-center justify-between rounded-md border px-3 py-2 ${over ? "border-red-500 bg-red-500/10" : "border-green-600/50 bg-green-500/5"}`}>
                <span className={`text-sm font-semibold ${over ? "text-red-500" : "text-green-500"}`}>
                  LTV {ltvNow.toFixed(1)}%{over ? " — ABOVE client's max" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  Client max {clientMaxLtv.toFixed(0)}%{lenderName ? ` (${lenderName})` : ""} · max loan {`$${Math.round((basis * clientMaxLtv) / 100).toLocaleString("en-US")}`}
                </span>
              </div>
            )
          })()}

          {/* Scenario columns */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {scenarios.map((s, idx) => (
              <div key={idx} className={`rounded-lg border p-3 ${idx === 1 ? "border-[#997100]" : "border-border"}`}>
                <p className="mb-2 text-center text-sm font-semibold text-foreground">{s.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Num label="Rate" suffix="%" step={0.125} value={levers[idx].ratePercent} onChange={setL(idx, "ratePercent")} />
                  <Num label="Preme Pts" step={0.25} value={levers[idx].brokerPoints} onChange={setL(idx, "brokerPoints")} />
                  <Num label="Lender Pts" step={0.25} value={levers[idx].lenderPoints} onChange={setL(idx, "lenderPoints")} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Monthly P&I</span><span className="text-foreground">{money(s.monthlyPI)}</span></div>
                  <div className="flex justify-between"><span>Total payment (PITIA)</span><span className="text-foreground">{money(s.monthlyPITIA)}</span></div>
                  {s.dscr != null && (
                    <div className="flex justify-between"><span>DSCR</span><span className={s.dscr >= 1 ? "text-green-500" : "text-red-500"}>{s.dscr.toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between"><span>Points + lender fees</span><span className="text-foreground">{money(s.brokerFee + s.lenderPointsCost + s.lenderFlatFees)}</span></div>
                  <div className="flex justify-between"><span>Title/3rd party + prepaids</span><span className="text-foreground">{money(s.thirdPartyFees + s.prepaids)}</span></div>
                  {(isPurchase || isShortTerm) && <div className="flex justify-between"><span>Down payment</span><span className="text-foreground">{money(s.downPayment)}</span></div>}
                  {!isPurchase && !isShortTerm && <div className="flex justify-between"><span>Payoff</span><span className="text-foreground">{money(s.payoff)}</span></div>}
                  {isFlip && s.rehabHoldback > 0 && <div className="flex justify-between"><span>Rehab via draws</span><span className="text-foreground">{money(s.rehabHoldback)}</span></div>}
                  {isFlip && <div className="flex justify-between"><span>Total loan {s.arvLtv != null ? `· ${s.arvLtv.toFixed(0)}% ARV` : ""}{s.ltc != null ? ` · ${s.ltc.toFixed(0)}% LTC` : ""}</span><span className="text-foreground">{money(s.totalLoan)}</span></div>}
                  {isShortTerm && s.holdingCost != null && <div className="flex justify-between"><span>Est. carry ({base.holdMonths} mo)</span><span className="text-foreground">{money(s.holdingCost)}</span></div>}
                </div>
                <div className="mt-3 rounded-md bg-[#997100] px-3 py-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-black/70">
                    {s.cashToClose >= 0 ? "Cash to close" : "Cash to borrower"}
                  </p>
                  <p className="text-lg font-bold text-black">{money(Math.abs(s.cashToClose))}</p>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                  + show ~{money(s.reservesSuggested)} reserves (not spent)
                </p>
              </div>
            ))}
          </div>

          <p className="text-[10px] leading-snug text-muted-foreground">{TERM_SHEET_DISCLAIMER}</p>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-[#997100]">
              {result?.msg}
              {result?.pdfUrl && (
                <a href={result.pdfUrl} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-1 text-blue-500 hover:underline">
                  <ExternalLink className="h-3 w-3" /> Open PDF
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!!sending} onClick={() => generate(false)} className="border-border">
                {sending === "pdf" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Preview PDF
              </Button>
              <Button disabled={!!sending} onClick={() => generate(true)} className="bg-[#997100] text-black hover:bg-[#b8850a]">
                {sending === "send" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Send to Borrower
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
