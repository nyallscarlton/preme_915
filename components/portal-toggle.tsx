"use client"

import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { ArrowLeftRight, Landmark, Shield } from "lucide-react"
import Link from "next/link"

export function PortalToggle() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  if (!user || (user.role !== "lender" && user.role !== "admin")) {
    return null
  }

  const isOnBorrowerView = pathname.startsWith("/dashboard") || pathname.startsWith("/portal")
  const isOnAdminPortal = pathname.startsWith("/admin")
  const isOnLenderPortal = pathname.startsWith("/lender")
  const isOnPortals = pathname.startsWith("/portals")

  // Where the "home" portal is for this user
  const homePortal = user.role === "admin" ? "/admin" : "/lender"

  return (
    <div className="flex items-center gap-2">
      {/* Admin-only: link to admin portal when not already there */}
      {user.role === "admin" && !isOnAdminPortal && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white bg-transparent gap-2"
        >
          <Link href="/admin">
            <Shield className="h-3.5 w-3.5" />
            Admin Portal
          </Link>
        </Button>
      )}
      {/* Lender portals link */}
      {!isOnPortals && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-border text-muted-foreground hover:bg-muted bg-transparent gap-2"
        >
          <Link href="/portals">
            <Landmark className="h-3.5 w-3.5" />
            Lender Portals
          </Link>
        </Button>
      )}
      {/* Toggle between borrower view and lender/admin portal */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(isOnBorrowerView ? homePortal : "/dashboard")}
        className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white bg-transparent gap-2"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {isOnBorrowerView ? "Back to Portal" : "Borrower View"}
      </Button>
    </div>
  )
}
