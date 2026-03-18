"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Clock, FileText, DollarSign, Home, AlertCircle, ArrowRight, Star } from "lucide-react"
import Link from "next/link"

interface Application {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  status: string
  submittedAt: string
  loanAmount: number
  loanPurpose: string
  propertyAddress: string
  propertyValue: number
  downPayment: number
  annualIncome: number
  employmentStatus: string
  employerName: string
  creditScore: string
  statusHistory: Array<{
    status: string
    date: string
    message: string
  }>
  nextSteps: string[]
}

export default function GuestDashboardPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) {
      setError("Invalid access link. Please request a new magic link.")
      setLoading(false)
      return
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/guest/verify-token?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to verify access")
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-600"
      case "under_review":
        return "bg-yellow-600"
      case "submitted":
        return "bg-blue-600"
      case "rejected":
        return "bg-red-600"
      default:
        return "bg-gray-600"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-4 w-4" />
      case "under_review":
        return <Clock className="h-4 w-4" />
      case "submitted":
        return <FileText className="h-4 w-4" />
      case "rejected":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your application...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="container mx-auto px-6 py-6">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <span className="text-3xl font-bold tracking-wide text-foreground">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-primary"></span></span>ME</span>
              </div>
            </Link>
          </div>
        </header>

        <div className="container mx-auto px-6 py-24">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-4">Access Error</h1>
            <p className="text-muted-foreground mb-8">{error}</p>
            <div className="space-y-4">
              <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/guest-access">Request New Magic Link</Link>
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
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <span className="text-3xl font-bold tracking-wide text-foreground">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-primary"></span></span>ME</span>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">Guest Access</span>
              <Button variant="outline" asChild size="sm">
                <Link href="/guest-access">Request New Link</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Approval Banner - Show if approved */}
          {application.status === "approved" && (
            <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 mb-8">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                      <Star className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                        Congratulations! Your loan has been approved!
                      </h3>
                      <p className="text-green-700 dark:text-green-300">
                        Create your full account to access enhanced loan management features.
                      </p>
                    </div>
                  </div>
                  <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
                    <Link href={`/convert-account?token=${token}`}>
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {application.firstName} {application.lastName}
            </h1>
            <p className="text-muted-foreground">Here's the current status of your loan application</p>
          </div>

          {/* Status Overview */}
          <Card className="bg-card border-border mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Application Status</CardTitle>
                  <CardDescription className="text-muted-foreground">Application ID: {application.id}</CardDescription>
                </div>
                <Badge className={`${getStatusColor(application.status)} text-white`}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(application.status)}
                    <span className="capitalize">{application.status.replace("_", " ")}</span>
                  </div>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Loan Amount</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(application.loanAmount)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Home className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Property Value</p>
                    <p className="text-lg font-semibold text-foreground">{formatCurrency(application.propertyValue)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatDate(application.submittedAt).split(",")[0]}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Application Details */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Application Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Loan Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purpose:</span>
                        <span className="text-foreground">{application.loanPurpose}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Down Payment:</span>
                        <span className="text-foreground">{formatCurrency(application.downPayment)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium text-foreground mb-2">Property Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="text-foreground text-right">{application.propertyAddress}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium text-foreground mb-2">Financial Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Annual Income:</span>
                        <span className="text-foreground">{formatCurrency(application.annualIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Employment:</span>
                        <span className="text-foreground">{application.employmentStatus}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Employer:</span>
                        <span className="text-foreground">{application.employerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Score:</span>
                        <span className="text-foreground">{application.creditScore}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="text-foreground">{application.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="text-foreground">{application.phone}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Timeline & Next Steps */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Application Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {application.statusHistory.map((item, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground capitalize">
                              {item.status.replace("_", " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Next Steps</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    What's happening with your application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {application.nextSteps.map((step, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Upgrade to Full Account - Only show if not approved */}
              {application.status !== "approved" && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-foreground">Upgrade Your Experience</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Create a full account for enhanced features
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-foreground">Real-time notifications</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-foreground">Direct messaging with loan officers</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-foreground">Document management</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-foreground">Multiple application tracking</span>
                      </div>
                    </div>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                      Create Full Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
