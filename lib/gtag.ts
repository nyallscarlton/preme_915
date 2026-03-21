export const GA_CONVERSION_ID = "AW-18002213129"
export const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_ID || ""
export const LEAD_FORM_LABEL = "sBpgCM6HlIscEInyj4hD"
export const CALL_CLICK_LABEL = "K43bCNLH-YscEMjziYZD"

// Application form step names (used for funnel tracking)
const STEP_NAMES: Record<number, string> = {
  1: "contact_info",
  2: "property_info",
  3: "loan_details",
  4: "financial_info",
  5: "liquidity",
  6: "documents",
  7: "review_submit",
}

// Fire the Lead Form Submission conversion ($350 value)
export function gtagLeadConversion() {
  gtagEvent("conversion", {
    send_to: `${GA_CONVERSION_ID}/${LEAD_FORM_LABEL}`,
    value: 210,
    currency: "USD",
  })
}

// Fire the Click-to-Call conversion (tracks phone number clicks from ad traffic)
export function gtagCallConversion() {
  gtagEvent("conversion", {
    send_to: `${GA_CONVERSION_ID}/${CALL_CLICK_LABEL}`,
    value: 1.0,
    currency: "USD",
  })
}

// Track application form step progression (GA4 funnel)
export function gtagFormStep(stepNumber: number, mode: "guest" | "account") {
  const stepName = STEP_NAMES[stepNumber] || `step_${stepNumber}`
  gtagEvent("form_step_view", {
    step_number: stepNumber,
    step_name: stepName,
    form_mode: mode,
  })
}

// Track application form step completion
export function gtagFormStepComplete(stepNumber: number, mode: "guest" | "account") {
  const stepName = STEP_NAMES[stepNumber] || `step_${stepNumber}`
  gtagEvent("form_step_complete", {
    step_number: stepNumber,
    step_name: stepName,
    form_mode: mode,
  })
}

// Track application start
export function gtagApplicationStart(mode: "guest" | "account") {
  gtagEvent("application_start", { form_mode: mode })
}

// Track form abandonment (fires on page unload if form is incomplete)
export function gtagFormAbandon(stepNumber: number, mode: "guest" | "account") {
  const stepName = STEP_NAMES[stepNumber] || `step_${stepNumber}`
  gtagEvent("form_abandon", {
    step_number: stepNumber,
    step_name: stepName,
    form_mode: mode,
  })
}

// Fire a custom gtag event (for analytics)
export function gtagEvent(action: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params)
  }
}

// Extend Window type for gtag
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}
