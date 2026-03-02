"use client"

import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { ArrowLeftRight } from "lucide-react"

export function PortalToggle() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Only show toggle for lender/admin users who can access both portals
  if (!user || (user.role !== "lender" && user.role !== "admin")) {
    return null
  }

  const isOnLenderPortal = pathname.startsWith("/lender") || pathname.startsWith("/admin")

  const handleToggle = () => {
    if (isOnLenderPortal) {
      router.push("/dashboard")
    } else {
      router.push("/lender")
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white bg-transparent gap-2"
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      {isOnLenderPortal ? "Borrower View" : "Lender Portal"}
    </Button>
  )
}
