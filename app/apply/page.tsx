"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { gtagLeadConversion, gtagFormStep, gtagFormStepComplete, gtagApplicationStart, gtagFormAbandon } from "@/lib/gtag"
import { GuestContactForm } from "@/components/application/guest-contact-form"
import { LoanDetailsForm } from "@/components/application/loan-details-form"
import { PropertyInfoForm } from "@/components/application/property-info-form"
import { VestingEntityForm } from "@/components/application/vesting-entity-form"
import { FinancialInfoForm } from "@/components/application/financial-info-form"
import { LiquidityInfoForm } from "@/components/application/liquidity-info-form"
import { ReoScheduleForm } from "@/components/application/reo-schedule-form"
import { DocumentUploadForm } from "@/components/application/document-upload-form"
import { ReviewSubmitForm } from "@/components/application/review-submit-form"

const steps = [
  { id: 1, title: "Borrower", description: "Identity, SSN, residence" },
  { id: 2, title: "Property", description: "Subject property + rent" },
  { id: 3, title: "Loan", description: "Loan terms" },
  { id: 4, title: "Vesting", description: "Individual or LLC" },
  { id: 5, title: "Financial", description: "Credit + declarations" },
  { id: 6, title: "Liquidity", description: "Reserves & assets" },
  { id: 7, title: "REO", description: "Existing rentals" },
  { id: 8, title: "Documents", description: "Upload docs" },
  { id: 9, title: "Review", description: "Confirm & submit" },
]

const accountSteps = [
  { id: 1, title: "Property", description: "Subject property + rent" },
  { id: 2, title: "Loan", description: "Loan terms" },
  { id: 3, title: "Vesting", description: "Individual or LLC" },
  { id: 4, title: "Financial", description: "Credit + declarations" },
  { id: 5, title: "Liquidity", description: "Reserves & assets" },
  { id: 6, title: "REO", description: "Existing rentals" },
  { id: 7, title: "Documents", description: "Upload docs" },
  { id: 8, title: "Review", description: "Confirm & submit" },
]

export default function LoanApplicationPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [authChoice, setAuthChoice] = useState<"account" | "guest" | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingToken, setIsLoadingToken] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null)
  const [existingApplicationId, setExistingApplicationId] = useState<string | null>(null)
  const [existingGuestToken, setExistingGuestToken] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const isGuestMode = searchParams.get("guest") === "1"
  const token = searchParams.get("token")

  const currentSteps = authChoice === "guest" ? steps : accountSteps
  const progress = authChoice ? (currentStep / currentSteps.length) * 100 : 0

  const handleAuthChoice = (choice: "account" | "guest") => {
    setAuthChoice(choice)
    setCurrentStep(1)
    gtagApplicationStart(choice)
    gtagFormStep(1, choice)
  }

  const handleNext = () => {
    if (currentStep < currentSteps.length) {
      const mode = authChoice || "guest"
      gtagFormStepComplete(currentStep, mode)
      setCurrentStep(currentStep + 1)
      gtagFormStep(currentStep + 1, mode)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Track form abandonment on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (authChoice && currentStep > 0 && !isSubmitted) {
        gtagFormAbandon(currentStep, authChoice)
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [authChoice, currentStep, isSubmitted])

  const handleStepData = (stepData: Record<string, unknown>) => {
    setFormData((prev: Record<string, unknown>) => ({ ...prev, ...stepData }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      const n = (v: any) => (v === "" || v == null ? null : Number(v))
      const s = (v: any) => (v === "" || v == null ? null : String(v))

      // Prepare the application data for the API — snake_case matching DB columns
      const applicationData: Record<string, unknown> = {
        // Contact + identity (PII encryption happens server-side)
        applicant_email: formData.email || "",
        applicant_name: `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
        applicant_phone: formData.phone || "",
        applicant_first_name: s(formData.firstName),
        applicant_middle_name: s(formData.middleName),
        applicant_last_name: s(formData.lastName),
        applicant_name_suffix: s(formData.nameSuffix),
        applicant_dob: s(formData.dateOfBirth),
        applicant_ssn: s(formData.ssn), // server will encrypt & drop
        applicant_citizenship_type: s(formData.citizenshipType),
        applicant_marital_status: s(formData.maritalStatus),
        applicant_dependent_count: n(formData.dependentCount),
        applicant_current_residence_basis: s(formData.currentResidenceBasis),
        applicant_current_residence_months: n(formData.currentResidenceMonths),
        contact_address: formData.address || "",
        contact_city: formData.city || "",
        contact_state: formData.state || "",
        contact_zip: formData.zipCode || "",

        // Loan details
        loan_amount: n(formData.loanAmount) ?? 0,
        loan_purpose: s(formData.loanPurpose),
        loan_type: s(formData.propertyType),
        mortgage_type: s(formData.mortgageType) ?? "Conventional",
        lien_priority: "FirstLien",
        note_amount: n(formData.loanAmount) ?? 0,
        note_rate_percent: n(formData.noteRatePercent),
        loan_term_months: n(formData.loanTermMonths) ?? 360,
        amortization_type: s(formData.amortizationType) ?? "Fixed",
        interest_only: !!formData.interestOnly,
        balloon: !!formData.balloon,
        has_prepay_penalty: !!formData.hasPrepayPenalty,
        is_renovation_loan: !!formData.isRenovationLoan,
        total_mortgaged_properties_count: n(formData.totalMortgagedPropertiesCount),
        property_acquired_date: s(formData.propertyAcquiredDate),
        property_original_cost: n(formData.propertyOriginalCost),
        property_existing_lien_amount: n(formData.propertyExistingLienAmount),
        arms_length: true,

        // Property
        property_address: formData.propertyAddress || "",
        property_city: formData.propertyCity || "",
        property_state: formData.propertyState || "",
        property_zip: formData.propertyZip || "",
        property_county: s(formData.propertyCounty),
        property_type: formData.propertyType || "",
        property_value: n(formData.propertyValue) ?? 0,
        property_usage_type: s(formData.propertyUsageType) ?? "Investment",
        current_occupancy_type: s(formData.currentOccupancy),
        financed_unit_count: n(formData.financedUnitCount),
        year_built: n(formData.yearBuilt),
        gross_living_area_sqft: n(formData.grossLivingAreaSqft),
        acreage: n(formData.acreage),
        attachment_type: s(formData.attachmentType) ?? "Detached",
        is_pud: !!formData.isPUD,

        // Rental income + PITIA
        rental_gross_monthly: n(formData.rentalGrossMonthly),
        rental_occupancy_pct: n(formData.rentalOccupancyPct) ?? 95,
        lease_rent_monthly: n(formData.leaseRentMonthly),
        lease_expiration_date: s(formData.leaseExpirationDate),
        is_short_term_rental: !!formData.isShortTermRental,
        annual_property_tax: n(formData.annualPropertyTax),
        hazard_insurance_monthly: n(formData.hazardInsuranceMonthly),
        hoa_monthly: n(formData.hoaMonthly),
        flood_insurance_monthly: n(formData.floodInsuranceMonthly),
        property_mgmt_fee_monthly: n(formData.propertyMgmtFeeMonthly),

        // Vesting & entity
        vesting_type: s(formData.vestingType) ?? "Individual",
        entity_legal_name: s(formData.entityLegalName),
        entity_org_type: s(formData.entityOrgType),
        entity_state_of_formation: s(formData.entityStateOfFormation),
        entity_formation_date: s(formData.entityFormationDate),
        entity_ein: s(formData.entityEIN), // server encrypts
        entity_address: s(formData.entityAddress),
        entity_city: s(formData.entityCity),
        entity_state: s(formData.entityState),
        entity_zip: s(formData.entityZip),

        // Financial + declarations
        credit_score_range: formData.creditScore || "",
        credit_score_exact: n(formData.creditScoreExact),
        employer_name: s(formData.employerName),
        employment_status: s(formData.employmentStatus),
        annual_income: n(formData.annualIncome),
        _declarations: {
          intent_to_occupy: formData.decl_intent_to_occupy ?? false,
          homeowner_past_3yrs: formData.decl_homeowner_past_3yrs,
          bankruptcy: formData.decl_bankruptcy ?? false,
          bankruptcy_chapter: s(formData.decl_bankruptcy_chapter),
          bankruptcy_filed_date: s(formData.decl_bankruptcy_filed_date),
          bankruptcy_discharged_date: s(formData.decl_bankruptcy_discharged_date),
          outstanding_judgments: formData.decl_outstanding_judgments ?? false,
          party_to_lawsuit: formData.decl_party_to_lawsuit ?? false,
          presently_delinquent_federal_debt: formData.decl_presently_delinquent_federal_debt ?? false,
          undisclosed_borrowed_funds: formData.decl_undisclosed_borrowed_funds ?? false,
          undisclosed_borrowed_funds_amount: n(formData.decl_undisclosed_borrowed_funds_amount),
          undisclosed_mortgage_application: formData.decl_undisclosed_mortgage_application ?? false,
          undisclosed_credit_application: formData.decl_undisclosed_credit_application ?? false,
          undisclosed_comaker: formData.decl_undisclosed_comaker ?? false,
          prior_deed_in_lieu: formData.decl_prior_deed_in_lieu ?? false,
          prior_short_sale: formData.decl_prior_short_sale ?? false,
          prior_foreclosure: formData.decl_prior_foreclosure ?? false,
          proposed_clean_energy_lien: formData.decl_proposed_clean_energy_lien ?? false,
        },

        // HMDA
        hmda_gender: s(formData.hmda_gender),
        hmda_ethnicity_refused: !!formData.hmda_ethnicity_refused,
        hmda_race_refused: !!formData.hmda_race_refused,

        // Liquidity
        cash_reserves: n(formData.cashReserves) ?? 0,
        investment_accounts: n(formData.investmentAccounts) ?? 0,
        retirement_accounts: n(formData.retirementAccounts) ?? 0,

        // REO schedule (child rows)
        _reo_properties: Array.isArray(formData.reoProperties) ? formData.reoProperties : [],

        // Attestations
        credit_report_authorization_indicator: !!formData.tcpaConsent,

        // Guest flag
        is_guest: authChoice === "guest",
      }

      console.log("[v0] Submitting application to API:", applicationData)

      // If updating an existing application (from email link), use PUT
      const isUpdate = !!existingApplicationId
      const url = isUpdate
        ? `/api/applications/${existingApplicationId}`
        : "/api/applications"

      const response = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...applicationData,
          ...(existingGuestToken ? { guest_token: existingGuestToken } : {}),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit application")
      }

      console.log("[v0] Application submitted successfully:", result)

      // Fire Google Ads conversion
      gtagLeadConversion()

      // Store the application number for display
      setApplicationNumber(result.application?.application_number || null)
      setFormData((prev: Record<string, unknown>) => ({
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
    const p = { onNext: handleNext, onPrevious: handlePrevious, onDataChange: handleStepData, initialData: formData }
    if (authChoice === "guest") {
      switch (currentStep) {
        case 1: return <GuestContactForm {...p} />
        case 2: return <PropertyInfoForm {...p} />
        case 3: return <LoanDetailsForm {...p} />
        case 4: return <VestingEntityForm {...p} />
        case 5: return <FinancialInfoForm {...p} />
        case 6: return <LiquidityInfoForm {...p} />
        case 7: return <ReoScheduleForm {...p} />
        case 8: return <DocumentUploadForm {...p} applicationId={existingApplicationId || undefined} guestToken={existingGuestToken || undefined} />
        case 9: return <ReviewSubmitForm onPrevious={handlePrevious} onSubmit={handleSubmit} formData={formData} />
        default: return null
      }
    }
    switch (currentStep) {
      case 1: return <PropertyInfoForm {...p} />
      case 2: return <LoanDetailsForm {...p} />
      case 3: return <VestingEntityForm {...p} />
      case 4: return <FinancialInfoForm {...p} />
      case 5: return <LiquidityInfoForm {...p} />
      case 6: return <ReoScheduleForm {...p} />
      case 7: return <DocumentUploadForm {...p} applicationId={existingApplicationId || undefined} guestToken={existingGuestToken || undefined} />
      case 8: return <ReviewSubmitForm onPrevious={handlePrevious} onSubmit={handleSubmit} formData={formData} />
      default: return null
    }
  }

  // Load existing application data when token is present
  useEffect(() => {
    if (!token) return

    const loadApplication = async () => {
      setIsLoadingToken(true)
      try {
        const res = await fetch(`/api/guest/verify-token?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (data.ok && data.application) {
          gtagApplicationStart("guest")
          gtagFormStep(1, "guest")
          const app = data.application
          const prefilled: Record<string, unknown> = {
            firstName: app.firstName || "",
            lastName: app.lastName || "",
            email: app.email && !app.email.endsWith("@placeholder.preme") ? app.email : "",
            phone: app.phone || "",
            propertyAddress: app.propertyAddress || "",
            propertyCity: app.propertyCity || "",
            propertyState: app.propertyState || "",
            propertyZip: app.propertyZip || "",
            propertyType: app.propertyType || "",
            propertyValue: app.propertyValue || "",
            loanAmount: app.loanAmount || "",
            loanPurpose: app.loanPurpose || "",
            creditScore: app.creditScore || "",
            cashReserves: app.cashReserves || "",
            investmentAccounts: app.investmentAccounts || "",
            retirementAccounts: app.retirementAccounts || "",
            tcpaConsent: true, // They already consented via phone call
          }
          setFormData(prefilled)
          setExistingApplicationId(app.applicationId)
          setExistingGuestToken(app.guestToken)
          setApplicationNumber(app.applicationNumber)
          setAuthChoice("guest")
          setCurrentStep(1)
        } else {
          console.error("[apply] Token verification failed:", data.error)
          // Fall through to normal guest mode
          setAuthChoice("guest")
          setCurrentStep(1)
        }
      } catch (err) {
        console.error("[apply] Error loading application:", err)
        setAuthChoice("guest")
        setCurrentStep(1)
      } finally {
        setIsLoadingToken(false)
      }
    }

    loadApplication()
  }, [token])

  useEffect(() => {
    const checkAuth = async () => {
      if (token) return // Token flow handles its own setup
      if (isGuestMode) {
        setAuthChoice("guest")
        setCurrentStep(1)
        return
      }

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          setAuthChoice("account")
          setCurrentStep(1)
        }
      } catch (error) {
        console.error("Error checking auth:", error)
      }
    }

    checkAuth()
  }, [isGuestMode, token])

  useEffect(() => {
    const checkAuthGuard = async () => {
      // Skip guard if guest mode, token mode, or already have auth choice
      if (isGuestMode || token || authChoice) return

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Don't redirect — let the page show the "Start Your Loan Application" choice
      // so users (and 10DLC crawlers) can see the guest option
      if (!user && !isGuestMode && currentStep === 0) {
        return
      }
      } catch (error) {
        console.error("Error in auth guard:", error)
      }
    }

    checkAuthGuard()
  }, [isGuestMode, authChoice, currentStep, router])

  if (isLoadingToken) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#997100] mx-auto mb-4" />
          <p className="text-lg text-gray-600">Loading your application...</p>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white text-gray-900">
        {/* Header */}
        <header className="border-b border-gray-200">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center">
                <div className="relative">
                  <span className="text-3xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
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
                  <span className="text-3xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4 text-gray-900">Start Your Loan Application</h1>
            <p className="text-xl text-gray-600 mb-8">Choose how you'd like to proceed with your application.</p>
            <div className="space-y-4 max-w-md mx-auto">
              <Button asChild className="w-full bg-[#997100] hover:bg-[#997100]/90 text-white">
                <Link href="/start?next=/apply">Create Account & Apply</Link>
              </Button>
              <Button asChild variant="outline" className="w-full border-[#997100] text-[#997100] hover:bg-[#997100]/10">
                <Link href="/apply?guest=1">Continue as Guest</Link>
              </Button>
              <p className="text-sm text-gray-500">Guest applications don't require an account. You'll receive a secure link to track your progress.</p>
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
                <span className="text-3xl font-bold tracking-wide text-gray-900">PR<span className="relative">E<span className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-[#997100]"></span></span>ME</span>
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
