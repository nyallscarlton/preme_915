"use client"

import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { ArrowLeftRight, ClipboardList, Target, Landmark } from "lucide-react"
import Link from "next/link"

export function PortalToggle() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Only show toggle for lender/admin users who can access both portals
  if (!user || (user.role !== "lender" && user.role !== "admin")) {
    return null
  }

  const isOnLenderPortal = pathname.startsWith("/lender") || pathname.startsWith("/admin")
  const isOnConditions = pathname.startsWith("/conditions")
  const isOnDscrMatcher = pathname.startsWith("/admin/dscr-matcher")
  const isOnPortals = pathname.startsWith("/portals")
  const handleToggle = () => {
    if (isOnLenderPortal || isOnConditions || isOnDscrMatcher || isOnPortals) {
      router.push("/dashboard")
    } else {
      router.push("/lender")
    }
  }

  return (
    <div className="flex items-center gap-2">
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
      {!isOnConditions && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-border text-muted-foreground hover:bg-muted bg-transparent gap-2"
        >
          <Link href="/conditions">
            <ClipboardList className="h-3.5 w-3.5" />
            Conditions
          </Link>
        </Button>
      )}
      {!isOnDscrMatcher && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="border-border text-muted-foreground hover:bg-muted bg-transparent gap-2"
        >
          <Link href="/admin/dscr-matcher">
            <Target className="h-3.5 w-3.5" />
            DSCR Match
          </Link>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        className="border-[#997100] text-[#997100] hover:bg-[#997100] hover:text-white bg-transparent gap-2"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {isOnLenderPortal || isOnConditions || isOnDscrMatcher || isOnPortals ? "Borrower View" : "Lender Portal"}
      </Button>
    </div>
  )
}
