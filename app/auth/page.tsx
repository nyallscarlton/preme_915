"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/apply"

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Always redirect to login page instead of showing environment setup
  useEffect(() => {
    router.push("/login")
  }, [router])

  // Return loading state while redirecting
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="relative mb-8">
          <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
          <span className="text-4xl font-bold tracking-wide text-gray-900">PREME</span>
        </div>
        <p className="text-lg text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  )
}
