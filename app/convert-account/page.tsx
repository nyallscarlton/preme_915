"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, Lock, User, ArrowRight, AlertCircle } from "lucide-react"
import Link from "next/link"
import VerifyGuestTokenClient from "@/components/VerifyGuestTokenClient"

interface Application {
  id: string
  email: string
  firstName: string
  lastName: string
  status: string
  loanAmount: number
  propertyAddress: string
}

export default function ConvertAccountPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (!token) {
      setError("Invalid conversion link. Please contact support.")
      setLoading(false)
      return
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/guest/verify-token?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to verify conversion link")
        }

        // Check if application is approved
        if (data.application.status !== "approved") {
          setError("Only approved applications can be converted to full accounts.")
          setLoading(false)
          return
        }

        setApplication(data.application)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load application")
      } finally {
        setLoading(false)
      }
    }

    verifyToken()
  }, [token])

  const handleConversion = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.password || !formData.confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setConverting(true)
    setError("")

    try {
      const response = await fetch("/api/guest/convert-to-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account")
      }

      // Redirect to login or portal
      router.push("/login?converted=true")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setConverting(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying your application...</p>
        </div>
      </div>
    )
  }

  if (error && !application) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="container mx-auto px-6 py-6">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-primary"></div>
                <span className="text-3xl font-bold tracking-wide text-foreground">PREME</span>
              </div>
            </Link>
          </div>
        </header>

        <div className="container mx-auto px-6 py-24">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-4">Conversion Error</h1>
            <p className="text-muted-foreground mb-8">{error}</p>
            <div className="space-y-4">
              <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/guest-access">Access Guest Dashboard</Link>
              </Button>
              <Button variant="outline" asChild className="w-full bg-transparent">
                <Link href="/">Return Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!application) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <VerifyGuestTokenClient token={token ?? undefined} />
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <Link href="/" className="flex items-center">
            <div className="relative">
              <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-primary"></div>
              <span className="text-3xl font-bold tracking-wide text-foreground">PREME</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Congratulations Section */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-4">Congratulations!</h1>
            <p className="text-xl text-muted-foreground mb-2">Your loan application has been approved!</p>
            <p className="text-muted-foreground">
              Create your full account to access enhanced features and manage your loan.
            </p>
          </div>

          {/* Application Summary */}
          <Card className="bg-card border-border mb-8">
            <CardHeader>
              <CardTitle className="text-foreground">Approved Application Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Applicant</p>
                  <p className="font-semibold text-foreground">
                    {application.firstName} {application.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-semibold text-foreground">{application.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Amount</p>
                  <p className="font-semibold text-foreground">{formatCurrency(application.loanAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  <p className="font-semibold text-foreground">{application.propertyAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Creation Form */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center">
                <User className="h-5 w-5 mr-2" />
                Create Your Full Account
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Set up your password to access your personalized loan management portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200 p-3 rounded-lg mb-6 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleConversion} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">
                    Create Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      className="bg-input border-border text-foreground focus:border-primary pl-10"
                      placeholder="Minimum 6 characters"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      className="bg-input border-border text-foreground focus:border-primary pl-10"
                      placeholder="Confirm your password"
                      required
                    />
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <h4 className="font-medium text-foreground mb-3">Your Full Account Includes:</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-foreground">Real-time loan status updates</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-foreground">Direct messaging with loan officers</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-foreground">Secure document management</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-foreground">Payment scheduling and history</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-foreground">Future application management</span>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={converting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {converting ? "Creating Account..." : "Create My Account"}
                  {!converting && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:text-primary/80">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:text-primary/80">
                    Privacy Policy
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
