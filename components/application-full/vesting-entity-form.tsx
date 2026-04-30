"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Shield, Building2 } from "lucide-react"

interface VestingEntityFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function VestingEntityForm({ onNext, onPrevious, onDataChange, initialData }: VestingEntityFormProps) {
  const [formData, setFormData] = useState({
    vestingType: initialData.vestingType || "Individual",
    entityLegalName: initialData.entityLegalName || "",
    entityOrgType: initialData.entityOrgType || "LLC",
    entityStateOfFormation: initialData.entityStateOfFormation || "",
    entityFormationDate: initialData.entityFormationDate || "",
    entityEIN: initialData.entityEIN || "",
    entityAddress: initialData.entityAddress || "",
    entityCity: initialData.entityCity || "",
    entityState: initialData.entityState || "",
    entityZip: initialData.entityZip || "",
    ...initialData,
  })

  const update = (f: string, v: string) => {
    const next = { ...formData, [f]: v }
    setFormData(next)
    onDataChange(next)
  }

  const isEntity = formData.vestingType === "Entity"
  const valid = !isEntity || (formData.entityLegalName && formData.entityOrgType && formData.entityEIN && formData.entityStateOfFormation)

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />Vesting & Entity</CardTitle>
          <CardDescription>Most DSCR loans are vested in an LLC. Tell us how you'll hold title.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>How will you take title? *</Label>
            <Select value={formData.vestingType} onValueChange={(v) => update("vestingType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Individual">Individual (in my personal name)</SelectItem>
                <SelectItem value="Entity">Entity (LLC / Corporation / Trust)</SelectItem>
                <SelectItem value="JointTenants">Joint Tenants</SelectItem>
                <SelectItem value="TenantsInCommon">Tenants in Common</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isEntity && (
            <fieldset className="border rounded-lg p-4 space-y-4">
              <legend className="px-2 text-sm font-semibold">Entity Details</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Legal Entity Name *</Label>
                  <Input value={formData.entityLegalName} onChange={(e) => update("entityLegalName", e.target.value)} placeholder="Tester Holdings LLC" />
                </div>
                <div className="space-y-2">
                  <Label>Organization Type *</Label>
                  <Select value={formData.entityOrgType} onValueChange={(v) => update("entityOrgType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LLC">LLC</SelectItem>
                      <SelectItem value="Corporation">Corporation</SelectItem>
                      <SelectItem value="Partnership">Partnership</SelectItem>
                      <SelectItem value="Trust">Trust</SelectItem>
                      <SelectItem value="SoleProprietorship">Sole Proprietorship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>State of Formation *</Label>
                  <Input value={formData.entityStateOfFormation} onChange={(e) => update("entityStateOfFormation", e.target.value)} maxLength={2} placeholder="GA" />
                </div>
                <div className="space-y-2">
                  <Label>Formation Date</Label>
                  <Input type="date" value={formData.entityFormationDate} onChange={(e) => update("entityFormationDate", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">EIN * <Shield className="h-3 w-3 text-primary" /></Label>
                  <Input value={formData.entityEIN} onChange={(e) => update("entityEIN", e.target.value)} placeholder="XX-XXXXXXX" maxLength={10} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Entity Registered Address</Label>
                <Input value={formData.entityAddress} onChange={(e) => update("entityAddress", e.target.value)} placeholder="200 Peachtree NE" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={formData.entityCity} onChange={(e) => update("entityCity", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={formData.entityState} onChange={(e) => update("entityState", e.target.value)} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Zip</Label>
                  <Input value={formData.entityZip} onChange={(e) => update("entityZip", e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">EIN is encrypted at rest (AES-256 via Supabase Vault key). You'll personally guarantee the loan on the next step.</p>
            </fieldset>
          )}

          <div className="flex justify-between pt-4">
            <Button onClick={onPrevious} variant="outline" className="px-8"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={onNext} disabled={!valid} className="px-8">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
