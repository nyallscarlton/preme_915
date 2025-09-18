"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"

export default function CheckEmailPage() {
  const [isResending, setIsResending] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const nextUrl = searchParams.get("next") || "/apply"

  useEffect(() => {
    if (!email) {
      router.push("/auth")
    }
  }, [email, router])

  const handleResendVerification = async () => {
    if (!email) return

    setIsResending(true)
    setError("")
    setResendSuccess(false)

    try {
      const { error } = await supabaseBrowser.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        },
      })

      if (error) throw error

      setResendSuccess(true)
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsResending(false)
    }
  }

  const handleCheckVerification = async () => {
    setIsChecking(true)
    setError("")

    try {
      // Force a refresh from the server: getUser hits the auth endpoint
      const { data, error } = await supabaseBrowser.auth.getUser()
      if (error) throw error

      const user = data.user
      if (user?.email_confirmed_at) {
        router.push(nextUrl)
        return
      }

      // As a fallback, refresh the session (especially after clicking the email link)
      await supabaseBrowser.auth.refreshSession()
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession()

      if (session?.user?.email_confirmed_at) {
        router.push(nextUrl)
      } else {
        setError("Email not yet verified. Please check your email and click the verification link.")
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsChecking(false)
    }
  }

  const handleUseDifferentEmail = () => {
    router.push(`/auth?next=${encodeURIComponent(nextUrl)}`)
  }

  const handleRetrySignIn = () => {
    const target = new URL(`/auth`, window.location.origin)
    target.searchParams.set("next", nextUrl)
    if (email) target.searchParams.set("email", email)
    router.push(target.toString())
  }

  if (!email) {
    return null
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription className="text-base">
              We've sent a verification link to your email address
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email Display */}
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-1">Verification email sent to:</p>
              <p className="font-medium text-gray-900 break-all">{email}</p>
            </div>

            {/* Instructions */}
            <div className="text-sm text-gray-600 space-y-2">
              <p>1. Check your email inbox (and spam folder)</p>
              <p>2. Click the verification link in the email</p>
              <p>3. Return here and click "Already verified? Continue"</p>
            </div>

            {/* Success Message */}
            {resendSuccess && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md">
                <CheckCircle className="w-4 h-4" />
                <span>Verification email resent successfully!</span>
              </div>
            )}

            {/* Error Message */}
            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button onClick={handleCheckVerification} className="w-full" disabled={isChecking}>
                {isChecking ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Already verified? Continue
                  </>
                )}
              </Button>

              <Button
                onClick={handleResendVerification}
                variant="outline"
                className="w-full bg-transparent"
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Resend verification email
                  </>
                )}
              </Button>

              <Button onClick={handleUseDifferentEmail} variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Use a different email
              </Button>

              <Button onClick={handleRetrySignIn} variant="outline" className="w-full">
                Re-try sign in
              </Button>
            </div>

            {/* Footer Note */}
            <div className="text-xs text-gray-500 text-center pt-4 border-t">
              <p>Didn't receive the email? Check your spam folder or try resending.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
