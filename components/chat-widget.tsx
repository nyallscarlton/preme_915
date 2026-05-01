"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

// Pages with phone/SMS opt-in forms — widget excluded per A2P compliance.
const EXCLUDED_PATHS = ["/contact", "/apply", "/apply-full", "/prequalify"]

export function ChatWidget() {
  const pathname = usePathname()
  const excluded = EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))

  useEffect(() => {
    if (excluded) return
    if (document.querySelector('script[data-widget-id="69f41182dfa79f52caf7ca67"]')) return

    const script = document.createElement("script")
    script.src = "https://widgets.leadconnectorhq.com/loader.js"
    script.setAttribute("data-resources-url", "https://widgets.leadconnectorhq.com/chat-widget/loader.js")
    script.setAttribute("data-widget-id", "69f41182dfa79f52caf7ca67")
    script.setAttribute("data-source", "WEB_USER")
    script.async = true
    document.head.appendChild(script)
  }, [excluded])

  return null
}
