"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { LeadDashboard } from "@/components/lead-portal/lead-dashboard"

export default function LeadsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!loading && isClient) {
      if (!user) {
        router.push("/login")
      } else if (user.role !== "admin" && user.role !== "lender") {
        router.push("/portal")
      }
    }
  }, [user, loading, router, isClient])

  if (loading || !isClient) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading lead portal...</p>
        </div>
      </div>
    )
  }

  if (!user || (user.role !== "admin" && user.role !== "lender")) {
    return null
  }

  return <LeadDashboard />
}
