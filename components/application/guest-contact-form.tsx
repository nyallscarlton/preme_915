"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, ArrowLeft, Mail, Phone, User } from "lucide-react"
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
    lastName: initialData.lastName || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    address: initialData.address || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const isFormValid = formData.firstName && formData.lastName && formData.email && formData.phone

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Contact Information</CardTitle>
          <CardDescription className="text-muted-foreground">
            We'll use this information to keep you updated on your application status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-foreground">
                First Name *
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className="bg-input border-border text-foreground focus:border-primary pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-foreground">
                Last Name *
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  className="bg-input border-border text-foreground focus:border-primary pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email Address *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              We'll send application updates and a secure link to track your progress
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">
              Phone Number *
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary pl-10"
              />
            </div>
          </div>

          <AddressInput
            id="address"
            label="Address"
            placeholder="123 Main Street, Beverly Hills, CA 90210"
            value={formData.address}
            onChange={(value) => handleInputChange("address", value)}
          />

          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">Guest Application Benefits</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Quick application process without account creation</li>
              <li>• Email updates on your application status</li>
              <li>• Secure magic link to access your application</li>
              <li>• Option to create full account if approved</li>
            </ul>
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
              onClick={onNext}
              disabled={!isFormValid}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 ml-auto"
            >
              Continue Application
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
