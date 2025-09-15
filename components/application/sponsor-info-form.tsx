"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, ArrowRight } from "lucide-react"

interface SponsorInfoFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function SponsorInfoForm({ onNext, onPrevious, onDataChange, initialData }: SponsorInfoFormProps) {
  const [formData, setFormData] = useState({
    hasSponsor: initialData.hasSponsor || false,
    sponsorName: initialData.sponsorName || "",
    sponsorRelationship: initialData.sponsorRelationship || "",
    sponsorIncome: initialData.sponsorIncome || "",
    sponsorCreditScore: initialData.sponsorCreditScore || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const isFormValid = !formData.hasSponsor || (formData.sponsorName && formData.sponsorRelationship)

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Sponsor Information</CardTitle>
          <CardDescription className="text-muted-foreground">
            Do you have a sponsor or co-signer for this loan?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasSponsor"
              checked={formData.hasSponsor}
              onCheckedChange={(checked) => handleInputChange("hasSponsor", checked as boolean)}
            />
            <Label
              htmlFor="hasSponsor"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
            >
              I have a sponsor/co-signer for this loan
            </Label>
          </div>

          {formData.hasSponsor && (
            <div className="space-y-6 border-t border-border pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sponsorName" className="text-foreground">
                    Sponsor Full Name *
                  </Label>
                  <Input
                    id="sponsorName"
                    placeholder="John Doe"
                    value={formData.sponsorName}
                    onChange={(e) => handleInputChange("sponsorName", e.target.value)}
                    className="bg-input border-border text-foreground focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sponsorRelationship" className="text-foreground">
                    Relationship to You *
                  </Label>
                  <Select
                    value={formData.sponsorRelationship}
                    onValueChange={(value) => handleInputChange("sponsorRelationship", value)}
                  >
                    <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="relative">Other Relative</SelectItem>
                      <SelectItem value="business-partner">Business Partner</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sponsorIncome" className="text-foreground">
                    Sponsor Annual Income
                  </Label>
                  <Input
                    id="sponsorIncome"
                    type="number"
                    placeholder="150000"
                    value={formData.sponsorIncome}
                    onChange={(e) => handleInputChange("sponsorIncome", e.target.value)}
                    className="bg-input border-border text-foreground focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sponsorCreditScore" className="text-foreground">
                    Sponsor Credit Score (Estimated)
                  </Label>
                  <Select
                    value={formData.sponsorCreditScore}
                    onValueChange={(value) => handleInputChange("sponsorCreditScore", value)}
                  >
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
              </div>
            </div>
          )}

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
