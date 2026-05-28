/**
 * preme.contact_state — canonical per-contact qualifying facts
 *
 * Single source of truth for facts Riley learns across voice and SMS.
 * All write sources (voice, sms, application) route through here.
 * Both agents (voice inbound-context + SMS getOrCreateRileyChat) read here.
 *
 * Conversational facts only — NOT underwriting detail (rental income, unit counts,
 * occupancy, etc. live in loan_applications / URLA forms, not here).
 *
 * M1: credit_range (3-system). M2: property_type (2-system). M3: loan_purpose (2-system).
 * M4: loan_type, property_address, loan_amount, timeline, name, email — COMPLETE.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { findContactByPhone, patchContactCustomFields, updateContactEmail } from "@/lib/ghl-client"

export type ContactStateChannel = "sms" | "voice" | "application"

export interface ContactState {
  phone: string
  // M1
  credit_range: string | null
  credit_range_updated_at: string | null
  credit_range_updated_channel: ContactStateChannel | null
  // M2
  property_type: string | null
  property_type_updated_at: string | null
  property_type_updated_channel: ContactStateChannel | null
  // M3
  loan_purpose: string | null
  loan_purpose_updated_at: string | null
  loan_purpose_updated_channel: ContactStateChannel | null
  // M4
  loan_type: string | null
  loan_type_updated_at: string | null
  loan_type_updated_channel: ContactStateChannel | null
  property_address: string | null
  property_address_updated_at: string | null
  property_address_updated_channel: ContactStateChannel | null
  loan_amount: number | null
  loan_amount_updated_at: string | null
  loan_amount_updated_channel: ContactStateChannel | null
  timeline: string | null
  timeline_updated_at: string | null
  timeline_updated_channel: ContactStateChannel | null
  first_name: string | null
  first_name_updated_at: string | null
  first_name_updated_channel: ContactStateChannel | null
  last_name: string | null
  last_name_updated_at: string | null
  last_name_updated_channel: ContactStateChannel | null
  email: string | null
  email_updated_at: string | null
  email_updated_channel: ContactStateChannel | null
}

const ALL_COLUMNS = [
  "phone",
  "credit_range", "credit_range_updated_at", "credit_range_updated_channel",
  "property_type", "property_type_updated_at", "property_type_updated_channel",
  "loan_purpose", "loan_purpose_updated_at", "loan_purpose_updated_channel",
  "loan_type", "loan_type_updated_at", "loan_type_updated_channel",
  "property_address", "property_address_updated_at", "property_address_updated_channel",
  "loan_amount", "loan_amount_updated_at", "loan_amount_updated_channel",
  "timeline", "timeline_updated_at", "timeline_updated_channel",
  "first_name", "first_name_updated_at", "first_name_updated_channel",
  "last_name", "last_name_updated_at", "last_name_updated_channel",
  "email", "email_updated_at", "email_updated_channel",
].join(", ")

/** Read full contact_state for a phone number. Returns null if not found or on error. */
export async function readContactState(phone: string): Promise<ContactState | null> {
  if (!phone) return null
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from("contact_state")
      .select(ALL_COLUMNS)
      .eq("phone", phone)
      .maybeSingle()
    return data ? (data as unknown as ContactState) : null
  } catch {
    return null
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function digits10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10)
}

function ts(): string {
  return new Date().toISOString()
}

// ─── M1: credit_range ──────────────────────────────────────────────────────

/**
 * 3-system: contact_state + loan_applications.credit_score_range + GHL credit_range_from_riley.
 * Never throws.
 */
export async function upsertCreditRange(
  phone: string,
  creditRange: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !creditRange) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, credit_range: creditRange, credit_range_updated_at: ts(), credit_range_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ credit_score_range: creditRange }).ilike("applicant_phone", `%${d}`)
    }
    const ghlContact = await findContactByPhone(phone).catch(() => null)
    if (ghlContact?.id) {
      patchContactCustomFields(ghlContact.id, { credit_range_from_riley: creditRange }).catch(() => {})
    }
  } catch { /* Non-fatal */ }
}

// ─── M2: property_type ─────────────────────────────────────────────────────

/**
 * 2-system: contact_state + loan_applications.property_type.
 * No GHL — confirmed stale by dashboard audit 2026-05-27.
 * Never throws.
 */
export async function upsertPropertyType(
  phone: string,
  propertyType: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !propertyType) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, property_type: propertyType, property_type_updated_at: ts(), property_type_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ property_type: propertyType }).ilike("applicant_phone", `%${d}`)
    }
  } catch { /* Non-fatal */ }
}

// ─── M3: loan_purpose ──────────────────────────────────────────────────────

/**
 * 2-system: contact_state + loan_applications.loan_purpose (URLA/MISMO/Fannie/pre-fill).
 * No GHL. Never throws.
 */
export async function upsertLoanPurpose(
  phone: string,
  loanPurpose: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !loanPurpose) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, loan_purpose: loanPurpose, loan_purpose_updated_at: ts(), loan_purpose_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ loan_purpose: loanPurpose }).ilike("applicant_phone", `%${d}`)
    }
  } catch { /* Non-fatal */ }
}

// ─── M4: loan_type ─────────────────────────────────────────────────────────

/**
 * 2-system: contact_state + loan_applications.loan_type.
 * No GHL — confirmed stale by dashboard audit 2026-05-28.
 * loan_type ≠ loan_purpose — these are distinct facts. Never throws.
 */
export async function upsertLoanType(
  phone: string,
  loanType: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !loanType) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, loan_type: loanType, loan_type_updated_at: ts(), loan_type_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ loan_type: loanType }).ilike("applicant_phone", `%${d}`)
    }
  } catch { /* Non-fatal */ }
}

// ─── M4: property_address ──────────────────────────────────────────────────

/**
 * 2-system: contact_state + loan_applications.property_address (URLA/MISMO/Fannie/pre-fill).
 * No GHL. Never throws.
 */
export async function upsertPropertyAddress(
  phone: string,
  address: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !address) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, property_address: address, property_address_updated_at: ts(), property_address_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ property_address: address }).ilike("applicant_phone", `%${d}`)
    }
  } catch { /* Non-fatal */ }
}

// ─── M4: loan_amount ───────────────────────────────────────────────────────

/**
 * 2-system: contact_state + loan_applications.loan_amount.
 * MISMO uses note_amount ?? loan_amount — gateway writes loan_amount, ?? fallback still resolves.
 * No GHL. Never throws.
 */
export async function upsertLoanAmount(
  phone: string,
  amount: number,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !amount || isNaN(amount)) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, loan_amount: amount, loan_amount_updated_at: ts(), loan_amount_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ loan_amount: amount }).ilike("applicant_phone", `%${d}`)
    }
  } catch { /* Non-fatal */ }
}

// ─── M4: timeline ──────────────────────────────────────────────────────────

/**
 * 2-system: contact_state + loan_applications.timeline (display only — no doc readers).
 * No GHL custom field (pre-qual already writes timeline to GHL native contact via ALLOWED_FIELDS).
 * Closes the gap where voice call_analyzed and create-lead-and-text were discarding timeline.
 * Never throws.
 */
export async function upsertTimeline(
  phone: string,
  timeline: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !timeline) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, timeline, timeline_updated_at: ts(), timeline_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ timeline }).ilike("applicant_phone", `%${d}`)
    }
  } catch { /* Non-fatal */ }
}

// ─── M4: name ──────────────────────────────────────────────────────────────

/**
 * 3-system: contact_state + loan_applications (applicant_first_name, applicant_last_name,
 * AND legacy applicant_name full-string so split and legacy never drift) + leads (first_name, last_name).
 * No GHL mirror — name is contact-creation data, not a conversational update.
 * Never throws.
 */
export async function upsertName(
  phone: string,
  firstName: string,
  lastName: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || (!firstName && !lastName)) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    const now = ts()
    const csUpdate: Record<string, unknown> = { phone }
    if (firstName) { csUpdate.first_name = firstName; csUpdate.first_name_updated_at = now; csUpdate.first_name_updated_channel = channel }
    if (lastName) { csUpdate.last_name = lastName; csUpdate.last_name_updated_at = now; csUpdate.last_name_updated_channel = channel }
    await sb.from("contact_state").upsert(csUpdate, { onConflict: "phone" })

    if (d.length === 10) {
      const appUpdate: Record<string, unknown> = {}
      if (firstName) appUpdate.applicant_first_name = firstName
      if (lastName) appUpdate.applicant_last_name = lastName
      if (firstName || lastName) {
        // Keep legacy full-string in sync so URLA fallback (applicant_name) never drifts
        const { data: existing } = await sb.from("loan_applications")
          .select("applicant_first_name, applicant_last_name")
          .ilike("applicant_phone", `%${d}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        const f = firstName || existing?.applicant_first_name || ""
        const l = lastName || existing?.applicant_last_name || ""
        appUpdate.applicant_name = `${f} ${l}`.trim()
      }
      if (Object.keys(appUpdate).length > 0) {
        await sb.from("loan_applications").update(appUpdate).ilike("applicant_phone", `%${d}`)
      }
      // leads table has first_name + last_name
      const leadsUpdate: Record<string, unknown> = {}
      if (firstName) leadsUpdate.first_name = firstName
      if (lastName) leadsUpdate.last_name = lastName
      if (Object.keys(leadsUpdate).length > 0) {
        await sb.from("leads").update(leadsUpdate).ilike("phone", `%${d}`)
      }
    }
  } catch { /* Non-fatal */ }
}

// ─── M4: email ─────────────────────────────────────────────────────────────

/**
 * 3-system: contact_state + loan_applications.applicant_email + leads.email
 * + GHL native contact field (email) — confirmed-values only, fire-and-forget.
 * Placeholder emails (@placeholder.preme) are skipped — never overwrite GHL with synthetic data.
 * Never throws.
 */
export async function upsertEmail(
  phone: string,
  email: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !email || email.includes("@placeholder.preme")) return
  try {
    const sb = createAdminClient()
    const d = digits10(phone)
    await sb.from("contact_state").upsert(
      { phone, email, email_updated_at: ts(), email_updated_channel: channel },
      { onConflict: "phone" },
    )
    if (d.length === 10) {
      await sb.from("loan_applications").update({ applicant_email: email }).ilike("applicant_phone", `%${d}`)
      await sb.from("leads").update({ email }).ilike("phone", `%${d}`)
    }
    // GHL native contact email mirror — fire-and-forget, confirmed values only
    const ghlContact = await findContactByPhone(phone).catch(() => null)
    if (ghlContact?.id) {
      updateContactEmail(ghlContact.id, email).catch(() => {})
    }
  } catch { /* Non-fatal */ }
}
