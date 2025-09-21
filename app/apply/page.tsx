"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, CheckCircle } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/browserClient"
import { GuestContactForm } from "@/components/application/guest-contact-form"
import { LoanDetailsForm } from "@/components/application/loan-details-form"
import { PropertyInfoForm } from "@/components/application/property-info-form"
import { FinancialInfoForm } from "@/components/application/financial-info-form"
import { SponsorInfoForm } from "@/components/application/sponsor-info-form"
import { LiquidityInfoForm } from "@/components/application/liquidity-info-form"
import { ReviewSubmitForm } from "@/components/application/review-submit-form"

const steps = [
  { id: 1, title: "Contact Info", description: "Your contact information" },
  { id: 2, title: "Loan Details", description: "Basic loan information" },
  { id: 3, title: "Property Info", description: "Property details" },
  { id: 4, title: "Financial Info", description: "Income and employment" },
  { id: 5, title: "Sponsor Info", description: "Sponsor details (if applicable)" },
  { id: 6, title: "Liquidity", description: "Assets and reserves" },
  { id: 7, title: "Review & Submit", description: "Final review" },
]

const accountSteps = [
  { id: 1, title: "Loan Details", description: "Basic loan information" },
  { id: 2, title: "Property Info", description: "Property details" },
  { id: 3, title: "Financial Info", description: "Income and employment" },
  { id: 4, title: "Sponsor Info", description: "Sponsor details (if applicable)" },
  { id: 5, title: "Liquidity", description: "Assets and reserves" },
  { id: 6, title: "Review & Submit", description: "Final review" },
]

export default function LoanApplicationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [authChoice, setAuthChoice] = useState<"account" | "guest" | null>(null)
  const [formData, setFormData] = useState({})
  const [isSubmitted, setIsSubmitted] = useState(false)
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
    console.log("Submitting application:", { ...formData, authChoice })

    if (authChoice === "guest") {
      // Generate guest token for tracking
      const guestToken = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      console.log("Generated guest token:", guestToken)

      // In a real app, this would:
      // 1. Save application to database with guest token
      // 2. Send magic link email to user
      // 3. Store token for later access
      setFormData((prev) => ({ ...prev, guestToken }))
    }

    setIsSubmitted(true)
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
          return <LoanDetailsForm onNext={handleNext} onDataChange={handleStepData} initialData={formData} />
        case 3:
          return (
            <PropertyInfoForm
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
          return <ReviewSubmitForm onPrevious={handlePrevious} onSubmit={handleSubmit} formData={formData} />
        default:
          return null
      }
    } else {
      // Account creation flow (existing logic)
      switch (currentStep) {
        case 1:
          return (
            <LoanDetailsForm
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
        const {
          data: { session },
          error,
        } = await supabaseBrowser.auth.getSession()
        if (error) throw error

        if (session?.user?.email_confirmed_at) {
          setAuthChoice("account")
          setCurrentStep(1)
          // Load profile to prefill
          const { data: prof } = await supabaseBrowser
            .from("profiles")
            .select("full_name, email, phone")
            .eq("user_id", session.user.id)
            .maybeSingle()
          if (prof) {
            setFormData((prev: any) => ({
              ...prev,
              email: prof.email || session.user.email,
              fullName: prof.full_name,
              phone: prof.phone || prev.phone,
            }))
          } else {
            setFormData((prev: any) => ({ ...prev, email: session.user.email }))
          }
        } else {
          // No verified session → route to auth with next
          router.push(`/auth?next=${encodeURIComponent("/apply")}`)
        }
      } catch (error) {
        console.error("Error checking auth:", error)
        // Continue without authentication if there's an error
      }
    }

    checkAuth()
  }, [isGuestMode, router])

  // Remove secondary mock guard to prevent conflicting redirects

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
                  PREME-2024-
                  {Math.floor(Math.random() * 1000)
                    .toString()
                    .padStart(3, "0")}
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
                    <Link href="/portal">Go back to Portal</Link>
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
                {authChoice === "account" ? "Account Application" : "Guest Application"}
              </div>
              <Link href="/dashboard" className="text-sm text-[#997100] hover:text-[#b8850a] underline">
                Go to Dashboard
              </Link>
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
                Prefer to save progress?{" "}
                <Link href="/auth?next=/apply" className="font-medium text-blue-600 hover:text-blue-500 underline">
                  Sign in to apply
                </Link>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Loan Application</h1>
            <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-4 overflow-x-auto">
            {currentSteps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-2 whitespace-nowrap ${
                  step.id === currentStep
                    ? "text-[#997100]"
                    : step.id < currentStep
                      ? "text-green-500"
                      : "text-gray-600"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.id === currentStep
                      ? "bg-[#997100] text-white"
                      : step.id < currentStep
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step.id < currentStep ? "✓" : step.id}
                </div>
                <div className="hidden md:block">
                  <div className="font-medium">{step.title}</div>
                  <div className="text-xs text-gray-600">{step.description}</div>
                </div>
                {index < currentSteps.length - 1 && <ArrowRight className="h-4 w-4 text-gray-600 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <main className="container mx-auto px-6 py-8">{renderStepContent()}</main>
    </div>
  )
}
