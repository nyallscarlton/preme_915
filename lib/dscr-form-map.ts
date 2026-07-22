/**
 * Maps application-form field values to the DSCR matcher's expected inputs
 * (lib/dscr-matcher.ts). Single source of truth — used by the submit route
 * and the Slack notification follow-up so the two can't drift.
 *
 * Matcher contract: propertyType/loanPurpose are LTV_KEY_MAP enum keys,
 * ltv is a FRACTION (0.80 = 80%).
 */

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "single-family": "singleFamily",
  townhouse: "singleFamily",
  condo: "nwCondo",
  duplex: "duplex",
  "multi-family": "34unit",
}

const LOAN_PURPOSE_MAP: Record<string, string> = {
  purchase: "purchase",
  refinance: "rt",
  "cash-out-refinance": "cashout",
}

export type DscrFormInput = {
  property_state?: string | null
  property_type?: string | null
  loan_purpose?: string | null
  loan_amount?: number | null
  property_value?: number | null
  credit_score_range?: string | null
}

/**
 * Returns the matcher payload, or null when the scenario is outside standard
 * DSCR products (commercial, land, bridge, etc.) and needs manual review.
 */
export function toDscrApplication(app: DscrFormInput) {
  const propertyType = PROPERTY_TYPE_MAP[String(app.property_type ?? "").toLowerCase()]
  const loanPurpose = LOAN_PURPOSE_MAP[String(app.loan_purpose ?? "").toLowerCase()]
  if (!propertyType || !loanPurpose) return null

  const ficoMatch = /(\d+)/.exec(app.credit_score_range ?? "")
  const loanAmount = Number(app.loan_amount) || 0
  const propertyValue = Number(app.property_value) || 0

  return {
    state: app.property_state || "",
    propertyType,
    loanPurpose,
    loanAmount,
    fico: ficoMatch ? parseInt(ficoMatch[1], 10) : 0,
    // No property value on file → assume 75% LTV rather than skipping the match
    ltv: propertyValue > 0 ? Math.min(0.8, loanAmount / propertyValue) : 0.75,
  }
}
