"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, type ButtonProps } from "@/components/ui/button"
import { StartChoice } from "@/components/StartChoice"
import { useAuth } from "@/hooks/use-auth"

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
  const { user } = useAuth()
  const router = useRouter()
  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={className}
        // Logged-in users skip the guest/signup chooser — straight to the
        // application, which auto-continues as an account with prefill
        onClick={() => (user ? router.push("/apply") : setOpen(true))}
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
