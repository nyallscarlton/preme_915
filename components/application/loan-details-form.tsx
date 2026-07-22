"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

  const isFormValid =
    formData.loanAmount &&
    formData.loanPurpose &&
    formData.propertyType &&
    (formData.entityType === "individual" ||
      (formData.entityType === "entity" && (formData.entityLlcId || formData.entityLegalName)))

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Loan Details</CardTitle>
          <CardDescription className="text-muted-foreground">Tell us about the loan you're seeking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <Select value={formData.loanPurpose} onValueChange={(value) => handleInputChange("loanPurpose", value)}>
              <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                <SelectValue placeholder="Select loan purpose" />
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

          {/* Ownership / vesting — personal name or an LLC (saved or new) */}
          <div className="space-y-2">
            <Label className="text-foreground">How will you hold title? *</Label>
            <Select
              value={
                formData.entityType === "entity"
                  ? (formData.entityLlcId ? `llc:${formData.entityLlcId}` : formData.entityLegalName ? "llc:new" : "")
                  : formData.entityType === "individual" ? "individual" : ""
              }
              onValueChange={(value) => {
                if (value === "individual") {
                  const updated = { ...formData, entityType: "individual", entityLlcId: "", entityLegalName: "", entityEin: "", entityStateOfFormation: "", entityOrgType: "" }
                  setFormData(updated)
                  onDataChange(updated)
                } else if (value === "llc:new") {
                  const updated = { ...formData, entityType: "entity", entityLlcId: "", entityLegalName: "", entityEin: "", entityStateOfFormation: "", entityOrgType: "LLC" }
                  setFormData(updated)
                  onDataChange(updated)
                } else {
                  const llcId = value.slice(4)
                  const llc = (formData._savedLlcs || []).find((l: any) => String(l.id) === llcId)
                  const updated = {
                    ...formData,
                    entityType: "entity",
                    entityLlcId: llcId,
                    entityLegalName: llc?.legal_name || "",
                    entityOrgType: llc?.org_type || "LLC",
                    entityStateOfFormation: llc?.state_of_formation || "",
                    entityEin: "",
                  }
                  setFormData(updated)
                  onDataChange(updated)
                }
              }}
            >
              <SelectTrigger className="bg-input border-border text-foreground focus:border-primary">
                <SelectValue placeholder="Personal name or LLC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">My personal name</SelectItem>
                {(formData._savedLlcs || []).filter((l: any) => l.id).map((l: any) => (
                  <SelectItem key={l.id} value={`llc:${l.id}`}>
                    {l.legal_name}
                  </SelectItem>
                ))}
                <SelectItem value="llc:new">+ New LLC / entity</SelectItem>
              </SelectContent>
            </Select>
            {formData.entityType === "entity" && !formData.entityLlcId && (
              <div className="mt-3 space-y-3 rounded-md border border-border p-3">
                <div className="space-y-2">
                  <Label className="text-foreground">LLC legal name *</Label>
                  <Input
                    placeholder="Sunrise Holdings LLC"
                    value={formData.entityLegalName || ""}
                    onChange={(e) => handleInputChange("entityLegalName", e.target.value)}
                    className="bg-input border-border text-foreground focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-foreground">EIN</Label>
                    <Input
                      placeholder="12-3456789"
                      value={formData.entityEin || ""}
                      onChange={(e) => handleInputChange("entityEin", e.target.value)}
                      className="bg-input border-border text-foreground focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground">State of formation</Label>
                    <Input
                      placeholder="GA"
                      maxLength={2}
                      value={formData.entityStateOfFormation || ""}
                      onChange={(e) => handleInputChange("entityStateOfFormation", e.target.value.toUpperCase())}
                      className="bg-input border-border text-foreground focus:border-primary"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saved to your account — next deal it's one click in the dropdown.
                </p>
              </div>
            )}
            {formData.entityType === "entity" && formData.entityLlcId && (
              <p className="text-xs text-muted-foreground">
                Using {formData.entityLegalName} — manage your LLCs and their docs from your dashboard.
              </p>
            )}
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
