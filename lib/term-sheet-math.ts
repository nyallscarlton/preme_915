/**
 * Term-sheet math — single source of truth for the admin calculator, the
 * borrower PDF, and the public cash-to-close estimator.
 *
 * Business-purpose (DSCR investment) lending: exempt from TRID, so this is a
 * TERM SHEET, never a "Loan Estimate" — keep the vocabulary that way.
 */

export interface TermSheetInputs {
  purpose: "purchase" | "refinance" | "cash-out-refinance"
  state: string // 2-letter; drives title/government defaults
  purchasePrice: number // purchases; ignored on refis
  propertyValue: number // est. value (refi LTV basis)
  loanAmount: number
  currentBalance: number // refis — payoff
  monthlyRent: number
  annualTaxes: number
  annualInsurance: number
  monthlyHoa: number
  termMonths: number // 360 default
  interestOnly: boolean
  sellerCredit: number // purchases
  // Per-scenario levers
  ratePercent: number
  brokerPoints: number // Preme origination — Nyalls's lever (2–2.5 typical)
  lenderPoints: number
  lenderFlatFees: number // underwriting/processing/doc from dscr_lenders.total_lender_fees
  // Editable one-off fees (defaults from state table)
  appraisal: number
  credit: number
  titleSettlement: number
  titleInsurance: number // lender's policy
  recording: number
  intangiblesTax: number // GA: $3/$1,000 of loan; 0 elsewhere
  escrowMonthsTaxes: number
  escrowMonthsInsurance: number
  prepaidInterestDays: number
}

export interface ScenarioResult {
  label: string
  ratePercent: number
  brokerPoints: number
  lenderPoints: number
  monthlyPI: number
  monthlyPITIA: number // PI + taxes + insurance + HOA
  dscr: number | null
  downPayment: number
  brokerFee: number
  lenderPointsCost: number
  lenderFlatFees: number
  thirdPartyFees: number // appraisal + credit + title + recording + intangibles
  prepaids: number // escrows + prepaid interest + first-year insurance
  totalCosts: number // everything except down payment
  sellerCredit: number
  payoff: number // refis
  cashToClose: number // negative = cash back (cash-out refis)
  ltv: number
  reservesSuggested: number // 6 months PITIA — shown as "must have", not spent
}

/** Modest state defaults for title + government charges (all editable). */
export function stateFeeDefaults(state: string, loanAmount: number) {
  const s = (state || "").toUpperCase()
  const base = {
    appraisal: 600,
    credit: 75,
    titleSettlement: 750,
    // Lender's title policy — modest average ≈ 0.30% of loan, floor $500
    titleInsurance: Math.max(500, Math.round(loanAmount * 0.003)),
    recording: 150,
    intangiblesTax: 0,
  }
  if (s === "GA") {
    // Georgia intangibles tax: $1.50 per $500 of note ($3 / $1,000)
    base.intangiblesTax = Math.round((loanAmount / 500) * 1.5)
  }
  if (s === "IL") {
    base.titleSettlement = 950 // IL settlement/closing fees run higher
    base.recording = 120
  }
  if (s === "FL") {
    // FL doc stamps on note: $0.35 per $100 + intangible 0.2% (rolled together here)
    base.intangiblesTax = Math.round(loanAmount * 0.0035 + loanAmount * 0.002)
  }
  return base
}

export function monthlyPI(loanAmount: number, ratePercent: number, termMonths: number, interestOnly: boolean): number {
  const r = ratePercent / 100 / 12
  if (loanAmount <= 0 || ratePercent <= 0) return 0
  if (interestOnly) return loanAmount * r
  const n = termMonths || 360
  return (loanAmount * r) / (1 - Math.pow(1 + r, -n))
}

export function computeScenario(i: TermSheetInputs, label: string): ScenarioResult {
  const isPurchase = i.purpose === "purchase"
  const priceBasis = isPurchase ? i.purchasePrice || i.propertyValue : i.propertyValue
  const ltv = priceBasis > 0 ? (i.loanAmount / priceBasis) * 100 : 0

  const pi = monthlyPI(i.loanAmount, i.ratePercent, i.termMonths, i.interestOnly)
  const monthlyTI = (i.annualTaxes + i.annualInsurance) / 12 + (i.monthlyHoa || 0)
  const pitia = pi + monthlyTI
  const dscr = pitia > 0 && i.monthlyRent > 0 ? i.monthlyRent / pitia : null

  const downPayment = isPurchase ? Math.max(0, (i.purchasePrice || 0) - i.loanAmount) : 0
  const brokerFee = (i.brokerPoints / 100) * i.loanAmount
  const lenderPointsCost = (i.lenderPoints / 100) * i.loanAmount
  const thirdPartyFees = i.appraisal + i.credit + i.titleSettlement + i.titleInsurance + i.recording + i.intangiblesTax

  const prepaidInterest = ((i.ratePercent / 100) * i.loanAmount * (i.prepaidInterestDays || 15)) / 365
  const escrows = (i.annualTaxes / 12) * (i.escrowMonthsTaxes || 3) + (i.annualInsurance / 12) * (i.escrowMonthsInsurance || 2)
  const firstYearInsurance = isPurchase ? i.annualInsurance : 0
  const prepaids = prepaidInterest + escrows + firstYearInsurance

  const totalCosts = brokerFee + lenderPointsCost + i.lenderFlatFees + thirdPartyFees + prepaids
  const payoff = isPurchase ? 0 : i.currentBalance || 0

  // Purchases: down payment + costs − seller credit.
  // Refis: payoff + costs − loan proceeds (negative = cash TO borrower).
  const cashToClose = isPurchase
    ? downPayment + totalCosts - (i.sellerCredit || 0)
    : payoff + totalCosts - i.loanAmount

  return {
    label,
    ratePercent: i.ratePercent,
    brokerPoints: i.brokerPoints,
    lenderPoints: i.lenderPoints,
    monthlyPI: pi,
    monthlyPITIA: pitia,
    dscr,
    downPayment,
    brokerFee,
    lenderPointsCost,
    lenderFlatFees: i.lenderFlatFees,
    thirdPartyFees,
    prepaids,
    totalCosts,
    sellerCredit: i.sellerCredit || 0,
    payoff,
    cashToClose,
    ltv,
    reservesSuggested: pitia * 6,
  }
}

export const TERM_SHEET_DISCLAIMER =
  "Preliminary term sheet for a business-purpose loan secured by non-owner-occupied investment property. " +
  "All figures are good-faith estimates only — this is not a Loan Estimate, a loan approval, a rate lock, or a " +
  "commitment to lend. Third-party charges (title, government, insurance, appraisal) are estimated averages and " +
  "will vary. Final terms are subject to full underwriting, appraisal, and lender approval, and may change. " +
  "Reserve requirements are funds you must document, not funds collected at closing."
