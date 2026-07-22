"use client"

import { useState } from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { StartChoice } from "@/components/StartChoice"

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
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      {open && (
        <StartChoice
          isOpen={open}
          onClose={() => setOpen(false)}
          nextUrl="/apply"
        />
      )}
    </>
  )
}
