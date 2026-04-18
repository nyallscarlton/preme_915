"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, Plus, Trash2, Home } from "lucide-react"

interface ReoScheduleFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export type ReoRow = {
  address_line1: string
  city: string
  state: string
  postal_code: string
  disposition_status: string
  usage_type: string
  present_market_value: string
  lien_upb_amount: string
  monthly_mortgage_payment: string
  monthly_rental_income_gross: string
  monthly_rental_income_net: string
  monthly_maintenance_expense: string
  unit_count: string
}

const BLANK: ReoRow = {
  address_line1: "",
  city: "",
  state: "",
  postal_code: "",
  disposition_status: "HeldForInvestment",
  usage_type: "Investment",
  present_market_value: "",
  lien_upb_amount: "",
  monthly_mortgage_payment: "",
  monthly_rental_income_gross: "",
  monthly_rental_income_net: "",
  monthly_maintenance_expense: "",
  unit_count: "1",
}

export function ReoScheduleForm({ onNext, onPrevious, onDataChange, initialData }: ReoScheduleFormProps) {
  const initialRows: ReoRow[] = Array.isArray(initialData.reoProperties) && initialData.reoProperties.length > 0 ? initialData.reoProperties : []
  const [rows, setRows] = useState<ReoRow[]>(initialRows)

  const push = () => {
    const next = [...rows, { ...BLANK }]
    setRows(next)
    onDataChange({ reoProperties: next })
  }
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i)
    setRows(next)
    onDataChange({ reoProperties: next })
  }
  const set = (i: number, key: keyof ReoRow, value: string) => {
    const next = rows.map((r, j) => (j === i ? { ...r, [key]: value } : r))
    setRows(next)
    onDataChange({ reoProperties: next })
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Home className="h-6 w-6 text-primary" />Existing Rental Portfolio (REO)</CardTitle>
          <CardDescription>
            List every rental property you own right now. DSCR lenders require this to calculate your portfolio exposure.
            {" "}If you don't own any rentals yet, click <em>Continue</em> — this step is optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
              <p className="mb-3">No rental properties added yet.</p>
              <Button onClick={push} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add a property</Button>
            </div>
          )}

          {rows.map((r, i) => (
            <fieldset key={i} className="border rounded-lg p-4 space-y-3 relative">
              <legend className="px-2 text-sm font-semibold">Property {i + 1}</legend>
              <button onClick={() => remove(i)} className="absolute right-3 top-3 text-muted-foreground hover:text-destructive" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="space-y-2">
                <Label>Street Address</Label>
                <Input value={r.address_line1} onChange={(e) => set(i, "address_line1", e.target.value)} placeholder="123 Rental St" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-2 md:col-span-2"><Label>City</Label><Input value={r.city} onChange={(e) => set(i, "city", e.target.value)} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={r.state} onChange={(e) => set(i, "state", e.target.value)} maxLength={2} /></div>
                <div className="space-y-2"><Label>Zip</Label><Input value={r.postal_code} onChange={(e) => set(i, "postal_code", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={r.disposition_status} onValueChange={(v) => set(i, "disposition_status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HeldForInvestment">Held for Investment</SelectItem>
                      <SelectItem value="Retain">Retain</SelectItem>
                      <SelectItem value="PendingSale">Pending Sale</SelectItem>
                      <SelectItem value="Sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Units</Label>
                  <Input type="number" min={1} max={10} value={r.unit_count} onChange={(e) => set(i, "unit_count", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Present Market Value</Label>
                  <Input type="number" value={r.present_market_value} onChange={(e) => set(i, "present_market_value", e.target.value)} placeholder="310000" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2"><Label>Lien Balance</Label><Input type="number" value={r.lien_upb_amount} onChange={(e) => set(i, "lien_upb_amount", e.target.value)} placeholder="185000" /></div>
                <div className="space-y-2"><Label>Monthly Mortgage</Label><Input type="number" value={r.monthly_mortgage_payment} onChange={(e) => set(i, "monthly_mortgage_payment", e.target.value)} /></div>
                <div className="space-y-2"><Label>Monthly Expenses</Label><Input type="number" value={r.monthly_maintenance_expense} onChange={(e) => set(i, "monthly_maintenance_expense", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Gross Monthly Rent</Label><Input type="number" value={r.monthly_rental_income_gross} onChange={(e) => set(i, "monthly_rental_income_gross", e.target.value)} /></div>
                <div className="space-y-2"><Label>Net Monthly Rent</Label><Input type="number" value={r.monthly_rental_income_net} onChange={(e) => set(i, "monthly_rental_income_net", e.target.value)} /></div>
              </div>
            </fieldset>
          ))}

          {rows.length > 0 && (
            <Button onClick={push} variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add another property</Button>
          )}

          <div className="flex justify-between pt-4">
            <Button onClick={onPrevious} variant="outline" className="px-8"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={onNext} className="px-8">Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
