"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { GuestContactForm } from "@/components/application/guest-contact-form"
import { LoanDetailsForm } from "@/components/application/loan-details-form"
import { PropertyInfoForm } from "@/components/application/property-info-form"
import { FinancialInfoForm } from "@/components/application/financial-info-form"
import { SponsorInfoForm } from "@/components/application/sponsor-info-form"
import { LiquidityInfoForm } from "@/components/application/liquidity-info-form"
import { DocumentUploadForm } from "@/components/application/document-upload-form"
import { ReviewSubmitForm } from "@/components/application/review-submit-form"

const steps = [
  { id: 1, title: "Contact Info", description: "Your contact information" },
  { id: 2, title: "Property Info", description: "Property details" },
  { id: 3, title: "Loan Details", description: "Basic loan information" },
  { id: 4, title: "Financial Info", description: "Income and employment" },
  { id: 5, title: "Sponsor Info", description: "Sponsor details (if applicable)" },
  { id: 6, title: "Liquidity", description: "Assets and reserves" },
  { id: 7, title: "Documents", description: "Upload required documents" },
  { id: 8, title: "Review & Submit", description: "Final review" },
]

const accountSteps = [
  { id: 1, title: "Property Info", description: "Property details" },
  { id: 2, title: "Loan Details", description: "Basic loan information" },
  { id: 3, title: "Financial Info", description: "Income and employment" },
  { id: 4, title: "Sponsor Info", description: "Sponsor details (if applicable)" },
  { id: 5, title: "Liquidity", description: "Assets and reserves" },
  { id: 6, title: "Documents", description: "Upload required documents" },
  { id: 7, title: "Review & Submit", description: "Final review" },
]

export default function LoanApplicationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [authChoice, setAuthChoice] = useState<"account" | "guest" | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const isGuestMode = searchParams.get("guest") === "1"

  const currentSteps = authChoice === "guest" ? steps : accountSteps
  const progress = authChoice ? (currentStep / currentSteps.length) * 100 : 0

  const handleAuthChoice = (choice: "account" | "guest") => {
    setAuthChoice(choice)
    setCurrentStep(1)
  }

  const handleNext = () => {
    if (currentStep < currentSteps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepData = (stepData: any) => {
    setFormData((prev) => ({ ...prev, ...stepData }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      // Prepare the application data for the API
      const applicationData = {
        // Contact info
        applicant_email: formData.email || "",
        applicant_name: `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
        applicant_phone: formData.phone || "",
        contact_address: formData.address || "",
        contact_city: formData.city || "",
        contact_state: formData.state || "",
        contact_zip: formData.zipCode || "",

        // Loan details
        loan_amount: Number.parseFloat(formData.loanAmount) || 0,
        loan_purpose: formData.loanPurpose || "",
        loan_type: formData.propertyType || "",

        // Property info
        property_address: formData.propertyAddress || "",
        property_city: formData.propertyCity || "",
        property_state: formData.propertyState || "",
        property_zip: formData.propertyZip || "",
        property_type: formData.propertyType || "",
        property_value: Number.parseFloat(formData.propertyValue) || 0,

        // Financial info
        annual_income: Number.parseFloat(formData.annualIncome) || 0,
        employment_status: formData.employmentStatus || "",
        employer_name: formData.employerName || "",
        credit_score_range: formData.creditScore || "",

        // Sponsor info
        has_sponsor: formData.hasSponsor || false,
        sponsor_name: formData.sponsorName || "",
        sponsor_email: formData.sponsorEmail || "",
        sponsor_phone: formData.sponsorPhone || "",

        // Liquidity info
        cash_reserves: Number.parseFloat(formData.cashReserves) || 0,
        investment_accounts: Number.parseFloat(formData.investmentAccounts) || 0,
        retirement_accounts: Number.parseFloat(formData.retirementAccounts) || 0,

        // Guest flag
        is_guest: authChoice === "guest",
      }

      console.log("[v0] Submitting application to API:", applicationData)

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(applicationData),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit application")
      }

      console.log("[v0] Application submitted successfully:", result)

      // Store the application number for display
      setApplicationNumber(result.application?.application_number || null)
      setFormData((prev: any) => ({
        ...prev,
        guestToken: result.application?.guest_token,
      }))
      setIsSubmitted(true)
    } catch (error) {
      console.error("[v0] Error submitting application:", error)
      setSubmissionError(error instanceof Error ? error.message : "Failed to submit application")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    if (authChoice === "guest") {
      switch (currentStep) {
        case 1:
          return (
            <GuestContactForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 2:
          return (
            <PropertyInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 3:
          return (
            <LoanDetailsForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 4:
          return (
            <FinancialInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 5:
          return (
            <SponsorInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 6:
          return (
            <LiquidityInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 7:
          return (
            <DocumentUploadForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 8:
          return <ReviewSubmitForm onPrevious={handlePrevious} onSubmit={handleSubmit} formData={formData} />
        default:
          return null
      }
    } else {
      // Account creation flow
      switch (currentStep) {
        case 1:
          return (
            <PropertyInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 2:
          return (
            <LoanDetailsForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 3:
          return (
            <FinancialInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 4:
          return (
            <SponsorInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 5:
          return (
            <LiquidityInfoForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 6:
          return (
            <DocumentUploadForm
              onNext={handleNext}
              onPrevious={handlePrevious}
              onDataChange={handleStepData}
              initialData={formData}
            />
          )
        case 7:
          return <ReviewSubmitForm onPrevious={handlePrevious} onSubmit={handleSubmit} formData={formData} />
        default:
          return null
      }
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      if (isGuestMode) {
        setAuthChoice("guest")
        setCurrentStep(1)
        return
      }

      try {
        // Mock auth check - in production this would check actual auth
        const mockSession = null // No session for demo purposes

        if (mockSession?.user?.email_confirmed_at) {
          // User is authenticated and verified, start with account flow
          setAuthChoice("account")
          setCurrentStep(1)
        }
      } catch (error) {
        console.error("Error checking auth:", error)
        // Continue without authentication if there's an error
      }
    }

    checkAuth()
  }, [isGuestMode])

  useEffect(() => {
    const checkAuthGuard = async () => {
      // Skip guard if guest mode or already have auth choice
      if (isGuestMode || authChoice) return

      try {
        // Mock session check - in production this would check actual auth
        const mockSession = null // No session for demo purposes

        // If no session and not guest mode, redirect to auth
        if (!mockSession?.user && !isGuestMode && currentStep === 0) {
          router.push(`/auth?next=${encodeURIComponent("/apply")}`)
        }
      } catch (error) {
        console.error("Error in auth guard:", error)
      }
    }

    checkAuthGuard()
  }, [isGuestMode, authChoice, currentStep, router])

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        {/* Header */}
        <header className="border-b border-gray-200">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <div className="relative">
                  <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                  <span className="text-3xl font-bold tracking-wide text-gray-900">PREME</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Success Message */}
        <div className="container mx-auto px-6 py-24">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <CheckCircle className="h-20 w-20 text-[#997100] mx-auto mb-6" />
              <h1 className="text-4xl font-bold mb-4 text-gray-900">Application Submitted Successfully!</h1>
              <p className="text-xl text-gray-600 mb-8">
                Thank you for your loan application. We've received your information and will review it within 24-48
                hours.
              </p>
            </div>

            <Card className="bg-white border-gray-200 text-left">
              <CardHeader>
                <CardTitle className="text-[#997100]">What's Next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#997100] text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Initial Review</h3>
                    <p className="text-gray-600">Our team will review your application within 24-48 hours.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#997100] text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {authChoice === "guest" ? "Magic Link Email" : "Document Verification"}
                    </h3>
                    <p className="text-gray-600">
                      {authChoice === "guest"
                        ? "Check your email for a secure link to track your application status."
                        : "We may request additional documents or clarification."}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-[#997100] text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Final Approval</h3>
                    <p className="text-gray-600">Receive your loan decision and terms.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-8 space-y-4">
              <p className="text-gray-600">
                Application Reference:{" "}
                <span className="text-[#997100] font-mono">
                  {applicationNumber || `PREME-${Date.now().toString(36).toUpperCase()}`}
                </span>
              </p>
              {authChoice === "guest" && (
                <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong className="text-gray-900">Important:</strong> Check your email ({formData.email}) for a
                    secure magic link to access your application.
                  </p>
                  <p className="text-xs text-gray-600">
                    If approved, you'll have the option to create a full account for enhanced features.
                  </p>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800 font-medium">Create an account to save your progress</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => router.push("/auth?upgrade=1")}
                    >
                      Upgrade to Account
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-center space-x-4">
                {authChoice === "account" ? (
                  <Button asChild className="bg-[#997100] hover:bg-[#997100]/90 text-white">
                    <Link href="/login">Access Portal</Link>
                  </Button>
                ) : (
                  <Button asChild className="bg-[#997100] hover:bg-[#997100]/90 text-white">
                    <Link href="/guest-access">Check Application Status</Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  asChild
                  className="border-gray-200 text-gray-900 hover:bg-gray-50 bg-transparent"
                >
                  <Link href="/">Return Home</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        {/* Header */}
        <header className="border-b border-gray-200">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <div className="relative">
                  <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                  <span className="text-3xl font-bold tracking-wide text-gray-900">PREME</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">Start Your Loan Application</h1>
            <p className="text-xl text-gray-600 mb-8">Choose how you'd like to proceed with your application.</p>
            <div className="space-y-4">
              <Button asChild className="w-full max-w-md bg-[#997100] hover:bg-[#997100]/90 text-white">
                <Link href="/start?next=/apply">Get Started</Link>
              </Button>
              <p className="text-sm text-gray-600">You can create an account or apply as a guest on the next page.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <div className="relative">
                <div className="absolute -top-2 left-[1.1rem] w-4 h-1 bg-[#997100]"></div>
                <span className="text-3xl font-bold tracking-wide text-gray-900">PREME</span>
              </div>
            </Link>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                {authChoice === "account" ? "Creating Account" : "Guest Application"}
              </div>
              <div className="text-sm text-gray-600">
                Step {currentStep} of {currentSteps.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sign-in Banner for Guest Users */}
      {isGuestMode && currentStep > 0 && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="container mx-auto px-6 py-3">
            <div className="text-center">
              <span className="text-sm text-blue-800">
                Have an account?{" "}
                <Link href="/login" className="font-semibold underline hover:text-blue-900">
                  Sign in
                </Link>{" "}
                to save your progress and access more features.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">{currentSteps[currentStep - 1]?.title}</span>
            <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="container mx-auto px-6">
          <div className="flex space-x-1">
            {currentSteps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => index + 1 < currentStep && setCurrentStep(index + 1)}
                disabled={index + 1 > currentStep}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  index + 1 === currentStep
                    ? "text-[#997100] border-b-2 border-[#997100]"
                    : index + 1 < currentStep
                      ? "text-gray-600 hover:text-gray-900 cursor-pointer"
                      : "text-gray-400 cursor-not-allowed"
                }`}
              >
                {step.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {submissionError && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <strong>Error:</strong> {submissionError}
          </div>
        )}
        {isSubmitting ? (
          <div className="max-w-2xl mx-auto text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-[#997100] mx-auto mb-4" />
            <p className="text-lg text-gray-600">Submitting your application...</p>
          </div>
        ) : (
          renderStepContent()
        )}
      </main>
    </div>
  )
}
