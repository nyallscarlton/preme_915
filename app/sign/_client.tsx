"use client"

/**
 * DocuSign-style 1003: the application rendered as a single document —
 * every field prefilled from what we already know, inline-editable,
 * signature block at the bottom, one submit.
 *
 * Reached from the texted link (/sign?token=<guest_token>) or by a
 * signed-in borrower (/sign?app=<id>).
 */

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, Lock } from "lucide-react"
import { ESignBlock } from "@/components/application/esign-block"

// ── document-styled inputs ────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
  error = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  className?: string
  error?: boolean
}) {
  return (
    <label className={`block ${className}`} data-field-error={error || undefined}>
      <span className={`block text-[10px] font-medium uppercase tracking-wide ${error ? "text-red-600" : "text-gray-500"}`}>
        {label}{error ? " — required" : ""}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border-0 border-b bg-transparent px-0 py-1 text-sm text-gray-900 focus:outline-none focus:ring-0 ${error ? "border-red-500 focus:border-red-500" : "border-gray-300 focus:border-[#997100]"}`}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-0 border-b border-gray-300 bg-transparent px-0 py-1 text-sm text-gray-900 focus:border-[#997100] focus:outline-none focus:ring-0"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </label>
  )
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2">
      <span className="text-sm text-gray-800">{label}</span>
      <div className="flex shrink-0 gap-3 text-sm">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`rounded px-2.5 py-0.5 text-xs font-medium ${
              value === v ? "bg-[#997100] text-white" : "border border-gray-300 text-gray-500 hover:border-gray-400"
            }`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 mb-3 bg-[#f4ead2] px-3 py-1.5 text-sm font-semibold text-gray-900">
      {children}
    </div>
  )
}

const DECLARATIONS: { key: string; label: string }[] = [
  { key: "outstanding_judgments", label: "Are there any outstanding judgments against you?" },
  { key: "presently_delinquent_federal_debt", label: "Are you presently delinquent or in default on any federal debt?" },
  { key: "party_to_lawsuit", label: "Are you a party to a lawsuit in which you potentially have any personal financial liability?" },
  { key: "bankruptcy", label: "Have you declared bankruptcy within the past 7 years?" },
  { key: "prior_foreclosure", label: "Have you had property foreclosed upon in the last 7 years?" },
  { key: "prior_deed_in_lieu", label: "Have you conveyed title to any property in lieu of foreclosure in the past 7 years?" },
  { key: "prior_short_sale", label: "Have you completed a pre-foreclosure or short sale in the past 7 years?" },
  { key: "undisclosed_borrowed_funds", label: "Are you borrowing any money for this transaction not disclosed on this application?" },
  { key: "undisclosed_mortgage_application", label: "Have you applied for a mortgage on another property not disclosed here?" },
  { key: "undisclosed_comaker", label: "Are you a co-signer or guarantor on any debt not disclosed here?" },
]

export default function SignDocumentClient() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const appParam = searchParams.get("app")

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [guestToken, setGuestToken] = useState<string | null>(null)
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null)
  const [f, setF] = useState<Record<string, any>>({})
  const [decl, setDecl] = useState<Record<string, boolean | null>>(
    Object.fromEntries(DECLARATIONS.map((d) => [d.key, null]))
  )
  const [esign, setEsign] = useState<{ esignName: string; esignImage: string | null; esignConsent: boolean }>({
    esignName: "",
    esignImage: null,
    esignConsent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [missingKeys, setMissingKeys] = useState<string[]>([])

  const set = (k: string) => (v: string) => setF((prev) => ({ ...prev, [k]: v }))

  const formatSsn = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 9)
    if (d.length > 5) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
    if (d.length > 3) return `${d.slice(0, 3)}-${d.slice(3)}`
    return d
  }

  // Mirrors the server's required-for-submit list — validate here first so
  // the borrower sees exactly what's missing before anything is sent
  const REQUIRED: { key: string; label: string }[] = [
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "ssn", label: "Social Security No." },
    { key: "dateOfBirth", label: "Date of Birth" },
    { key: "propertyAddress", label: "Property Street Address" },
    { key: "loanAmount", label: "Loan Amount" },
  ]
  const g = (k: string) => (f[k] == null ? "" : String(f[k]))

  useEffect(() => {
    const load = async () => {
      try {
        const q = token
          ? `token=${encodeURIComponent(token)}`
          : appParam
            ? `app=${encodeURIComponent(appParam)}`
            : ""
        const res = await fetch(`/api/guest/verify-token${q ? `?${q}` : ""}`)
        const data = await res.json()
        if (!data.ok || !data.application) {
          setLoadError("This link is invalid or has expired. Text us at (470) 942-5787 and we'll send a fresh one.")
          return
        }
        const app = data.application
        setF({
          ...app,
          email: app.email && !app.email.endsWith("@placeholder.preme") ? app.email : "",
        })
        // Declarations arrive as flat decl_<key> booleans
        setDecl((prev) => {
          const next = { ...prev }
          for (const k of Object.keys(prev)) {
            const v = app[`decl_${k}`]
            if (typeof v === "boolean") next[k] = v
          }
          return next
        })
        setApplicationId(app.applicationId)
        setGuestToken(app.guestToken)
        setApplicationNumber(app.applicationNumber)
      } catch {
        setLoadError("Something went wrong loading your application. Text us at (470) 942-5787.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, appParam])

  const esignComplete = !!(esign.esignName.trim() && esign.esignImage && esign.esignConsent)

  const handleSubmit = async () => {
    if (!applicationId) return

    // Client-side check first — name exactly what's missing and jump to it
    const missing = REQUIRED.filter(({ key }) => {
      const v = f[key]
      return v === null || v === undefined || String(v).trim() === "" || Number(v) === 0 && key === "loanAmount"
    })
    setMissingKeys(missing.map((m) => m.key))
    if (missing.length > 0) {
      setSubmitError(`Please complete: ${missing.map((m) => m.label).join(", ")}`)
      setTimeout(() => document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const n = (v: any) => (v === "" || v == null ? null : Number(v))
      const s = (v: any) => (v === "" || v == null ? null : String(v))
      const payload: Record<string, unknown> = {
        applicant_email: f.email || "",
        applicant_name: `${f.firstName || ""} ${f.lastName || ""}`.trim(),
        applicant_phone: f.phone || "",
        applicant_first_name: s(f.firstName),
        applicant_middle_name: s(f.middleName),
        applicant_last_name: s(f.lastName),
        applicant_dob: s(f.dateOfBirth),
        applicant_ssn: s(f.ssn),
        applicant_citizenship_type: s(f.citizenshipType),
        applicant_marital_status: s(f.maritalStatus),
        contact_address: f.address || "",
        contact_city: f.city || "",
        contact_state: f.state || "",
        contact_zip: f.zipCode || "",
        employer_name: s(f.employerName),
        employment_status: s(f.employmentStatus),

        loan_amount: n(f.loanAmount) ?? 0,
        loan_purpose: s(f.loanPurpose),
        note_amount: n(f.loanAmount) ?? 0,
        loan_term_months: n(f.loanTermMonths) ?? 360,

        property_address: f.propertyAddress || "",
        property_city: f.propertyCity || "",
        property_state: f.propertyState || "",
        property_zip: f.propertyZip || "",
        property_type: f.propertyType || "",
        property_value: n(f.propertyValue) ?? 0,
        purchase_price: n(f.purchasePrice),
        current_mortgage_balance: n(f.currentBalance),
        rental_gross_monthly: n(f.rentalGrossMonthly),

        credit_score_range: s(f.creditScore),

        vesting_type: f.entityLegalName ? "Entity" : "Individual",
        entity_legal_name: s(f.entityLegalName),
        entity_org_type: f.entityLegalName ? f.entityOrgType || "LLC" : null,
        entity_state_of_formation: s(f.entityStateOfFormation),
        entity_ein: s(f.entityEin),

        status: "submitted",
        submitted_at: new Date().toISOString(),

        _declarations: Object.fromEntries(Object.entries(decl).filter(([, v]) => v !== null)),
        _esign: esign,
        ...(guestToken ? { guest_token: guestToken } : {}),
      }

      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        const detail = Array.isArray(result.missing) && result.missing.length
          ? `Please complete: ${result.missing.join(", ")}`
          : result.error || "Submission failed"
        throw new Error(detail)
      }
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#997100]" />
          <p className="text-sm text-gray-500">Preparing your application…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <p className="max-w-md text-center text-gray-600">{loadError}</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <div className="max-w-md text-center">
          <CheckCircle className="mx-auto mb-4 h-14 w-14 text-green-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Signed and submitted</h1>
          <p className="text-gray-600">
            Thanks — we've got your application{applicationNumber ? ` (${applicationNumber})` : ""}. Our team
            reviews it right away and you'll hear from us shortly. Questions in the meantime? Text
            (470) 942-5787.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-200 py-6 sm:py-10">
      <div className="mx-auto max-w-3xl px-3">
        {/* status bar */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-[#c9a34a]" />
            <span>Review, complete, and sign — fields are editable</span>
          </div>
          <span className="hidden font-mono text-xs text-gray-400 sm:block">{applicationNumber}</span>
        </div>

        {/* the document */}
        <div className="rounded-sm bg-white px-5 py-8 shadow-xl sm:px-10">
          <h1 className="text-xl font-bold tracking-wide text-[#997100] sm:text-2xl">
            UNIFORM RESIDENTIAL LOAN APPLICATION
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Preme Home Loans LLC · {applicationNumber} · Verify or correct the information below.
          </p>

          <SectionHeader>SECTION 1 — Borrower Information</SectionHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="First Name" value={g("firstName")} onChange={set("firstName")} error={missingKeys.includes("firstName")} />
            <Field label="Middle Name" value={g("middleName")} onChange={set("middleName")} />
            <Field label="Last Name" value={g("lastName")} onChange={set("lastName")} error={missingKeys.includes("lastName")} />
            <Field label="Date of Birth" type="date" value={g("dateOfBirth")} onChange={set("dateOfBirth")} error={missingKeys.includes("dateOfBirth")} />
            <Field label="Social Security No." value={g("ssn")} onChange={(v) => set("ssn")(formatSsn(v))} placeholder="###-##-####" error={missingKeys.includes("ssn")} />
            <SelectField
              label="Marital Status"
              value={g("maritalStatus")}
              onChange={set("maritalStatus")}
              options={[{ v: "Married", l: "Married" }, { v: "Separated", l: "Separated" }, { v: "Unmarried", l: "Unmarried" }]}
            />
            <Field label="Email" type="email" value={g("email")} onChange={set("email")} className="col-span-2 sm:col-span-1" />
            <Field label="Phone" value={g("phone")} onChange={set("phone")} />
            <SelectField
              label="Citizenship"
              value={g("citizenshipType")}
              onChange={set("citizenshipType")}
              options={[
                { v: "USCitizen", l: "U.S. Citizen" },
                { v: "PermanentResidentAlien", l: "Permanent Resident" },
                { v: "NonPermanentResidentAlien", l: "Non-Permanent Resident" },
              ]}
            />
            <Field label="Current Street Address" value={g("address")} onChange={set("address")} className="col-span-2 sm:col-span-3" />
            <Field label="City" value={g("city")} onChange={set("city")} />
            <Field label="State" value={g("state")} onChange={set("state")} />
            <Field label="ZIP" value={g("zipCode")} onChange={set("zipCode")} />
            <Field label="Employer" value={g("employerName")} onChange={set("employerName")} className="col-span-2" />
            <SelectField
              label="Employment Status"
              value={g("employmentStatus")}
              onChange={set("employmentStatus")}
              options={[
                { v: "employed", l: "Employed" },
                { v: "self-employed", l: "Self-Employed" },
                { v: "retired", l: "Retired" },
                { v: "other", l: "Other" },
              ]}
            />
          </div>

          <SectionHeader>SECTION 2 — Title & Vesting</SectionHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Entity / LLC Legal Name (blank = personal name)" value={g("entityLegalName")} onChange={set("entityLegalName")} className="col-span-2" />
            <Field label="EIN" value={g("entityEin")} onChange={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 9)
              set("entityEin")(digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits)
            }} placeholder="12-3456789" />
            <Field label="State of Formation" value={g("entityStateOfFormation")} onChange={(v) => set("entityStateOfFormation")(v.toUpperCase().slice(0, 2))} />
          </div>

          <SectionHeader>SECTION 3 — Loan & Subject Property</SectionHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Loan Amount ($)" type="number" value={g("loanAmount")} onChange={set("loanAmount")} error={missingKeys.includes("loanAmount")} />
            <SelectField
              label="Loan Purpose"
              value={g("loanPurpose")}
              onChange={set("loanPurpose")}
              options={[
                { v: "purchase", l: "Purchase" },
                { v: "refinance", l: "Refinance" },
                { v: "cash-out-refinance", l: "Cash-Out Refinance" },
                { v: "investment", l: "Investment" },
                { v: "bridge-loan", l: "Bridge Loan" },
                { v: "construction", l: "Construction" },
                { v: "other", l: "Other" },
              ]}
            />
            <Field label="Est. Property Value ($)" type="number" value={g("propertyValue")} onChange={set("propertyValue")} />
            <Field label="Property Street Address" value={g("propertyAddress")} onChange={set("propertyAddress")} className="col-span-2 sm:col-span-3" error={missingKeys.includes("propertyAddress")} />
            <Field label="City" value={g("propertyCity")} onChange={set("propertyCity")} />
            <Field label="State" value={g("propertyState")} onChange={set("propertyState")} />
            <Field label="ZIP" value={g("propertyZip")} onChange={set("propertyZip")} />
            {g("loanPurpose") === "purchase" && (
              <Field label="Purchase Price ($)" type="number" value={g("purchasePrice")} onChange={set("purchasePrice")} />
            )}
            {(g("loanPurpose") === "refinance" || g("loanPurpose") === "cash-out-refinance") && (
              <Field label="Current Mortgage Balance ($)" type="number" value={g("currentBalance")} onChange={set("currentBalance")} />
            )}
            <Field label="Est. Monthly Rent ($)" type="number" value={g("rentalGrossMonthly")} onChange={set("rentalGrossMonthly")} />
            <SelectField
              label="Credit Score (est.)"
              value={g("creditScore")}
              onChange={set("creditScore")}
              options={[
                { v: "800+", l: "Excellent (800+)" },
                { v: "740-799", l: "Very Good (740-799)" },
                { v: "670-739", l: "Good (670-739)" },
                { v: "580-669", l: "Fair (580-669)" },
                { v: "300-579", l: "Poor (300-579)" },
              ]}
            />
          </div>

          <SectionHeader>SECTION 4 — Declarations</SectionHeader>
          <div>
            {DECLARATIONS.map((d) => (
              <YesNo
                key={d.key}
                label={d.label}
                value={decl[d.key]}
                onChange={(v) => setDecl((prev) => ({ ...prev, [d.key]: v }))}
              />
            ))}
          </div>

          <SectionHeader>SECTION 5 — Acknowledgments & Signature</SectionHeader>
          <p className="mb-4 text-xs leading-relaxed text-gray-600">
            Each Borrower certifies that the information provided in this application is true and
            correct to the best of their knowledge. By signing below, you authorize Preme Home Loans
            LLC to verify any information provided and to obtain a consumer credit report.
          </p>

          <ESignBlock
            defaultName={`${g("firstName")} ${g("lastName")}`.trim()}
            onChange={setEsign}
          />

          {submitError && <p className="mt-4 text-sm text-red-600">{submitError}</p>}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !esignComplete}
            className="mt-6 w-full bg-[#997100] py-6 text-base font-semibold text-white hover:bg-[#b8850a]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting…
              </>
            ) : (
              "Sign & Submit Application"
            )}
          </Button>
          {!esignComplete && (
            <p className="mt-2 text-center text-xs text-gray-500">
              Type your name, draw your signature, and check the consent box above to submit.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-500">
          Preme Home Loans LLC · (470) 942-5787 · Your information is transmitted securely and PII is encrypted at rest.
        </p>
      </div>
    </div>
  )
}
