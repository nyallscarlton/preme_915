"use client"

import { useEffect } from "react"

export function ChatWidget() {
  useEffect(() => {
    if (document.querySelector('script[data-widget-id="69f41182dfa79f52caf7ca67"]')) return

    const script = document.createElement("script")
    script.src = "https://widgets.leadconnectorhq.com/loader.js"
    script.setAttribute("data-resources-url", "https://widgets.leadconnectorhq.com/chat-widget/loader.js")
    script.setAttribute("data-widget-id", "69f41182dfa79f52caf7ca67")
    script.setAttribute("data-source", "WEB_USER")
    script.async = true
    document.head.appendChild(script)
  }, [])

  return null
}
