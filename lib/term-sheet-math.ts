/**
 * Term-sheet math — single source of truth for the admin calculator, the
 * borrower PDF, and the public cash-to-close estimator.
 *
 * Business-purpose (DSCR investment) lending: exempt from TRID, so this is a
 * TERM SHEET, never a "Loan Estimate" — keep the vocabulary that way.
 */

export type LoanProduct = "purchase" | "refinance" | "cash-out-refinance" | "bridge" | "fix-flip"

export interface TermSheetInputs {
  purpose: LoanProduct
  state: string // 2-letter; drives title/government defaults
  purchasePrice: number // purchases; ignored on refis
  propertyValue: number // est. value (refi LTV basis)
  loanAmount: number
  currentBalance: number // refis — payoff
  monthlyRent: number
  annualTaxes: number
  annualInsurance: number
  monthlyHoa: number
  termMonths: number // 360 default; 12–18 for bridge / fix & flip
  interestOnly: boolean
  // Short-term products (bridge / fix & flip)
  rehabBudget: number // fix & flip: renovation budget (funded via draws)
  arv: number // fix & flip: after-repair value
  pctRehabFinanced: number // 0–100, default 100
  holdMonths: number // projected hold for holding-cost estimate (default 6)
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
  // Short-term products
  totalLoan: number // initial advance + financed rehab (fix & flip)
  rehabHoldback: number // rehab dollars funded via draws
  ltc: number | null // loan-to-cost (price + rehab)
  arvLtv: number | null // total loan vs ARV
  holdingCost: number | null // est. interest carry over holdMonths
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
  const isShortTerm = i.purpose === "bridge" || i.purpose === "fix-flip"
  const isFlip = i.purpose === "fix-flip"
  // Bridge behaves as an acquisition unless a payoff is entered; flips are acquisitions
  const isPurchase = i.purpose === "purchase" || isFlip || (i.purpose === "bridge" && !(i.currentBalance > 0))
  const io = isShortTerm ? true : i.interestOnly

  // Fix & flip: loanAmount = initial advance against the purchase; rehab is
  // financed on top via draws (points charged on the TOTAL loan, industry norm)
  const rehabHoldback = isFlip ? ((i.pctRehabFinanced ?? 100) / 100) * (i.rehabBudget || 0) : 0
  const totalLoan = i.loanAmount + rehabHoldback

  // LTV keys off appraised/est. VALUE, not purchase price — on under-market
  // buys the loan sizes from value, which is what shrinks the down payment
  const valueBasis = i.propertyValue || i.purchasePrice
  const ltv = valueBasis > 0 ? (i.loanAmount / valueBasis) * 100 : 0
  const projectCost = (i.purchasePrice || i.propertyValue || 0) + (isFlip ? i.rehabBudget || 0 : 0)
  const ltc = isShortTerm && projectCost > 0 ? (totalLoan / projectCost) * 100 : null
  const arvLtv = isFlip && i.arv > 0 ? (totalLoan / i.arv) * 100 : null

  // Short-term payments are interest-only on the full committed loan (conservative)
  const pi = monthlyPI(isShortTerm ? totalLoan : i.loanAmount, i.ratePercent, i.termMonths, io)
  const monthlyTI = (i.annualTaxes + i.annualInsurance) / 12 + (i.monthlyHoa || 0)
  const pitia = pi + monthlyTI
  const dscr = !isShortTerm && pitia > 0 && i.monthlyRent > 0 ? i.monthlyRent / pitia : null
  const holdingCost = isShortTerm ? pitia * Math.max(1, i.holdMonths || 6) : null

  const downPayment = isPurchase ? Math.max(0, (i.purchasePrice || 0) - i.loanAmount) : 0
  // Points on total committed loan (incl. rehab holdback) — hard-money norm
  const pointsBasis = isShortTerm ? totalLoan : i.loanAmount
  const brokerFee = (i.brokerPoints / 100) * pointsBasis
  const lenderPointsCost = (i.lenderPoints / 100) * pointsBasis
  const thirdPartyFees = i.appraisal + i.credit + i.titleSettlement + i.titleInsurance + i.recording + i.intangiblesTax

  const prepaidInterest = ((i.ratePercent / 100) * (isShortTerm ? totalLoan : i.loanAmount) * (i.prepaidInterestDays || 15)) / 365
  // Short-term loans typically don't escrow — insurance still due up front
  const escrows = isShortTerm ? 0 : (i.annualTaxes / 12) * (i.escrowMonthsTaxes || 3) + (i.annualInsurance / 12) * (i.escrowMonthsInsurance || 2)
  const firstYearInsurance = isPurchase ? i.annualInsurance : 0
  const prepaids = prepaidInterest + escrows + firstYearInsurance

  const totalCosts = brokerFee + lenderPointsCost + i.lenderFlatFees + thirdPartyFees + prepaids
  const payoff = isPurchase ? 0 : i.currentBalance || 0

  // Purchases (incl. flips/bridge acquisitions): down payment + costs − seller credit.
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
    totalLoan,
    rehabHoldback,
    ltc,
    arvLtv,
    holdingCost,
  }
}

/** Suggested fix & flip structure: 85% of purchase + 100% of rehab, capped at 70% ARV. */
export function suggestFixFlipAdvance(purchasePrice: number, rehabBudget: number, arv: number) {
  const advance = purchasePrice * 0.85
  const total = advance + rehabBudget
  const arvCap = arv * 0.7
  if (arv > 0 && total > arvCap) {
    return { initialAdvance: Math.max(0, arvCap - rehabBudget), capped: true }
  }
  return { initialAdvance: advance, capped: false }
}

export const TERM_SHEET_DISCLAIMER =
  "Preliminary term sheet for a business-purpose loan secured by non-owner-occupied investment property. " +
  "All figures are good-faith estimates only — this is not a Loan Estimate, a loan approval, a rate lock, or a " +
  "commitment to lend. Third-party charges (title, government, insurance, appraisal) are estimated averages and " +
  "will vary. Final terms are subject to full underwriting, appraisal, and lender approval, and may change. " +
  "Reserve requirements are funds you must document, not funds collected at closing."
