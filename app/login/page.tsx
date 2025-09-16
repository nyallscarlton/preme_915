"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser, setUser } = useAuth()

  const converted = searchParams.get("converted")

  useEffect(() => {
    if (converted) {
      // Show success message for account conversion
      setError("")
    }
  }, [converted])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[v0] Login form submitted", { email, password })

    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }

    setLoading(true)
    setError("")

    try {
      console.log("[v0] Calling signIn function")
      const { user, error: authError } = await signIn(email, password)
      console.log("[v0] signIn result", { user, authError })

      if (authError) {
        console.log("[v0] Auth error:", authError)
        setError(authError)
      } else if (user) {
        console.log("[v0] Login successful, updating user state")
        setUser(user)
        await refreshUser()
        if (user.role === "admin") {
          console.log("[v0] Redirecting to admin")
          router.push("/admin")
        } else {
          console.log("[v0] Redirecting to portal")
          router.push("/portal")
        }
      }
    } catch (err) {
      console.log("[v0] Unexpected error:", err)
      setError("An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="relative">
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
              <span className="text-3xl font-bold tracking-wide text-foreground">PREME</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-6">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        {converted && (
          <div className="bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200 p-3 rounded-lg mb-6 text-sm">
            Account created successfully! You can now sign in with your new credentials.
          </div>
        )}

        {error && <div className="bg-destructive text-destructive-foreground p-3 rounded-lg mb-6 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#997100] focus:border-transparent"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-input rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#997100] focus:border-transparent"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              loading ? "bg-muted cursor-not-allowed" : "bg-[#997100] hover:bg-[#b8850a]"
            }`}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 p-4 bg-muted rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground mb-3">Demo Accounts:</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div>
              <strong className="text-foreground">Admin:</strong> admin@preme.com / demo123
            </div>
            <div>
              <strong className="text-foreground">Applicant:</strong> demo@example.com / demo123
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-muted-foreground text-sm">
            Don't have an account?{" "}
            <Link href="/apply" className="text-[#997100] hover:text-[#b8850a] font-medium">
              Apply for a loan
            </Link>
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            <Link href="/" className="text-[#997100] hover:text-[#b8850a] font-medium">
              ← Back to Home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
