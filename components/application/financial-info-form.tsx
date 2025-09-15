"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight } from "lucide-react"

interface FinancialInfoFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function FinancialInfoForm({ onNext, onPrevious, onDataChange, initialData }: FinancialInfoFormProps) {
  const [formData, setFormData] = useState({
    annualIncome: initialData.annualIncome || "",
    employmentStatus: initialData.employmentStatus || "",
    employerName: initialData.employerName || "",
    employmentYears: initialData.employmentYears || "",
    creditScore: initialData.creditScore || "",
    existingDebts: initialData.existingDebts || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const isFormValid = formData.annualIncome && formData.employmentStatus && formData.employerName

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Financial Information</CardTitle>
          <CardDescription className="text-muted-foreground">Tell us about your income and employment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="annualIncome" className="text-foreground">
                Annual Income *
              </Label>
              <Input
                id="annualIncome"
                type="number"
                placeholder="120000"
                value={formData.annualIncome}
                onChange={(e) => handleInputChange("annualIncome", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentStatus" className="text-foreground">
                Employment Status *
              </Label>
              <Select
                value={formData.employmentStatus}
                onValueChange={(value) => handleInputChange("employmentStatus", value)}
              >
                <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time Employee</SelectItem>
                  <SelectItem value="part-time">Part-time Employee</SelectItem>
                  <SelectItem value="self-employed">Self-employed</SelectItem>
                  <SelectItem value="contractor">Independent Contractor</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                  <SelectItem value="unemployed">Unemployed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="employerName" className="text-foreground">
                Employer Name *
              </Label>
              <Input
                id="employerName"
                placeholder="Company Name"
                value={formData.employerName}
                onChange={(e) => handleInputChange("employerName", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentYears" className="text-foreground">
                Years at Current Job
              </Label>
              <Input
                id="employmentYears"
                type="number"
                placeholder="5"
                value={formData.employmentYears}
                onChange={(e) => handleInputChange("employmentYears", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="creditScore" className="text-foreground">
                Credit Score (Estimated)
              </Label>
              <Select value={formData.creditScore} onValueChange={(value) => handleInputChange("creditScore", value)}>
                <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="800+">Excellent (800+)</SelectItem>
                  <SelectItem value="740-799">Very Good (740-799)</SelectItem>
                  <SelectItem value="670-739">Good (670-739)</SelectItem>
                  <SelectItem value="580-669">Fair (580-669)</SelectItem>
                  <SelectItem value="300-579">Poor (300-579)</SelectItem>
                  <SelectItem value="unknown">Don't Know</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="existingDebts" className="text-foreground">
                Total Monthly Debt Payments
              </Label>
              <Input
                id="existingDebts"
                type="number"
                placeholder="2500"
                value={formData.existingDebts}
                onChange={(e) => handleInputChange("existingDebts", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-between pt-6">
            <Button
              onClick={onPrevious}
              variant="outline"
              className="border-border text-foreground hover:bg-muted bg-transparent font-semibold px-8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={onNext}
              disabled={!isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
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
