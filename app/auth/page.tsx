"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("signin")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/dashboard"

  // Sign In Form State
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  })

  // Create Account Form State
  const [createAccountData, setCreateAccountData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  })

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // If unverified → navigate to `/auth/check-email?email=${email}&next=/apply`
      // If verified → navigate to `searchParams.next || "/dashboard"`

      // For now, simulate going to check-email for all sign-ins
      router.push(`/auth/check-email?email=${encodeURIComponent(signInData.email)}&next=${encodeURIComponent(nextUrl)}`)
    } catch (err) {
      setError("An error occurred during sign in")
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
      router.push(
        `/auth/check-email?email=${encodeURIComponent(createAccountData.email)}&next=${encodeURIComponent(nextUrl)}`,
      )
    } catch (err) {
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
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
              <span className="text-3xl font-bold tracking-wide text-gray-900">PREME</span>
            </div>
          </Link>
        </div>

        <Card className="bg-white border-gray-200">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-gray-900">Welcome</CardTitle>
            <CardDescription className="text-gray-600">Sign in to your account or create a new one</CardDescription>
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
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
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
                        onChange={(e) => setSignInData((prev) => ({ ...prev, email: e.target.value }))}
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
                        onChange={(e) => setSignInData((prev) => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 focus:border-[#997100] focus:ring-[#997100]"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <Link href="/auth/update-password" className="text-sm text-[#997100] hover:text-[#b8850a]">
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#997100] hover:bg-[#b8850a] text-white"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="create" className="space-y-4 mt-6">
                <form onSubmit={handleCreateAccount} className="space-y-4">
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
                        onChange={(e) => setCreateAccountData((prev) => ({ ...prev, email: e.target.value }))}
                        className="pl-10 bg-white border-gray-300 text-gray-900 focus:border-[#997100] focus:ring-[#997100]"
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
                        onChange={(e) => setCreateAccountData((prev) => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 focus:border-[#997100] focus:ring-[#997100]"
                        placeholder="Minimum 6 characters"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                        onChange={(e) => setCreateAccountData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 focus:border-[#997100] focus:ring-[#997100]"
                        placeholder="Confirm your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    We'll send a verification link to your email address.
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
                ← Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
