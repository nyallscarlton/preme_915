"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Send, Loader2 } from "lucide-react"

interface ReviewSubmitFormProps {
  onPrevious: () => void
  onSubmit: () => void
  formData: any
  isSubmitting?: boolean
  submissionError?: string | null
}

export function ReviewSubmitForm({
  onPrevious,
  onSubmit,
  formData,
  isSubmitting,
  submissionError,
}: ReviewSubmitFormProps) {
  const [tcpaConsent, setTcpaConsent] = useState(false)

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? Number.parseFloat(amount) : amount
    return isNaN(num) ? "$0" : `$${num.toLocaleString()}`
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Review & Submit</CardTitle>
          <CardDescription className="text-muted-foreground">
            Please review your information before submitting your application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Loan Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">Loan Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Loan Amount:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.loanAmount)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Property Type:</span>
                <p className="font-medium text-foreground">{formData.propertyType}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Loan Purpose:</span>
                <p className="font-medium text-foreground">{formData.loanPurpose}</p>
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Property Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">Property Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <span className="text-muted-foreground">Property Address:</span>
                <p className="font-medium text-foreground">{formData.propertyAddress}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Property Value:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.propertyValue)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Down Payment:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.downPayment)}</p>
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Financial Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">Financial Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Credit Score:</span>
                <p className="font-medium text-foreground">{formData.creditScore || "Not provided"}</p>
              </div>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Liquidity Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-foreground">Assets & Liquidity</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cash Reserves:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.cashReserves)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Investment Accounts:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.investmentAccounts)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Retirement Accounts:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.retirementAccounts)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Other Assets:</span>
                <p className="font-medium text-foreground">{formatCurrency(formData.otherAssets)}</p>
              </div>
            </div>
          </div>

          {submissionError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
              <p className="text-sm font-medium">Error submitting application:</p>
              <p className="text-sm">{submissionError}</p>
            </div>
          )}

          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-foreground mb-4">
              By submitting this application, I certify that all information provided is true and accurate to the best
              of my knowledge. I understand that any false information may result in the denial of my loan application.
            </p>
            <p className="text-xs text-muted-foreground">
              Your information is secure and will only be used for loan processing purposes. We comply with all
              applicable privacy and data protection regulations.
            </p>
          </div>

          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="tcpaConsent"
              checked={tcpaConsent}
              onChange={(e) => setTcpaConsent(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary accent-[hsl(var(--primary))]"
            />
            <label htmlFor="tcpaConsent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              By checking this box, I provide my express written consent to receive text messages and phone calls (including via automated dialing systems and artificial intelligence) about my inquiry from Preme Home Loans at the phone number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. I can revoke consent at any time by replying STOP or calling (470) 942-5787.
            </label>
          </div>

          <div className="flex justify-between pt-6">
            <Button
              onClick={onPrevious}
              variant="outline"
              className="border-border text-foreground hover:bg-muted bg-transparent font-semibold px-8"
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={onSubmit}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Application
                  <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
