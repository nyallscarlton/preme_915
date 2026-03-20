"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MessageSquare,
  Mail,
  Loader2,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "lucide-react"

interface Lead {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  loan_type: string | null
  loan_amount: number | null
  message: string | null
  qualification_data: Record<string, any> | null
}

interface SendApplicationModalProps {
  lead: Lead
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: () => void
}

const LOAN_TYPES = [
  { value: "dscr", label: "DSCR" },
  { value: "bridge", label: "Bridge" },
  { value: "fix_and_flip", label: "Fix & Flip" },
  { value: "commercial", label: "Commercial" },
  { value: "business_credit", label: "Business Credit" },
  { value: "other", label: "Other" },
]

const LOAN_PURPOSES = [
  { value: "purchase", label: "Purchase" },
  { value: "refinance", label: "Refinance" },
  { value: "cash-out", label: "Cash-Out" },
  { value: "renovation", label: "Renovation" },
  { value: "bridge", label: "Bridge" },
]

const PROPERTY_TYPES = [
  { value: "single-family", label: "Single-Family" },
  { value: "multi-family", label: "Multi-Family" },
  { value: "townhouse", label: "Townhouse" },
  { value: "condo", label: "Condo" },
  { value: "commercial", label: "Commercial" },
  { value: "mixed-use", label: "Mixed-Use" },
]

const CREDIT_RANGES = [
  { value: "below_600", label: "Below 600" },
  { value: "600-639", label: "600-639" },
  { value: "640-679", label: "640-679" },
  { value: "680-719", label: "680-719" },
  { value: "720-759", label: "720-759" },
  { value: "760+", label: "760+" },
  { value: "800+", label: "800+" },
]

type Step = "form" | "preview" | "success"

export function SendApplicationModal({
  lead,
  open,
  onOpenChange,
  onSent,
}: SendApplicationModalProps) {
  const [step, setStep] = useState<Step>("form")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Form state pre-populated from lead
  const [firstName, setFirstName] = useState(lead.first_name || "")
  const [lastName, setLastName] = useState(lead.last_name || "")
  const [email, setEmail] = useState(lead.email || "")
  const [phone, setPhone] = useState(lead.phone || "")
  const [loanType, setLoanType] = useState(lead.loan_type || "")
  const [loanPurpose, setLoanPurpose] = useState("")
  const [loanAmount, setLoanAmount] = useState(lead.loan_amount?.toString() || "")
  const [propertyAddress, setPropertyAddress] = useState(
    lead.qualification_data?.property_address || ""
  )
  const [propertyType, setPropertyType] = useState(
    lead.qualification_data?.property_type || ""
  )
  const [propertyValue, setPropertyValue] = useState(
    lead.qualification_data?.property_value?.toString() || ""
  )
  const [creditScoreRange, setCreditScoreRange] = useState(
    lead.qualification_data?.credit_score_range || ""
  )
  const [borrowerNote, setBorrowerNote] = useState("")

  // Delivery method chosen in preview step
  const [deliveryMethod, setDeliveryMethod] = useState<"sms" | "email" | null>(null)

  // Success state
  const [result, setResult] = useState<{
    application_number: string
    application_url: string
    delivery_method: string
    delivery_success: boolean
    delivery_error: string | null
  } | null>(null)

  const handleSend = async (method: "sms" | "email") => {
    setDeliveryMethod(method)
    setSending(true)
    setError(null)

    try {
      const res = await fetch(`/api/leads/${lead.id}/send-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          loan_type: loanType,
          loan_purpose: loanPurpose,
          loan_amount: loanAmount ? parseFloat(loanAmount) : null,
          property_address: propertyAddress,
          property_type: propertyType,
          property_value: propertyValue ? parseFloat(propertyValue) : null,
          credit_score_range: creditScoreRange,
          borrower_note: borrowerNote,
          delivery_method: method,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send application")
      }

      setResult(data)
      setStep("success")
      onSent?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send application")
    } finally {
      setSending(false)
    }
  }

  const handleCopyLink = () => {
    if (result?.application_url) {
      navigator.clipboard.writeText(result.application_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset after animation
    setTimeout(() => {
      setStep("form")
      setError(null)
      setResult(null)
      setDeliveryMethod(null)
      setCopied(false)
    }, 200)
  }

  const smsPreview = `Hey ${firstName || "there"}, here's your pre-filled loan application from Preme Home Loans. Review and submit when ready: [link]${borrowerNote ? ` Note from your loan officer: "${borrowerNote}"` : ""} -- Reply STOP to opt out`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === "form" && "Send Application"}
            {step === "preview" && "Preview & Send"}
            {step === "success" && "Application Sent"}
          </DialogTitle>
          <DialogDescription>
            {step === "form" &&
              `Pre-fill and send a loan application to ${firstName} ${lastName}`}
            {step === "preview" && "Review the message before sending"}
            {step === "success" && "The application link has been delivered"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Form */}
        {step === "form" && (
          <div className="space-y-5 mt-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">First Name</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>

            {/* Contact row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-border"
                  placeholder="borrower@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-background border-border"
                  placeholder="(470) 555-1234"
                />
              </div>
            </div>

            {/* Loan Type & Purpose */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Loan Type</Label>
                <Select value={loanType} onValueChange={setLoanType}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Loan Purpose</Label>
                <Select value={loanPurpose} onValueChange={setLoanPurpose}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_PURPOSES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loan Amount */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Loan Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  className="bg-background border-border pl-7"
                  placeholder="250,000"
                />
              </div>
            </div>

            {/* Property Address */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Property Address</Label>
              <Input
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                className="bg-background border-border"
                placeholder="123 Main St, Atlanta, GA 30301"
              />
            </div>

            {/* Property Type & Value */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Property Type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Property Value</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    value={propertyValue}
                    onChange={(e) => setPropertyValue(e.target.value)}
                    className="bg-background border-border pl-7"
                    placeholder="300,000"
                  />
                </div>
              </div>
            </div>

            {/* Credit Score */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Credit Score Range</Label>
              <Select value={creditScoreRange} onValueChange={setCreditScoreRange}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Personal Note */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Note for Borrower{" "}
                <span className="text-muted-foreground/60">(optional -- shown in message)</span>
              </Label>
              <Textarea
                value={borrowerNote}
                onChange={(e) => setBorrowerNote(e.target.value)}
                className="bg-background border-border min-h-[70px] text-sm"
                placeholder="e.g. Great speaking with you! Let me know if you have any questions."
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Preview & Send buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                onClick={() => handleSend("sms")}
                disabled={sending || !phone}
              >
                {sending && deliveryMethod === "sms" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                Send via Text
              </Button>
              <Button
                className="flex-1 bg-[#997100] hover:bg-[#b8850a] text-black font-semibold"
                onClick={() => handleSend("email")}
                disabled={sending || !email}
              >
                {sending && deliveryMethod === "email" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Send via Email
              </Button>
            </div>

            {/* SMS Preview */}
            {phone && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                  SMS Preview
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{smsPreview}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Success */}
        {step === "success" && result && (
          <div className="space-y-6 mt-4">
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/50 border border-emerald-700 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Application Created & Sent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sent via {result.delivery_method === "sms" ? "text message" : "email"} to{" "}
                {result.delivery_method === "sms" ? phone : email}
              </p>
              {!result.delivery_success && result.delivery_error && (
                <p className="text-sm text-yellow-500 mt-2">
                  Warning: Delivery may have failed ({result.delivery_error}). The application was
                  still created -- you can copy the link below.
                </p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Application Number</span>
                <span className="text-sm font-mono text-foreground">
                  {result.application_number}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Delivery</span>
                <span className="text-sm text-foreground capitalize">
                  {result.delivery_method === "sms" ? "Text Message" : "Email"}
                  {result.delivery_success ? " (Sent)" : " (Pending)"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Application Link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={result.application_url}
                  className="bg-background border-border text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted bg-transparent shrink-0"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted bg-transparent shrink-0"
                  asChild
                >
                  <a href={result.application_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-[#997100] hover:bg-[#b8850a] text-black font-semibold"
              onClick={handleClose}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
