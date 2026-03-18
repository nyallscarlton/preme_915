"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Lock, Eye, EyeOff, Building2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signUp, signInWithMagicLink } from "@/lib/auth"
import { useAuth } from "@/hooks/use-auth"

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("signin")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/dashboard"
  const { setUser } = useAuth()

  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  })

  const [createAccountData, setCreateAccountData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setStatus("Connecting...")

    try {
      // Direct fetch to Supabase auth — bypasses client lock mechanism entirely
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      setStatus("Authenticating...")

      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          email: signInData.email,
          password: signInData.password,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const data = await res.json()

      if (!res.ok) {
        setError(data.msg || data.error_description || "Invalid credentials")
        return
      }

      setStatus("Setting up session...")

      // Set session via server-side API route — bypasses client navigator.locks
      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }),
      })

      if (!sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setError(sessionData.error || "Failed to set up session")
        return
      }

      // Fetch the user's actual role from the profile table
      const profileRes = await fetch("/api/auth/me")
      const profileData = profileRes.ok ? await profileRes.json() : null
      const userRole = profileData?.user?.role || data.user.user_metadata?.role || "applicant"

      // Set user in context from the auth response
      setUser({
        id: data.user.id,
        email: data.user.email,
        role: userRole,
        firstName: profileData?.user?.firstName || data.user.user_metadata?.first_name,
        lastName: profileData?.user?.lastName || data.user.user_metadata?.last_name,
      })

      setStatus("Redirecting...")

      // Route lender/admin users to lender dashboard if no specific next URL was set
      const defaultNext = searchParams.get("next")
      let redirectUrl = nextUrl
      if (!defaultNext && (userRole === "lender" || userRole === "admin")) {
        redirectUrl = "/lender"
      }

      // Hard navigation — guarantees middleware sees fresh auth cookies
      window.location.href = redirectUrl
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Sign in timed out. Please try again.")
      } else {
        setError(err instanceof Error ? err.message : "An error occurred during sign in")
      }
    } finally {
      setLoading(false)
      setStatus("")
    }
  }

  const handleMagicLink = async () => {
    if (!signInData.email) {
      setError("Please enter your email address")
      return
    }
    setLoading(true)
    setError("")

    try {
      const { error: magicError } = await signInWithMagicLink(signInData.email)
      if (magicError) {
        setError(magicError)
      } else {
        setSuccess("Check your email for a sign-in link.")
      }
    } catch {
      setError("Failed to send magic link")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (createAccountData.password !== createAccountData.confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    if (createAccountData.password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    try {
      const { user, error: authError, needsVerification } = await signUp(
        createAccountData.email,
        createAccountData.password,
        createAccountData.firstName,
        createAccountData.lastName
      )

      if (authError) {
        setError(authError)
      } else if (needsVerification) {
        router.push("/auth/check-email")
      } else if (user) {
        setUser(user)
        window.location.href = nextUrl
      }
    } catch {
      setError("An error occurred during account creation")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="relative">
              <span className="text-3xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
            </div>
          </Link>
        </div>

        <Card className="bg-white border-gray-200">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-gray-900">Welcome</CardTitle>
            <CardDescription className="text-gray-600">
              {nextUrl.includes("/lender") || nextUrl.includes("/portals")
                ? "Sign in with your lender credentials"
                : "Sign in to your account or create a new one"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100">
                <TabsTrigger
                  value="signin"
                  className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="create"
                  className="text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
                >
                  Create Account
                </TabsTrigger>
              </TabsList>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <TabsContent value="signin" className="space-y-4 mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-gray-700">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signin-email"
                        type="email"
                        value={signInData.email}
                        onChange={(e) =>
                          setSignInData((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="pl-10 bg-white border-gray-300 text-gray-900 focus:border-[#997100] focus:ring-[#997100]"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        value={signInData.password}
                        onChange={(e) =>
                          setSignInData((prev) => ({ ...prev, password: e.target.value }))
                        }
                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 focus:border-[#997100] focus:ring-[#997100]"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#997100] hover:bg-[#b8850a] text-white"
                  >
                    {loading ? (status || "Signing In...") : "Sign In"}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMagicLink}
                  disabled={loading}
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Sign in with Magic Link
                </Button>
              </TabsContent>

              <TabsContent value="create" className="space-y-4 mt-6">
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-first" className="text-gray-700">
                        First Name
                      </Label>
                      <Input
                        id="create-first"
                        type="text"
                        value={createAccountData.firstName}
                        onChange={(e) =>
                          setCreateAccountData((prev) => ({
                            ...prev,
                            firstName: e.target.value,
                          }))
                        }
                        className="bg-white border-gray-300 text-gray-900"
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-last" className="text-gray-700">
                        Last Name
                      </Label>
                      <Input
                        id="create-last"
                        type="text"
                        value={createAccountData.lastName}
                        onChange={(e) =>
                          setCreateAccountData((prev) => ({
                            ...prev,
                            lastName: e.target.value,
                          }))
                        }
                        className="bg-white border-gray-300 text-gray-900"
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-email" className="text-gray-700">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="create-email"
                        type="email"
                        value={createAccountData.email}
                        onChange={(e) =>
                          setCreateAccountData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        className="pl-10 bg-white border-gray-300 text-gray-900"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-password" className="text-gray-700">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="create-password"
                        type={showPassword ? "text" : "password"}
                        value={createAccountData.password}
                        onChange={(e) =>
                          setCreateAccountData((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900"
                        placeholder="Minimum 6 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-gray-700">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={createAccountData.confirmPassword}
                        onChange={(e) =>
                          setCreateAccountData((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900"
                        placeholder="Confirm your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#997100] hover:bg-[#b8850a] text-white"
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="text-center mt-6">
              <Link href="/" className="text-sm text-gray-600 hover:text-[#997100]">
                Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Lender Access Section */}
        <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#997100]/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-[#997100]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Lender or Loan Officer?</p>
              <p className="text-xs text-gray-500">
                Sign in above with your lender credentials to access the Lender Portal, pipeline, and conditions tracker.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
