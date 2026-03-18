export const GA_CONVERSION_ID = "AW-17997920712"
export const LEAD_FORM_LABEL = "DbVFCPGs_aMcEM3jslYD"

// Fire the Lead Form Submission conversion ($350 value)
export function gtagLeadConversion() {
  gtagEvent("conversion", {
    send_to: `${GA_CONVERSION_ID}/${LEAD_FORM_LABEL}`,
    value: 350,
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
