"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminDashboard } from "@/components/admin-dashboard"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean>(false)
  const [checking, setChecking] = useState<boolean>(true)

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession()
        const user = session?.user
        if (!user) {
          router.replace("/admin/login")
          return
        }
        const { data: profile } = await supabaseBrowser
          .from("profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .maybeSingle()
        if (!profile || !(profile as any).is_admin) {
          router.replace("/")
          return
        }
        setAuthorized(true)
      } finally {
        setChecking(false)
      }
    }
    check()
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#997100] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!authorized) return null

  return <AdminDashboard />
}
