"use client"

import Link from "next/link"
import { gtagCallConversion } from "@/lib/gtag"
import { Button, type ButtonProps } from "@/components/ui/button"

export function CallLink({
  children,
  className,
  size,
  variant,
}: {
  children: React.ReactNode
  className?: string
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
}) {
  return (
    <Button size={size} variant={variant} className={className} asChild>
      <Link href="tel:+14709425787" onClick={gtagCallConversion}>
        {children}
      </Link>
    </Button>
  )
}
