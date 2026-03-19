export const GA_CONVERSION_ID = "AW-17997920712"
export const LEAD_FORM_LABEL = "DbVFCPGs_aMcEM3jslYD"
export const CALL_CLICK_LABEL = "K43bCNLH-YscEMjziYZD"

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
