"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function AuthGuard({ children, requireAuth = false, redirectTo = "/auth" }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession()

        const isAuthenticated = session?.user?.email_confirmed_at

        if (requireAuth && !isAuthenticated) {
          // Check if this is guest mode
          const isGuestMode = searchParams.get("guest") === "1"

          if (!isGuestMode) {
            // Redirect to auth with next parameter
            const redirectUrl = new URL(redirectTo, window.location.origin)
            redirectUrl.searchParams.set("next", pathname)
            router.push(redirectUrl.toString())
            return
          }
        }

        setIsAuthorized(true)
      } catch (error) {
        console.error("Auth guard error:", error)
        setIsAuthorized(true) // Allow access on error
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [requireAuth, redirectTo, pathname, searchParams, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
            <span className="text-4xl font-bold tracking-wide text-gray-900">PREME</span>
          </div>
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
