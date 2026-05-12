"use client"

import Link from "next/link"
import { Button, type ButtonProps } from "@/components/ui/button"

export function ApplyButton({
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
      <Link href="/contact">{children}</Link>
    </Button>
  )
}
