/**
 * POST /api/preme/webhooks/pre-qual-submitted
 *
 * Doc 02.14 §4.2 — Pre-qual submit webhook (CRITICAL path).
 * Source: premerealestate.com pre-qual form on submit.
 * Effect: PATCH GHL contact pre_qual_state = "submitted", add tag pre_qual_submitted,
 *   write form_data to relevant custom fields. GHL Workflow 2 (Submit Handoff)
 *   fires automatically off the tag.
 *
 * Payload: { "contact_id": "<ghl_contact_id>", "form_data": { ... } }
 *
 * form_data keys mapped to GHL custom fields (per Doc 02.4 §3):
 *   property_address, property_state, property_type, estimated_monthly_rent,
 *   loan_amount, purchase_price, credit_range, entity_type, timeline_notes,
 *   timeline (and any other contact.* keys).
 *
 * Idempotent: re-submitting the same form is safe (GHL accepts re-PATCH).
 */
import { NextRequest, NextResponse } from "next/server"
import { addContactTags, patchContactCustomFields, getContact } from "@/lib/ghl-client"
import { isAuthorized } from "../_lib"
import {
  upsertCreditRange, upsertPropertyType, upsertLoanPurpose,
  upsertLoanType, upsertPropertyAddress, upsertLoanAmount,
  upsertTimeline, upsertName, upsertEmail,
} from "@/lib/contact-state"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// Whitelist of form_data keys we'll PATCH to GHL custom fields. Unknown keys ignored.
const ALLOWED_FIELDS = new Set([
  "property_address",
  "property_state",
  "estimated_monthly_rent",
  "loan_amount",
  "purchase_price",
  "entity_type",
  "timeline",
  "timeline_notes",
  "first_name",
  "last_name",
  "email",
])

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: { contact_id?: string; form_data?: Record<string, unknown> }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const contactId = body.contact_id
  if (!contactId || typeof contactId !== "string") {
    return NextResponse.json(
      { ok: false, error: "contact_id (string) required" },
      { status: 400 },
    )
  }

  // Build the custom field map from form_data (filter to allowed keys, coerce to string).
  const fields: Record<string, string | number> = { pre_qual_state: "submitted" }
  if (body.form_data && typeof body.form_data === "object") {
    for (const [k, v] of Object.entries(body.form_data)) {
      if (!ALLOWED_FIELDS.has(k)) continue
      if (v === null || v === undefined) continue
      fields[k] = typeof v === "number" ? v : String(v)
    }
  }

  // PATCH custom fields first.
  const patchRes = await patchContactCustomFields(contactId, fields)
  if (!patchRes.ok) {
    console.error(
      `[preme-webhooks] pre-qual-submitted: PATCH FAIL contact=${contactId}: ${patchRes.error}`,
    )
    return NextResponse.json({ ok: false, error: patchRes.error }, { status: 502 })
  }

  // Then add the pre_qual_submitted tag (drives GHL Workflow 2 trigger).
  const tagRes = await addContactTags(contactId, ["pre_qual_submitted"])
  if (!tagRes.ok) {
    console.error(
      `[preme-webhooks] pre-qual-submitted: tag add FAIL contact=${contactId}: ${tagRes.error}`,
    )
    // Field PATCH succeeded, tag failed — return partial success so caller can retry just the tag.
    return NextResponse.json(
      {
        ok: false,
        partial: true,
        fields_patched: true,
        tag_added: false,
        error: tagRes.error,
      },
      { status: 502 },
    )
  }

  // Write qualifying facts to contact_state (M1-M4 gateways)
  // Look up contact phone once — all upserts key on E.164
  const fd = body.form_data || {}
  const creditRangeValue = fd.credit_range
  const propertyTypeValue = fd.property_type
  const loanPurposeValue = fd.loan_purpose
  const loanTypeValue = fd.loan_type
  const propertyAddressValue = fd.property_address
  const loanAmountValue = fd.loan_amount
  const timelineValue = fd.timeline
  const firstNameValue = fd.first_name
  const lastNameValue = fd.last_name
  const emailValue = fd.email
  const rentValue = fd.estimated_monthly_rent

  const hasAnyFact = creditRangeValue || propertyTypeValue || loanPurposeValue || loanTypeValue ||
    propertyAddressValue || loanAmountValue || timelineValue || firstNameValue || lastNameValue || emailValue

  if (hasAnyFact) {
    const contactRes = await getContact(contactId)
    const contactPhone = contactRes.data?.contact?.phone
    if (contactPhone) {
      const digits = contactPhone.replace(/\D/g, "")
      const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`
      if (creditRangeValue && typeof creditRangeValue === "string") upsertCreditRange(e164, creditRangeValue, "application").catch(() => {})
      if (propertyTypeValue && typeof propertyTypeValue === "string") upsertPropertyType(e164, propertyTypeValue, "application").catch(() => {})
      if (loanPurposeValue && typeof loanPurposeValue === "string") upsertLoanPurpose(e164, loanPurposeValue, "application").catch(() => {})
      if (loanTypeValue && typeof loanTypeValue === "string") upsertLoanType(e164, loanTypeValue, "application").catch(() => {})
      if (propertyAddressValue && typeof propertyAddressValue === "string") upsertPropertyAddress(e164, propertyAddressValue, "application").catch(() => {})
      if (loanAmountValue) { const amt = parseFloat(String(loanAmountValue).replace(/[^0-9.]/g, "")); if (!isNaN(amt)) upsertLoanAmount(e164, amt, "application").catch(() => {}) }
      if (timelineValue && typeof timelineValue === "string") upsertTimeline(e164, timelineValue, "application").catch(() => {})
      if ((firstNameValue || lastNameValue) && (typeof firstNameValue === "string" || typeof lastNameValue === "string")) {
        upsertName(e164, String(firstNameValue || ""), String(lastNameValue || ""), "application").catch(() => {})
      }
      if (emailValue && typeof emailValue === "string" && !emailValue.includes("@placeholder.preme")) {
        upsertEmail(e164, emailValue, "application").catch(() => {})
      }

      // Rent gap: estimated_monthly_rent → loan_applications.rental_gross_monthly
      if (rentValue) {
        const rentAmt = parseFloat(String(rentValue).replace(/[^0-9.]/g, ""))
        if (!isNaN(rentAmt) && rentAmt > 0) {
          const sb = createAdminClient()
          const d = digits.slice(-10)
          if (d.length === 10) {
            sb.from("loan_applications").update({ rental_gross_monthly: rentAmt }).ilike("applicant_phone", `%${d}`).then(() => {}, () => {})
          }
        }
      }
    }
  }

  console.log(
    `[preme-webhooks] pre-qual-submitted: contact=${contactId} state=submitted tag=pre_qual_submitted fields=${Object.keys(fields).length}`,
  )
  return NextResponse.json({
    ok: true,
    contact_id: contactId,
    fields_patched: Object.keys(fields),
    tag_added: "pre_qual_submitted",
  })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/preme/webhooks/pre-qual-submitted",
    method: "POST",
    auth: "Bearer CRON_SECRET or x-internal-auth header",
    payload: { contact_id: "<ghl_contact_id>", form_data: { "...": "..." } },
    effect:
      "PATCH pre_qual_state=submitted + form_data fields, add tag pre_qual_submitted",
    spec: "Doc 02.14 §4.2",
  })
}
