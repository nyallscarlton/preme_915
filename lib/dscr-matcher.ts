/**
 * DSCR Lender Matching Engine v2.0
 * Preme Home Loans — Marathon Empire Holdings
 *
 * Server-side matching logic. NEVER expose to borrowers.
 * Broker-side only — lender criteria and match results are internal.
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface DscrLender {
  id: string
  name: string
  short_name: string | null
  contact_email: string | null
  min_fico: number | null
  min_loan: number | null
  max_loan: number | null
  min_dscr: number | null
  max_units: number | null
  min_purchase_price: number | null
  min_sq_ft: number | null
  max_acreage: number | null
  llc_layering: string | null
  section8: string | null
  subordinate: string | null
  first_time_buyer: string | null
  report_credit: boolean | null
  state_req: boolean | null
  blanket_loans: boolean | null
  follows_trid: boolean | null
  recourse: string | null
  max_seller_concessions: number | null
  total_lender_fees: number | null
  max_term: string | null
  ppp: string | null
  if_unrented: string | null
  ltv: Record<string, number>
  states: string[]
}

export interface DscrApplication {
  state: string
  propertyType: string
  loanPurpose: string
  fico: number
  loanAmount: number
  purchasePrice: number
  ltv: number
  dscr: number
  foreignNational?: boolean
  section8?: boolean
  layeredLLC?: boolean
  firstTimeBuyer?: boolean
  subordinateFinancing?: boolean
  units?: number
  squareFeet?: number
  acreage?: number
  currentlyRented?: boolean
  sellerConcessions?: number
}

export interface MatchIssue {
  code: string
  message: string
}

export interface LenderMatchResult {
  lender: DscrLender
  qualified: boolean
  issues: MatchIssue[]
  warnings: MatchIssue[]
  maxLtv: number
  totalFees: number
}

export interface MatchResults {
  qualified: LenderMatchResult[]
  disqualified: LenderMatchResult[]
  totalLenders: number
  qualifiedCount: number
  disqualifiedCount: number
  timestamp: string
  applicationSnapshot: DscrApplication
}

// ═══════════════════════════════════════════════════════
// LTV KEY RESOLVER
// Maps (propertyType, loanPurpose) → the correct LTV field
// ═══════════════════════════════════════════════════════

const LTV_KEY_MAP: Record<string, Record<string, string>> = {
  singleFamily: { purchase: "purchaseSF", rt: "rtSF", cashout: "cashoutSF" },
  duplex: { purchase: "purchaseDuplex", rt: "rtDuplex", cashout: "cashoutDuplex" },
  "34unit": { purchase: "purchase34", rt: "rt34", cashout: "cashout34" },
  manufactured: { purchase: "mfgPurch", rt: "mfgRT", cashout: "mfgCO" },
  mixedUse: { purchase: "mixedPurch", rt: "mixedRT", cashout: "mixedCO" },
  nwCondo: { purchase: "nwCondoPurch", rt: "nwCondoRT", cashout: "nwCondoCO" },
  condotel: { purchase: "condotelPurch", rt: "condotelRT", cashout: "condotelCO" },
  str: { purchase: "strPurch", rt: "strRT", cashout: "strCO" },
}

function getLtvKey(propertyType: string, loanPurpose: string): string | null {
  return LTV_KEY_MAP[propertyType]?.[loanPurpose] || null
}

function getForeignNatLtvKey(loanPurpose: string): string {
  return loanPurpose === "purchase" ? "fnPurch" : loanPurpose === "rt" ? "fnRT" : "fnCO"
}

// ═══════════════════════════════════════════════════════
// SINGLE LENDER MATCH
// Returns { qualified, issues, warnings, maxLtv, totalFees }
// ═══════════════════════════════════════════════════════

export function matchLender(lender: DscrLender, app: DscrApplication): LenderMatchResult {
  const issues: MatchIssue[] = []
  const warnings: MatchIssue[] = []

  // 1. STATE AVAILABILITY
  if (lender.states.length > 0 && !lender.states.includes(app.state)) {
    issues.push({ code: "STATE", message: `Not available in ${app.state}` })
  }

  // 2. PROPERTY TYPE + LOAN PURPOSE → LTV
  const ltvKey = getLtvKey(app.propertyType, app.loanPurpose)
  const maxLtv = ltvKey ? (lender.ltv[ltvKey] ?? 0) : 0

  if (maxLtv === 0) {
    issues.push({ code: "PRODUCT", message: "Does not offer this property type / loan purpose combination" })
  } else if (app.ltv > maxLtv) {
    issues.push({ code: "LTV", message: `Max LTV ${(maxLtv * 100).toFixed(0)}% — yours is ${(app.ltv * 100).toFixed(1)}%` })
  }

  // 3. FICO SCORE
  if (lender.min_fico && app.fico < lender.min_fico) {
    issues.push({ code: "FICO", message: `Min FICO ${lender.min_fico} — yours is ${app.fico}` })
  }

  // 4. LOAN AMOUNT RANGE
  if (lender.min_loan && app.loanAmount < lender.min_loan) {
    issues.push({ code: "MIN_LOAN", message: `Min loan $${lender.min_loan.toLocaleString()} — yours is $${app.loanAmount.toLocaleString()}` })
  }
  if (lender.max_loan && app.loanAmount > lender.max_loan) {
    issues.push({ code: "MAX_LOAN", message: `Max loan $${lender.max_loan.toLocaleString()} — yours is $${app.loanAmount.toLocaleString()}` })
  }

  // 5. DSCR RATIO
  if (lender.min_dscr && lender.min_dscr > 0 && app.dscr < lender.min_dscr) {
    issues.push({ code: "DSCR", message: `Min DSCR ${lender.min_dscr} — yours is ${app.dscr.toFixed(2)}` })
  }

  // 6. FOREIGN NATIONAL
  if (app.foreignNational) {
    const fnKey = getForeignNatLtvKey(app.loanPurpose)
    const fnMaxLtv = lender.ltv[fnKey] ?? 0
    if (fnMaxLtv === 0) {
      issues.push({ code: "FOREIGN_NAT", message: "Does not accept foreign nationals" })
    } else if (app.ltv > fnMaxLtv) {
      issues.push({ code: "FOREIGN_NAT_LTV", message: `Foreign national max LTV ${(fnMaxLtv * 100).toFixed(0)}%` })
    }
  }

  // 7. SECTION 8 TENANTS
  if (app.section8) {
    if (lender.section8 === "false") {
      issues.push({ code: "SECTION8", message: "Does not allow Section 8 tenants" })
    } else if (lender.section8 === "higher_rate") {
      warnings.push({ code: "SECTION8_RATE", message: "Section 8 allowed but at a higher rate" })
    } else if (lender.section8 === "expanded") {
      warnings.push({ code: "SECTION8_EXPANDED", message: "Section 8 only on expanded guidelines" })
    }
  }

  // 8. LLC LAYERING
  if (app.layeredLLC && lender.llc_layering === "false") {
    issues.push({ code: "LLC_LAYER", message: "Does not allow layered LLCs" })
  }

  // 9. FIRST-TIME HOMEBUYER
  if (app.firstTimeBuyer && lender.first_time_buyer === "false") {
    issues.push({ code: "FIRST_TIME", message: "Does not allow first-time homebuyers" })
  }

  // 10. SUBORDINATE FINANCING
  if (app.subordinateFinancing && lender.subordinate === "false") {
    issues.push({ code: "SUBORDINATE", message: "Does not allow subordinate financing" })
  }

  // 11. NUMBER OF UNITS
  if (app.units && lender.max_units && app.units > lender.max_units) {
    issues.push({ code: "UNITS", message: `Max ${lender.max_units} units — yours has ${app.units}` })
  }

  // 12. PURCHASE PRICE MINIMUM
  if (lender.min_purchase_price && app.purchasePrice && app.purchasePrice < lender.min_purchase_price) {
    issues.push({ code: "MIN_PP", message: `Min purchase price $${lender.min_purchase_price.toLocaleString()}` })
  }

  // 13. SQUARE FOOTAGE
  if (lender.min_sq_ft && app.squareFeet && app.squareFeet < lender.min_sq_ft) {
    issues.push({ code: "SQ_FT", message: `Min ${lender.min_sq_ft} sq ft — yours is ${app.squareFeet}` })
  }

  // 14. ACREAGE
  if (lender.max_acreage && app.acreage && app.acreage > lender.max_acreage) {
    issues.push({ code: "ACREAGE", message: `Max ${lender.max_acreage} acres — yours is ${app.acreage}` })
  }

  // 15. CURRENTLY RENTED
  if (app.currentlyRented === false && lender.if_unrented) {
    if (lender.if_unrented === "NOT ALLOWED") {
      issues.push({ code: "UNRENTED", message: "Property must be currently rented" })
    } else if (lender.if_unrented !== "NO PROBLEM") {
      warnings.push({ code: "UNRENTED_NOTE", message: `If unrented: ${lender.if_unrented}` })
    }
  }

  // 16. SELLER CONCESSIONS
  if (app.sellerConcessions && lender.max_seller_concessions !== null && lender.max_seller_concessions !== undefined) {
    if (app.sellerConcessions > lender.max_seller_concessions) {
      issues.push({ code: "SELLER_CONC", message: `Max seller concessions ${(lender.max_seller_concessions * 100).toFixed(0)}%` })
    }
  }

  return {
    lender,
    qualified: issues.length === 0,
    issues,
    warnings,
    maxLtv,
    totalFees: lender.total_lender_fees || 0,
  }
}

// ═══════════════════════════════════════════════════════
// BATCH MATCHING — Run all lenders at once
// ═══════════════════════════════════════════════════════

export function matchAllLenders(app: DscrApplication, lenders: DscrLender[]): MatchResults {
  const allResults = lenders.map((l) => matchLender(l, app))

  const qualified = allResults
    .filter((r) => r.qualified)
    .sort((a, b) => (b.maxLtv || 0) - (a.maxLtv || 0))

  const disqualified = allResults
    .filter((r) => !r.qualified)
    .sort((a, b) => a.issues.length - b.issues.length)

  return {
    qualified,
    disqualified,
    totalLenders: allResults.length,
    qualifiedCount: qualified.length,
    disqualifiedCount: disqualified.length,
    timestamp: new Date().toISOString(),
    applicationSnapshot: { ...app },
  }
}

// ═══════════════════════════════════════════════════════
// DSCR CALCULATOR
// ═══════════════════════════════════════════════════════

export function calculateDSCR({
  loanAmount,
  interestRate,
  loanTermYears = 30,
  annualTaxes,
  annualInsurance,
  annualHOA = 0,
  otherAnnualExpenses = 0,
  monthlyRent,
  interestOnly = false,
}: {
  loanAmount: number
  interestRate: number
  loanTermYears?: number
  annualTaxes: number
  annualInsurance: number
  annualHOA?: number
  otherAnnualExpenses?: number
  monthlyRent: number
  interestOnly?: boolean
}) {
  let monthlyPI: number
  if (interestOnly) {
    monthlyPI = (loanAmount * interestRate) / 12
  } else {
    const monthlyRate = interestRate / 12
    const numPayments = loanTermYears * 12
    if (monthlyRate === 0) {
      monthlyPI = loanAmount / numPayments
    } else {
      monthlyPI =
        (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
    }
  }

  const monthlyTaxes = annualTaxes / 12
  const monthlyInsurance = annualInsurance / 12
  const monthlyHOA = annualHOA / 12
  const monthlyOther = otherAnnualExpenses / 12
  const totalPITI = monthlyPI + monthlyTaxes + monthlyInsurance + monthlyHOA + monthlyOther

  return {
    monthlyPI,
    monthlyTaxes,
    monthlyInsurance,
    totalPITI,
    monthlyRent,
    dscr: totalPITI > 0 ? monthlyRent / totalPITI : 0,
    monthlyCashflow: monthlyRent - totalPITI,
  }
}

// ═══════════════════════════════════════════════════════
// CLOSING COST ESTIMATOR
// ═══════════════════════════════════════════════════════

export function estimateClosingCosts({
  lender,
  loanAmount,
  brokerFee = 2000,
  creditMiscFees = 113,
  appraisalFee = 725,
  titleFees = 2000,
  prepaidMonths = 3,
  annualTaxes = 0,
  annualInsurance = 0,
  interestRate = 0,
  prepaidInterestDays = 15,
  includeFirstYearInsurance = true,
  pointsPercent = 0,
}: {
  lender: DscrLender
  loanAmount: number
  brokerFee?: number
  creditMiscFees?: number
  appraisalFee?: number
  titleFees?: number
  prepaidMonths?: number
  annualTaxes?: number
  annualInsurance?: number
  interestRate?: number
  prepaidInterestDays?: number
  includeFirstYearInsurance?: boolean
  pointsPercent?: number
}) {
  const points = loanAmount * (pointsPercent / 100)
  const prepaidInterest = (loanAmount * interestRate * prepaidInterestDays) / 365
  const prepaidTaxes = (annualTaxes / 12) * prepaidMonths
  const prepaidInsurance =
    (annualInsurance / 12) * prepaidMonths + (includeFirstYearInsurance ? annualInsurance : 0)
  const totalPrepaids = prepaidInterest + prepaidTaxes + prepaidInsurance
  const lenderFees = lender.total_lender_fees || 0
  const totalClosingCosts =
    brokerFee + creditMiscFees + points + lenderFees + appraisalFee + titleFees + totalPrepaids

  return {
    brokerFee,
    creditMiscFees,
    points,
    lenderFees,
    appraisalFee,
    titleFees,
    prepaids: {
      interest: prepaidInterest,
      taxes: prepaidTaxes,
      insurance: prepaidInsurance,
      total: totalPrepaids,
    },
    totalClosingCosts,
  }
}
