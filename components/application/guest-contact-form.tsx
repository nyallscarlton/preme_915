"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowRight, ArrowLeft, Mail, Phone, User, Shield } from "lucide-react"
import { AddressInput } from "@/components/ui/address-input"

interface GuestContactFormProps {
  onNext: () => void
  onPrevious?: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function GuestContactForm({ onNext, onPrevious, onDataChange, initialData }: GuestContactFormProps) {
  const [formData, setFormData] = useState({
    firstName: initialData.firstName || "",
    middleName: initialData.middleName || "",
    lastName: initialData.lastName || "",
    nameSuffix: initialData.nameSuffix || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    address: initialData.address || "",
    dateOfBirth: initialData.dateOfBirth || "",
    ssn: initialData.ssn || "",
    citizenshipType: initialData.citizenshipType || "",
    maritalStatus: initialData.maritalStatus || "",
    dependentCount: initialData.dependentCount || "",
    currentResidenceBasis: initialData.currentResidenceBasis || "",
    currentResidenceMonths: initialData.currentResidenceMonths || "",
    tcpaConsent: initialData.tcpaConsent || false,
    ...initialData,
  })

  const update = (field: string, value: string | boolean) => {
    const next = { ...formData, [field]: value }
    setFormData(next)
    onDataChange(next)
  }

  const isFormValid =
    formData.firstName && formData.lastName && formData.email && formData.phone &&
    formData.dateOfBirth && formData.ssn && formData.citizenshipType

  return (
    <div className="max-w-3xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Borrower Information</CardTitle>
          <CardDescription>Required for loan underwriting — all fields are encrypted at rest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="firstName">First Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="firstName" value={formData.firstName} onChange={(e) => update("firstName", e.target.value)} className="pl-10" placeholder="Jane" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle</Label>
              <Input id="middleName" value={formData.middleName} onChange={(e) => update("middleName", e.target.value)} placeholder="A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameSuffix">Suffix</Label>
              <Input id="nameSuffix" value={formData.nameSuffix} onChange={(e) => update("nameSuffix", e.target.value)} placeholder="Jr" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input id="lastName" value={formData.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Tester" />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={formData.email} onChange={(e) => update("email", e.target.value)} className="pl-10" placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="phone" type="tel" value={formData.phone} onChange={(e) => update("phone", e.target.value)} className="pl-10" placeholder="(555) 123-4567" />
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssn" className="flex items-center gap-1">SSN * <Shield className="h-3 w-3 text-primary" /></Label>
              <Input id="ssn" inputMode="numeric" placeholder="XXX-XX-XXXX" value={formData.ssn} onChange={(e) => update("ssn", e.target.value)} maxLength={11} />
              <p className="text-xs text-muted-foreground">Encrypted at rest with AES-256. Never logged.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="citizenshipType">Citizenship *</Label>
              <Select value={formData.citizenshipType} onValueChange={(v) => update("citizenshipType", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USCitizen">U.S. Citizen</SelectItem>
                  <SelectItem value="PermanentResidentAlien">Permanent Resident</SelectItem>
                  <SelectItem value="NonPermanentResidentAlien">Non-Permanent Resident</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maritalStatus">Marital Status</Label>
              <Select value={formData.maritalStatus} onValueChange={(v) => update("maritalStatus", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Married">Married</SelectItem>
                  <SelectItem value="Unmarried">Unmarried</SelectItem>
                  <SelectItem value="Separated">Separated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dependentCount">Dependents</Label>
              <Input id="dependentCount" type="number" min={0} value={formData.dependentCount} onChange={(e) => update("dependentCount", e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Address */}
          <AddressInput id="address" label="Current Residence Address *" placeholder="123 Main St, Atlanta, GA 30303" value={formData.address} onChange={(v) => update("address", v)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentResidenceBasis">I currently *</Label>
              <Select value={formData.currentResidenceBasis} onValueChange={(v) => update("currentResidenceBasis", v)}>
                <SelectTrigger><SelectValue placeholder="Own / Rent / Live Rent-Free" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Own">Own this residence</SelectItem>
                  <SelectItem value="Rent">Rent this residence</SelectItem>
                  <SelectItem value="LivingRentFree">Live rent-free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentResidenceMonths">Months at address</Label>
              <Input id="currentResidenceMonths" type="number" min={0} value={formData.currentResidenceMonths} onChange={(e) => update("currentResidenceMonths", e.target.value)} placeholder="24" />
            </div>
          </div>

          {/* TCPA */}
          <div className="flex items-start space-x-3 pt-2">
            <input type="checkbox" id="tcpaConsent" checked={formData.tcpaConsent} onChange={(e) => update("tcpaConsent", e.target.checked)} className="mt-1 h-4 w-4" />
            <label htmlFor="tcpaConsent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              By checking this box, I consent to receive texts and calls (including automated) from Preme Home Loans about my inquiry. Consent is not a condition of purchase. Reply STOP to opt out. <a href="/privacy" className="underline text-primary">Privacy</a> · <a href="/terms" className="underline text-primary">Terms</a>.
            </label>
          </div>

          <div className="flex justify-between pt-6">
            {onPrevious && (
              <Button onClick={onPrevious} variant="outline" className="px-8"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            )}
            <Button onClick={onNext} disabled={!isFormValid} className="px-8 ml-auto">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
