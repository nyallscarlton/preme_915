"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { AddressInput } from "@/components/ui/address-input"

interface PropertyInfoFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function PropertyInfoForm({ onNext, onPrevious, onDataChange, initialData }: PropertyInfoFormProps) {
  const [formData, setFormData] = useState({
    propertyAddress: initialData.propertyAddress || "",
    propertyValue: initialData.propertyValue || "",
    loanPurpose: initialData.loanPurpose || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const isFormValid = formData.propertyAddress && formData.propertyValue && formData.loanPurpose

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Property Information</CardTitle>
          <CardDescription className="text-muted-foreground">Provide details about the property</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AddressInput
            id="propertyAddress"
            label="Property Address"
            placeholder="123 Main Street, Beverly Hills, CA 90210"
            value={formData.propertyAddress}
            onChange={(value) => handleInputChange("propertyAddress", value)}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="propertyValue" className="text-foreground">
                Estimated Property Value *
              </Label>
              <Input
                id="propertyValue"
                type="number"
                placeholder="750000"
                value={formData.propertyValue}
                onChange={(e) => handleInputChange("propertyValue", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loanPurpose" className="text-foreground">
                Loan Purpose *
              </Label>
              <Select value={formData.loanPurpose} onValueChange={(value) => handleInputChange("loanPurpose", value)}>
                <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                  <SelectValue placeholder="What's this loan for?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="refinance">Refinance</SelectItem>
                  <SelectItem value="cash-out-refinance">Cash-Out Refinance</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="renovation">Renovation</SelectItem>
                  <SelectItem value="investment">Investment Property</SelectItem>
                  <SelectItem value="bridge-loan">Bridge Loan</SelectItem>
                  <SelectItem value="debt-consolidation">Debt Consolidation</SelectItem>
                  <SelectItem value="home-equity">Home Equity</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
