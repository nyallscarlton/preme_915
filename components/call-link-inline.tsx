"use client"

import { gtagCallConversion } from "@/lib/gtag"

export function CallLinkInline({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <a
      href="tel:+14709425787"
      onClick={gtagCallConversion}
      className={className}
    >
      {children}
    </a>
  )
}
