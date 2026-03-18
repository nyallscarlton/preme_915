"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function AuthGuard({
  children,
  requireAuth = false,
  redirectTo = "/auth",
}: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (requireAuth && !user) {
          const isGuestMode = searchParams.get("guest") === "1"

          if (!isGuestMode) {
            const redirectUrl = new URL(redirectTo, window.location.origin)
            redirectUrl.searchParams.set("next", pathname)
            router.push(redirectUrl.toString())
            return
          }
        }

        setIsAuthorized(true)
      } catch {
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
            <span className="text-4xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
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
