"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle, User, FileText, Mail, Lock } from "lucide-react"
import Link from "next/link"

interface AuthSelectionProps {
  onAuthChoice: (choice: "account" | "guest") => void
}

export function AuthSelection({ onAuthChoice }: AuthSelectionProps) {
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleAccountCreation = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Here you would create the account via Supabase
      // For now, we'll simulate success and proceed
      console.log("Creating account:", formData)
      onAuthChoice("account")
    } catch (err) {
      setError("Failed to create account. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (showAccountForm) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Create Your Account</h2>
          <p className="text-muted-foreground">Get started with your loan application</p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg mb-6 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleAccountCreation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-foreground">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="bg-input border-border text-foreground focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-foreground">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="bg-input border-border text-foreground focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="bg-input border-border text-foreground focus:border-primary pl-10"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Password
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? "Creating Account..." : "Create Account & Continue"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAccountForm(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ← Back to options
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">Get Started with Your Loan Application</h1>
        <p className="text-xl text-muted-foreground">Choose how you'd like to proceed with your application</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Create Account Option */}
        <Card
          className="bg-card border-border hover:border-primary transition-colors cursor-pointer"
          onClick={() => setShowAccountForm(true)}
        >
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl text-foreground">Create Account</CardTitle>
            <CardDescription className="text-muted-foreground">
              Get full access to track your applications and manage your profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Track application status in real-time</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Save and resume applications</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Secure document storage</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Direct communication with loan officers</span>
              </div>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Create Account & Apply
            </Button>
          </CardContent>
        </Card>

        {/* Guest Application Option */}
        <Card
          className="bg-card border-border hover:border-primary transition-colors cursor-pointer"
          onClick={() => onAuthChoice("guest")}
        >
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground">Apply as Guest</CardTitle>
            <CardDescription className="text-muted-foreground">
              Submit your application quickly without creating an account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Quick application process</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">No account setup required</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Email updates on application status</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-foreground">Create account later if approved</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
            >
              Continue as Guest
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-8">
        <p className="text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}
