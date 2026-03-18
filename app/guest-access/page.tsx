"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Search, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function GuestAccessPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [magicLink, setMagicLink] = useState("")

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      setMessage("Please enter your email address")
      return
    }

    setLoading(true)
    setMessage("")
    setMagicLink("")

    try {
      const response = await fetch("/api/guest/send-magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send magic link")
      }

      setMessage("Magic link sent! Check your email for a secure link to access your application.")
      // In production, don't show the actual link
      if (data.magicLink) {
        setMagicLink(data.magicLink)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send magic link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <span className="text-3xl font-bold tracking-wide text-foreground">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-primary"></span></span>ME</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Access Your Application</h1>
            <p className="text-muted-foreground">
              Enter your email to receive a secure link to check your guest application status
            </p>
          </div>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Guest Application Access</CardTitle>
              <CardDescription className="text-muted-foreground">
                We'll send you a magic link to securely access your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              {message && (
                <div
                  className={`p-3 rounded-lg mb-6 text-sm ${
                    message.includes("sent")
                      ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200"
                      : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
                  }`}
                >
                  {message}
                </div>
              )}

              {magicLink && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200 p-3 rounded-lg mb-6">
                  <p className="text-sm font-medium mb-2">Demo: Click the link below to access your application</p>
                  <Button asChild variant="outline" size="sm" className="w-full bg-transparent">
                    <Link href={magicLink} target="_blank">
                      Open Application Dashboard
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}

              <form onSubmit={handleSendMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-input border-border text-foreground focus:border-primary pl-10"
                      placeholder="Enter the email used for your application"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? "Sending..." : "Send Magic Link"}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have a guest application?{" "}
                  <Link href="/start?next=/apply" className="text-primary hover:text-primary/80 font-medium">
                    Start your application
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Have an account?{" "}
                  <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
                    Sign in here
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
