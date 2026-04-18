"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
    downPayment: initialData.downPayment || "",
    propertyDescription: initialData.propertyDescription || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const isFormValid = formData.propertyAddress && formData.propertyValue && formData.downPayment

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
              <Label htmlFor="downPayment" className="text-foreground">
                Down Payment Amount *
              </Label>
              <Input
                id="downPayment"
                type="number"
                placeholder="150000"
                value={formData.downPayment}
                onChange={(e) => handleInputChange("downPayment", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertyDescription" className="text-foreground">
              Property Description (Optional)
            </Label>
            <Textarea
              id="propertyDescription"
              placeholder="Additional details about the property, condition, special features, etc."
              value={formData.propertyDescription}
              onChange={(e) => handleInputChange("propertyDescription", e.target.value)}
              className="bg-input border-border text-foreground focus:border-primary min-h-[100px]"
            />
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
