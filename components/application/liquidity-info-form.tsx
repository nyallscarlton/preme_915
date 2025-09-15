"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, ArrowRight } from "lucide-react"

interface LiquidityInfoFormProps {
  onNext: () => void
  onPrevious: () => void
  onDataChange: (data: any) => void
  initialData: any
}

export function LiquidityInfoForm({ onNext, onPrevious, onDataChange, initialData }: LiquidityInfoFormProps) {
  const [formData, setFormData] = useState({
    cashReserves: initialData.cashReserves || "",
    investmentAccounts: initialData.investmentAccounts || "",
    retirementAccounts: initialData.retirementAccounts || "",
    otherAssets: initialData.otherAssets || "",
    ...initialData,
  })

  const handleInputChange = (field: string, value: string) => {
    const updatedData = { ...formData, [field]: value }
    setFormData(updatedData)
    onDataChange(updatedData)
  }

  const totalLiquidity = [
    formData.cashReserves,
    formData.investmentAccounts,
    formData.retirementAccounts,
    formData.otherAssets,
  ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0)

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">Liquidity & Assets</CardTitle>
          <CardDescription className="text-muted-foreground">
            Tell us about your available assets and reserves
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cashReserves" className="text-foreground">
                Cash Reserves
              </Label>
              <Input
                id="cashReserves"
                type="number"
                placeholder="50000"
                value={formData.cashReserves}
                onChange={(e) => handleInputChange("cashReserves", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Checking, savings, money market accounts</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="investmentAccounts" className="text-foreground">
                Investment Accounts
              </Label>
              <Input
                id="investmentAccounts"
                type="number"
                placeholder="100000"
                value={formData.investmentAccounts}
                onChange={(e) => handleInputChange("investmentAccounts", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Stocks, bonds, mutual funds, brokerage accounts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="retirementAccounts" className="text-foreground">
                Retirement Accounts
              </Label>
              <Input
                id="retirementAccounts"
                type="number"
                placeholder="200000"
                value={formData.retirementAccounts}
                onChange={(e) => handleInputChange("retirementAccounts", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">401(k), IRA, pension funds</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherAssets" className="text-foreground">
                Other Assets
              </Label>
              <Input
                id="otherAssets"
                type="number"
                placeholder="25000"
                value={formData.otherAssets}
                onChange={(e) => handleInputChange("otherAssets", e.target.value)}
                className="bg-input border-border text-foreground focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">Real estate, vehicles, collectibles, etc.</p>
            </div>
          </div>

          {totalLiquidity > 0 && (
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground">Total Liquidity:</span>
                <span className="text-primary font-bold text-lg">${totalLiquidity.toLocaleString()}</span>
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
