"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    creditScore: initialData.creditScore || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const isFormValid = formData.creditScore

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Financial Information</CardTitle>
          <CardDescription className="text-muted-foreground">Tell us about your credit profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="creditScore" className="text-foreground">
              Credit Score (Estimated) *
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
