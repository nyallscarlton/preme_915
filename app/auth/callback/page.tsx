"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react"

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/apply"

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabaseBrowser.auth.getSession()

        if (error) {
          console.error("Auth callback error:", error)
          setError(error.message)
          setStatus("error")
          return
        }

        if (data.session?.user) {
          setStatus("success")

          setTimeout(() => {
            router.push(nextUrl)
          }, 2000)
        } else {
          setError("No session found. Please try signing in again.")
          setStatus("error")
        }
      } catch (error: any) {
        console.error("Callback processing error:", error)
        setError(error.message || "An unexpected error occurred")
        setStatus("error")
      }
    }

    handleAuthCallback()
  }, [router, nextUrl])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            {status === "loading" && (
              <>
                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <CardTitle className="text-2xl">Verifying Your Email</CardTitle>
                <CardDescription>Please wait while we confirm your email verification...</CardDescription>
              </>
            )}

            {status === "success" && (
              <>
                <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-green-700">Email Verified!</CardTitle>
                <CardDescription>
                  Your email has been successfully verified. Redirecting you to the application...
                </CardDescription>
              </>
            )}

            {status === "error" && (
              <>
                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
                <CardTitle className="text-2xl text-red-700">Verification Failed</CardTitle>
                <CardDescription>There was a problem verifying your email address.</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {status === "loading" && (
              <div className="text-center text-sm text-gray-600">
                <p>This should only take a moment...</p>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <div className="text-center text-sm text-gray-600">
                  <p>You'll be redirected automatically, or click below to continue.</p>
                </div>
                <Button onClick={() => router.push(nextUrl)} className="w-full">
                  Continue to Application
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
                <div className="text-center text-sm text-gray-600">
                  <p>Please try signing in again or contact support if the problem persists.</p>
                </div>
                <Button
                  onClick={() => router.push(`/auth?next=${encodeURIComponent(nextUrl)}`)}
                  className="w-full bg-transparent"
                  variant="outline"
                >
                  Return to Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
