"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

export function AdminLink() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabaseBrowser.auth.getSession()
        const user = session?.user
        if (!user) return
        const { data: profile } = await supabaseBrowser
          .from("profiles")
          .select("is_admin, role")
          .eq("id", user.id)
          .maybeSingle()
        if ((profile as any)?.is_admin || (profile as any)?.role === "admin") {
          setIsAdmin(true)
        }
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  if (!isAdmin) return null

  return (
    <Link href="/admin" className="font-medium text-foreground hover:text-[#997100] transition-colors">
      Admin
    </Link>
  )
}


