"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const { data, error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message || "Failed to sign in")
        return
      }

      const sessionUser = data.session?.user
      if (!sessionUser) {
        setError("No session returned")
        return
      }

      const { data: profile } = await supabaseBrowser
        .from("profiles")
        .select("is_admin, role, id, user_id")
        .or(`id.eq.${sessionUser.id},user_id.eq.${sessionUser.id}`)
        .maybeSingle()

      if (!profile || !(profile as any).is_admin) {
        setError("You are not authorized to access admin.")
        return
      }

      router.push("/admin")
    } catch (_err) {
      setError("Unexpected error during sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="relative">
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
              <span className="text-3xl font-bold tracking-wide">PREME</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold mt-6">Admin Sign In</h1>
          <p className="text-gray-400 mt-2">Only authorized administrators can proceed</p>
        </div>

        {error && (
          <div className="bg-red-600/10 border border-red-600 text-red-200 p-3 rounded-lg mb-6 text-sm">{error}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#997100] focus:border-transparent"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#997100] focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-black transition-colors ${
              loading ? "bg-gray-700 cursor-not-allowed" : "bg-[#997100] hover:bg-[#b8850a]"
            }`}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}


