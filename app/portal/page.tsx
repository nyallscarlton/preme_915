"use client"

import { useEffect, useState } from "react"
import { CustomerDashboard } from "@/components/customer-dashboard"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

export default function PortalPage() {
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const { data, error } = await supabaseBrowser.auth.getSession()
        if (error) throw error
        if (!mounted) return
        setHasSession(Boolean(data.session?.user))
      } catch {
        setHasSession(false)
      } finally {
        setChecking(false)
      }
    }
    check()
    return () => {
      mounted = false
    }
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">You are not signed in.</p>
          <a className="text-[#997100] underline" href="/auth?next=/portal">Sign in to continue</a>
        </div>
      </div>
    )
  }

  return <CustomerDashboard />
}
