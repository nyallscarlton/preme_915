import type { LoanData } from "./types"

/**
 * Produce a Fannie Mae 3.2 (.fnm) flat-file as a UTF-8 string.
 *
 * Format: fixed-width positional records, each record terminated by \r\n.
 * Record ID lives in columns 1–3. This implementation covers the records
 * DSCR wholesale lenders look at first:
 *   EH  — Envelope Header
 *   TH  — Transaction Header
 *   TPI — Version (3.20)
 *   000 — File ID (1003)
 *   01A — Mortgage type + terms
 *   02A — Property address
 *   02B — Purpose of loan + occupancy
 *   03A — Applicant basics
 *   03C — Applicant addresses
 *   05H — Housing expenses
 *   06C — Assets (summary)
 *   06E — Liabilities (summary)
 *   06G — REO schedule (one row per existing rental) — DSCR-critical
 *   ET  — Envelope Trailer
 *
 * Fields not sourced from our schema are left blank-padded, which is
 * accepted by FNM parsers. MISMO 3.4 XML remains the primary deliverable.
 */
export function renderFannie(data: LoanData): string {
  const { loan } = data
  const lines: string[] = []
  const today = toDate(data.generated_at)
  const caseNum = (loan.application_number ?? loan.id).slice(0, 20)

  // EH — Envelope Header
  lines.push(pad("EH", 3) + pad("FNMA", 5) + pad(origin(data), 8) + pad("1", 1) + pad(today, 8))

  // TH — Transaction Header
  lines.push(pad("TH", 3) + pad(caseNum, 20) + pad("1", 1) + pad(today, 8))

  // TPI — Version
  lines.push(pad("TPI", 3) + pad("3.20", 6))

  // 000 — File ID
  lines.push(pad("000", 3) + pad("1003", 4) + pad("3.20", 6))

  // 01A — Mortgage type + terms
  //   MortgageCode, NoteRate, Term, LienPriority, AmortType, NoteAmount, LoanPurpose
  lines.push(
    pad("01A", 3) +
      pad(fannieMortgageCode(loan.mortgage_type), 1) +
      pad(num(loan.note_rate_percent, 3, 9), 9) +
      pad(String(loan.loan_term_months ?? 360), 3) +
      pad(fannieLienCode(loan.lien_priority), 1) +
      pad(fannieAmortCode(loan.amortization_type), 1) +
      pad(num(loan.note_amount ?? loan.loan_amount, 2, 12), 12) +
      pad(fannieLoanPurpose(loan.loan_purpose), 1)
  )

  // 02A — Property address + units + year built + property type
  lines.push(
    pad("02A", 3) +
      pad(loan.property_address, 50) +
      pad(loan.property_city, 35) +
      pad(loan.property_state, 2) +
      pad(loan.property_zip, 9) +
      pad(String(loan.financed_unit_count ?? 1), 2) +
      pad(String(loan.year_built ?? ""), 4) +
      pad(fanniePropertyUsage(loan.property_usage_type), 1)
  )

  // 02B — Purpose-of-loan + occupancy
  lines.push(
    pad("02B", 3) +
      pad(fannieLoanPurpose(loan.loan_purpose), 1) +
      pad(fanniePropertyUsage(loan.property_usage_type), 1) +
      pad(num(loan.property_value, 2, 12), 12) +
      pad(num(loan.property_original_cost, 2, 12), 12) +
      pad(num(loan.property_existing_lien_amount, 2, 12), 12)
  )

  // 03A — Applicant basics
  lines.push(
    pad("03A", 3) +
      pad("1", 1) + // applicant index
      pad(loan.applicant_first_name, 35) +
      pad(loan.applicant_middle_name, 35) +
      pad(loan.applicant_last_name, 35) +
      pad(digits(loan.applicant_ssn), 9) +
      pad(toDate(loan.applicant_dob), 8) +
      pad(fannieMaritalCode(loan.applicant_marital_status), 1) +
      pad(digits(loan.applicant_phone), 15) +
      pad(loan.applicant_email, 80)
  )

  // 03C — Applicant current address
  lines.push(
    pad("03C", 3) +
      pad("1", 1) +
      pad("C", 1) + // C = Current
      pad(loan.contact_address, 50) +
      pad(loan.contact_city, 35) +
      pad(loan.contact_state, 2) +
      pad(loan.contact_zip, 9) +
      pad(fannieResidencyBasis(loan.applicant_current_residence_basis), 1) +
      pad(String(loan.applicant_current_residence_months ?? ""), 4)
  )

  // 05H — Housing expenses (proposed)
  const monthlyTax = loan.annual_property_tax ? Number(loan.annual_property_tax) / 12 : null
  lines.push(
    pad("05H", 3) +
      pad("P", 1) + // P = Proposed
      pad(num(loan.hazard_insurance_monthly, 2, 10), 10) +
      pad(num(monthlyTax, 2, 10), 10) +
      pad(num(0, 2, 10), 10) + // mortgage insurance — 0 for DSCR
      pad(num(loan.hoa_monthly, 2, 10), 10) +
      pad(num(loan.flood_insurance_monthly, 2, 10), 10) +
      pad(num(loan.property_mgmt_fee_monthly, 2, 10), 10)
  )

  // 06C — Assets (one summary line per asset)
  for (const a of data.assets) {
    lines.push(
      pad("06C", 3) +
        pad(fannieAssetCode(a.asset_type), 2) +
        pad(a.account_identifier, 25) +
        pad(a.holder_name, 40) +
        pad(num(a.cash_or_market_value_amount, 2, 12), 12)
    )
  }

  // 06E — Liabilities
  for (const l of data.liabilities) {
    lines.push(
      pad("06E", 3) +
        pad(fannieLiabilityCode(l.liability_type), 2) +
        pad(l.account_identifier, 25) +
        pad(l.holder_name, 40) +
        pad(num(l.unpaid_balance_amount, 2, 12), 12) +
        pad(num(l.monthly_payment_amount, 2, 10), 10) +
        pad(String(l.remaining_term_months ?? ""), 3) +
        pad(l.payoff_at_close ? "Y" : "N", 1) +
        pad(l.excluded_from_dti ? "Y" : "N", 1)
    )
  }

  // 06G — REO schedule (DSCR-critical)
  for (const reo of data.reo_properties.filter((r) => !r.is_subject)) {
    lines.push(
      pad("06G", 3) +
        pad(reo.address_line1, 50) +
        pad(reo.city, 35) +
        pad(reo.state, 2) +
        pad(reo.postal_code, 9) +
        pad(fannieDispositionCode(reo.disposition_status), 1) +
        pad(fanniePropertyUsage(reo.usage_type), 1) +
        pad(num(reo.present_market_value, 2, 12), 12) +
        pad(num(reo.lien_upb_amount, 2, 12), 12) +
        pad(num(reo.monthly_mortgage_payment, 2, 10), 10) +
        pad(num(reo.monthly_rental_income_gross, 2, 10), 10) +
        pad(num(reo.monthly_maintenance_expense, 2, 10), 10) +
        pad(String(reo.unit_count ?? 1), 2)
    )
  }

  // ET — Envelope Trailer
  lines.push(pad("ET", 3) + pad(String(lines.length + 1), 8))

  return lines.join("\r\n") + "\r\n"
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad(v: unknown, len: number): string {
  const s = v == null ? "" : String(v)
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length)
}

function num(v: number | string | null | undefined, dp: number, width: number): string {
  if (v == null || v === "") return ""
  const n = Number(v)
  if (!isFinite(n)) return ""
  // Fannie amount fields are right-aligned zero-padded typically, but we use
  // space-padded via pad() — parsers accept either. Keep decimal representation.
  const s = n.toFixed(dp)
  return s.length > width ? s.slice(-width) : s
}

function digits(v: string | null | undefined): string {
  return (v ?? "").toString().replace(/\D/g, "")
}

function toDate(v: string | null | undefined): string {
  if (!v) return ""
  const d = new Date(v)
  if (isNaN(d.getTime())) {
    // Treat as already-date string; produce YYYYMMDD
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
    return match ? `${match[1]}${match[2]}${match[3]}` : ""
  }
  return `${d.getUTCFullYear()}${(d.getUTCMonth() + 1).toString().padStart(2, "0")}${d
    .getUTCDate()
    .toString()
    .padStart(2, "0")}`
}

function origin(data: LoanData): string {
  return (data.origin_company.nmls || "PREME").slice(0, 8)
}

// ---------------------------------------------------------------------------
// Fannie 3.2 enum coders (single-char where possible)
// ---------------------------------------------------------------------------

function fannieMortgageCode(v: string | null): string {
  switch (v) {
    case "Conventional": return "1"
    case "FHA":          return "2"
    case "VA":           return "3"
    case "USDARuralDevelopment": return "4"
    default:             return "1"
  }
}

function fannieLienCode(v: string | null): string {
  return v === "SecondLien" ? "2" : "1"
}

function fannieAmortCode(v: string | null): string {
  switch (v) {
    case "Fixed":         return "1"
    case "AdjustableRate": return "2"
    case "GraduatedPayment": return "3"
    default: return "1"
  }
}

function fannieLoanPurpose(v: string | null): string {
  if (!v) return "1"
  const n = v.toLowerCase()
  if (n.includes("purchase")) return "1"
  if (n.includes("refi")) return "2"
  if (n.includes("construction")) return "3"
  return "1"
}

function fanniePropertyUsage(v: string | null): string {
  switch (v) {
    case "PrimaryResidence": return "P"
    case "SecondHome":       return "S"
    case "Investment":       return "I"
    default:                 return "I"
  }
}

function fannieMaritalCode(v: string | null): string {
  switch (v) {
    case "Married":   return "M"
    case "Unmarried": return "U"
    case "Separated": return "S"
    default:          return " "
  }
}

function fannieResidencyBasis(v: string | null): string {
  switch (v) {
    case "Own":             return "O"
    case "Rent":            return "R"
    case "LivingRentFree":  return "F"
    default:                return " "
  }
}

function fannieAssetCode(v: string): string {
  switch (v) {
    case "CheckingAccount":               return "CK"
    case "SavingsAccount":                return "SV"
    case "MoneyMarketFund":               return "MM"
    case "CertificateOfDepositTimeDeposit": return "CD"
    case "Stock":                         return "ST"
    case "Bond":                          return "BD"
    case "MutualFund":                    return "MF"
    case "RetirementFund":                return "RT"
    default:                              return "OT"
  }
}

function fannieLiabilityCode(v: string): string {
  switch (v) {
    case "MortgageLoan":              return "MO"
    case "FirstPositionMortgageLien": return "M1"
    case "SecondPositionMortgageLien": return "M2"
    case "HELOC":                     return "HE"
    case "Installment":               return "IN"
    case "Revolving":                 return "RV"
    case "LeasePayment":              return "LP"
    case "Open30DayChargeAccount":    return "CH"
    case "CollectionsJudgmentsAndLiens": return "CJ"
    default:                          return "OT"
  }
}

function fannieDispositionCode(v: string): string {
  switch (v) {
    case "Sold":              return "S"
    case "PendingSale":       return "P"
    case "Retain":            return "R"
    case "HeldForInvestment": return "H"
    default:                  return "H"
  }
}
