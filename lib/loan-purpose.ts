/**
 * Preme Home Loans — Loan Purpose Mapping
 *
 * Shared utility for converting loan_purpose DB values into
 * human-readable display names and selling point copy.
 * Used across emails, SMS, calls, and notifications.
 */

const LOAN_DESCRIPTIONS: Record<string, string> = {
  purchase: "investment property purchase",
  refinance: "refinance",
  "cash-out-refinance": "cash-out refinance",
  construction: "construction financing",
  renovation: "renovation financing",
  investment: "investment property loan",
  "bridge-loan": "bridge loan",
  "debt-consolidation": "debt consolidation",
  "home-equity": "home equity loan",
  other: "loan",
}

const LOAN_SELLING_POINTS: Record<string, string> = {
  purchase:
    "We qualify your deal based on the property's rental income — no tax returns, no W-2s, no pay stubs.",
  refinance:
    "Refinance based on your property's cash flow — no income verification, no tax returns. Most refis close in 10–14 days.",
  "cash-out-refinance":
    "Pull equity from your investment property without the income documentation headache. Cash-out refis up to 80% LTV.",
  construction:
    "Flexible construction financing with draw schedules built around your project timeline.",
  renovation:
    "Finance your purchase and rehab in one loan. We work with fix-and-flip investors every day.",
  investment:
    "Scale your portfolio without limits — we qualify each property on its own cash flow, not your personal income.",
  "bridge-loan":
    "Short-term bridge capital so you can move fast. Close in as few as 7 days when the deal won't wait.",
  "debt-consolidation":
    "Simplify your payments and free up cash flow with one streamlined loan across your portfolio.",
  "home-equity": "Unlock the equity in your property — no income verification required.",
  other:
    "We'll match you with the right lending program for your deal. Our team specializes in investor financing.",
}

export function getLoanDescription(loanPurpose?: string | null): string {
  if (!loanPurpose) return "loan"
  return LOAN_DESCRIPTIONS[loanPurpose] || "loan"
}

export function getLoanSellingPoint(loanPurpose?: string | null): string {
  if (!loanPurpose) return LOAN_SELLING_POINTS["other"]
  return LOAN_SELLING_POINTS[loanPurpose] || LOAN_SELLING_POINTS["other"]
}
