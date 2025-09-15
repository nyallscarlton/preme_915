"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRight, ArrowLeft } from "lucide-react"

interface LoanDetailsFormProps {
  onNext: () => void
  onPrevious?: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function LoanDetailsForm({ onNext, onPrevious, onDataChange, initialData }: LoanDetailsFormProps) {
  const [formData, setFormData] = useState({
    loanAmount: initialData.loanAmount || "",
    loanPurpose: initialData.loanPurpose || "",
    loanTermMonths: initialData.loanTermMonths || "",
    propertyType: initialData.propertyType || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const handleNext = () => {
    onNext()
  }

  const isFormValid = formData.loanAmount && formData.loanPurpose && formData.loanTermMonths && formData.propertyType

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Loan Details</CardTitle>
          <CardDescription className="text-muted-foreground">Tell us about the loan you're seeking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="loanAmount" className="text-foreground">
                Loan Amount *
              </Label>
              <Input
                id="loanAmount"
                type="number"
                placeholder="500000"
                value={formData.loanAmount}
                onChange={(e) => handleInputChange("loanAmount", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loanTermMonths" className="text-foreground">
                Loan Term (Months) *
              </Label>
              <Select
                value={formData.loanTermMonths}
                onValueChange={(value) => handleInputChange("loanTermMonths", value)}
              >
                <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="120">10 Years (120 months)</SelectItem>
                  <SelectItem value="180">15 Years (180 months)</SelectItem>
                  <SelectItem value="240">20 Years (240 months)</SelectItem>
                  <SelectItem value="300">25 Years (300 months)</SelectItem>
                  <SelectItem value="360">30 Years (360 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyType" className="text-foreground">
              Property Type *
            </Label>
            <Select value={formData.propertyType} onValueChange={(value) => handleInputChange("propertyType", value)}>
              <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single-family">Single Family Home</SelectItem>
                <SelectItem value="condo">Condominium</SelectItem>
                <SelectItem value="townhouse">Townhouse</SelectItem>
                <SelectItem value="multi-family">Multi-Family (2-4 units)</SelectItem>
                <SelectItem value="commercial">Commercial Property</SelectItem>
                <SelectItem value="land">Land/Lot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loanPurpose" className="text-foreground">
              Loan Purpose *
            </Label>
            <Textarea
              id="loanPurpose"
              placeholder="Describe the purpose of this loan (e.g., purchase primary residence, investment property, refinance, etc.)"
              value={formData.loanPurpose}
              onChange={(e) => handleInputChange("loanPurpose", e.target.value)}
              className="bg-input border-border text-foreground focus:border-primary min-h-[100px]"
            />
          </div>

          <div className="flex justify-between pt-6">
            {onPrevious && (
              <Button
                onClick={onPrevious}
                variant="outline"
                className="border-border text-foreground hover:bg-muted bg-transparent font-semibold px-8"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 ml-auto"
            >
              Next Step
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
