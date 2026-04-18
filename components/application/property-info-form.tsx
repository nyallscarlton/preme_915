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
    propertyCity: initialData.propertyCity || "",
    propertyState: initialData.propertyState || "",
    propertyZip: initialData.propertyZip || "",
    propertyCounty: initialData.propertyCounty || "",
    propertyValue: initialData.propertyValue || "",
    propertyUsageType: initialData.propertyUsageType || "Investment",
    currentOccupancy: initialData.currentOccupancy || "",
    financedUnitCount: initialData.financedUnitCount || "1",
    yearBuilt: initialData.yearBuilt || "",
    grossLivingAreaSqft: initialData.grossLivingAreaSqft || "",
    acreage: initialData.acreage || "",
    attachmentType: initialData.attachmentType || "Detached",
    isPUD: initialData.isPUD || false,
    rentalGrossMonthly: initialData.rentalGrossMonthly || "",
    rentalOccupancyPct: initialData.rentalOccupancyPct || "95",
    isTenantOccupied: initialData.isTenantOccupied || false,
    leaseRentMonthly: initialData.leaseRentMonthly || "",
    leaseExpirationDate: initialData.leaseExpirationDate || "",
    isShortTermRental: initialData.isShortTermRental || false,
    annualPropertyTax: initialData.annualPropertyTax || "",
    hazardInsuranceMonthly: initialData.hazardInsuranceMonthly || "",
    hoaMonthly: initialData.hoaMonthly || "",
    floodInsuranceMonthly: initialData.floodInsuranceMonthly || "",
    propertyMgmtFeeMonthly: initialData.propertyMgmtFeeMonthly || "",
    ...initialData,
  })

  const update = (field: string, value: string | boolean) => {
    const next = { ...formData, [field]: value }
    setFormData(next)
    onDataChange(next)
  }

  const valid =
    formData.propertyAddress && formData.propertyValue && formData.financedUnitCount &&
    formData.yearBuilt && formData.grossLivingAreaSqft

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Subject Property</CardTitle>
          <CardDescription>The property this loan is on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AddressInput id="propertyAddress" label="Street Address *" placeholder="123 Main St" value={formData.propertyAddress} onChange={(v) => update("propertyAddress", v)} required />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label>City</Label>
              <Input value={formData.propertyCity} onChange={(e) => update("propertyCity", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={formData.propertyState} onChange={(e) => update("propertyState", e.target.value)} maxLength={2} placeholder="GA" />
            </div>
            <div className="space-y-2">
              <Label>Zip</Label>
              <Input value={formData.propertyZip} onChange={(e) => update("propertyZip", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>County</Label>
              <Input value={formData.propertyCounty} onChange={(e) => update("propertyCounty", e.target.value)} placeholder="Fulton" />
            </div>
            <div className="space-y-2">
              <Label>Estimated Property Value *</Label>
              <Input type="number" value={formData.propertyValue} onChange={(e) => update("propertyValue", e.target.value)} placeholder="350000" />
            </div>
          </div>

          <fieldset className="border rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold">Property Details</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Usage *</Label>
                <Select value={formData.propertyUsageType} onValueChange={(v) => update("propertyUsageType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Investment">Investment (DSCR)</SelectItem>
                    <SelectItem value="PrimaryResidence">Primary Residence</SelectItem>
                    <SelectItem value="SecondHome">Second Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Current Occupancy</Label>
                <Select value={formData.currentOccupancy} onValueChange={(v) => update("currentOccupancy", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Owner">Owner-Occupied</SelectItem>
                    <SelectItem value="Tenant">Tenant-Occupied</SelectItem>
                    <SelectItem value="Vacant">Vacant</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Units *</Label>
                <Select value={String(formData.financedUnitCount)} onValueChange={(v) => update("financedUnitCount", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (SFR)</SelectItem>
                    <SelectItem value="2">2 (Duplex)</SelectItem>
                    <SelectItem value="3">3 (Triplex)</SelectItem>
                    <SelectItem value="4">4 (Fourplex)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Year Built *</Label>
                <Input type="number" value={formData.yearBuilt} onChange={(e) => update("yearBuilt", e.target.value)} placeholder="1998" />
              </div>
              <div className="space-y-2">
                <Label>Sq Ft *</Label>
                <Input type="number" value={formData.grossLivingAreaSqft} onChange={(e) => update("grossLivingAreaSqft", e.target.value)} placeholder="1800" />
              </div>
              <div className="space-y-2">
                <Label>Acreage</Label>
                <Input type="number" step="0.01" value={formData.acreage} onChange={(e) => update("acreage", e.target.value)} placeholder="0.25" />
              </div>
              <div className="space-y-2">
                <Label>Attachment</Label>
                <Select value={formData.attachmentType} onValueChange={(v) => update("attachmentType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Detached">Detached</SelectItem>
                    <SelectItem value="Attached">Attached</SelectItem>
                    <SelectItem value="SemiDetached">Semi-Detached</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.isPUD} onChange={(e) => update("isPUD", e.target.checked)} /> Property is a PUD
            </label>
          </fieldset>

          {formData.propertyUsageType === "Investment" && (
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="px-2 text-sm font-semibold">Rental Income (DSCR)</legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Gross Monthly Rent *</Label>
                  <Input type="number" value={formData.rentalGrossMonthly} onChange={(e) => update("rentalGrossMonthly", e.target.value)} placeholder="2400" />
                </div>
                <div className="space-y-2">
                  <Label>Occupancy %</Label>
                  <Input type="number" value={formData.rentalOccupancyPct} onChange={(e) => update("rentalOccupancyPct", e.target.value)} placeholder="95" />
                </div>
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.isTenantOccupied} onChange={(e) => update("isTenantOccupied", e.target.checked)} /> Tenant-occupied
                  </label>
                </div>
              </div>
              {formData.isTenantOccupied && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Actual Lease Rent (monthly)</Label>
                    <Input type="number" value={formData.leaseRentMonthly} onChange={(e) => update("leaseRentMonthly", e.target.value)} placeholder="2400" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lease Expiration Date</Label>
                    <Input type="date" value={formData.leaseExpirationDate} onChange={(e) => update("leaseExpirationDate", e.target.value)} />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formData.isShortTermRental} onChange={(e) => update("isShortTermRental", e.target.checked)} /> Short-term rental (Airbnb / VRBO)
              </label>
            </fieldset>
          )}

          <fieldset className="border rounded-lg p-4 space-y-4">
            <legend className="px-2 text-sm font-semibold">Property Expenses (PITIA)</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Annual Property Tax</Label>
                <Input type="number" value={formData.annualPropertyTax} onChange={(e) => update("annualPropertyTax", e.target.value)} placeholder="3600" />
              </div>
              <div className="space-y-2">
                <Label>Hazard Insurance (monthly)</Label>
                <Input type="number" value={formData.hazardInsuranceMonthly} onChange={(e) => update("hazardInsuranceMonthly", e.target.value)} placeholder="120" />
              </div>
              <div className="space-y-2">
                <Label>HOA (monthly)</Label>
                <Input type="number" value={formData.hoaMonthly} onChange={(e) => update("hoaMonthly", e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Flood Insurance (monthly)</Label>
                <Input type="number" value={formData.floodInsuranceMonthly} onChange={(e) => update("floodInsuranceMonthly", e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Property Management Fee (monthly)</Label>
                <Input type="number" value={formData.propertyMgmtFeeMonthly} onChange={(e) => update("propertyMgmtFeeMonthly", e.target.value)} placeholder="0" />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-between pt-4">
            <Button onClick={onPrevious} variant="outline" className="px-8"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={onNext} disabled={!valid} className="px-8">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
