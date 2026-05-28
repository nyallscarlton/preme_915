/**
 * preme.contact_state — canonical per-contact qualifying facts
 *
 * Single source of truth for facts Riley learns across voice and SMS.
 * All three write sources (voice, sms, application) route through here.
 * Both agents (voice inbound-context + SMS getOrCreateRileyChat) read here.
 *
 * Facts live: credit_range (3-system), property_type (2-system), loan_purpose (2-system).
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { findContactByPhone, patchContactCustomFields } from "@/lib/ghl-client"

export type ContactStateChannel = "sms" | "voice" | "application"

export interface ContactState {
  phone: string
  credit_range: string | null
  credit_range_updated_at: string | null
  credit_range_updated_channel: ContactStateChannel | null
  property_type: string | null
  property_type_updated_at: string | null
  property_type_updated_channel: ContactStateChannel | null
  loan_purpose: string | null
  loan_purpose_updated_at: string | null
  loan_purpose_updated_channel: ContactStateChannel | null
}

/**
 * Upsert credit_range for a phone number.
 *
 * Single write gateway for credit range across all channels.
 * Writes to contact_state (canonical memory) AND mirrors to
 * loan_applications.credit_score_range so pipeline readers
 * (URLA PDF, lender match, pre-fill) always see the same value.
 * One source of truth — contact_state — no drift possible.
 *
 * Never throws — write failures must never block the caller.
 */
export async function upsertCreditRange(
  phone: string,
  creditRange: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !creditRange) return
  try {
    const sb = createAdminClient()
    const digits = phone.replace(/\D/g, "").slice(-10)

    // 1. contact_state — canonical source
    await sb.from("contact_state").upsert(
      {
        phone,
        credit_range: creditRange,
        credit_range_updated_at: new Date().toISOString(),
        credit_range_updated_channel: channel,
      },
      { onConflict: "phone" },
    )

    // 2. loan_applications mirror — keeps URLA, lender match, and pre-fill in sync
    if (digits.length === 10) {
      await sb
        .from("loan_applications")
        .update({ credit_score_range: creditRange })
        .ilike("applicant_phone", `%${digits}`)
    }

    // 3. GHL mirror — contact.credit_range_from_riley (read-only from GHL; sourced here only)
    const ghlContact = await findContactByPhone(phone).catch(() => null)
    if (ghlContact?.id) {
      patchContactCustomFields(ghlContact.id, { credit_range_from_riley: creditRange }).catch(() => {})
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Read contact_state for a phone number.
 * Returns null if no record exists or on error.
 */
export async function readContactState(phone: string): Promise<ContactState | null> {
  if (!phone) return null
  try {
    const sb = createAdminClient()
    const { data } = await sb
      .from("contact_state")
      .select("phone, credit_range, credit_range_updated_at, credit_range_updated_channel, property_type, property_type_updated_at, property_type_updated_channel, loan_purpose, loan_purpose_updated_at, loan_purpose_updated_channel")
      .eq("phone", phone)
      .maybeSingle()
    return (data as ContactState) || null
  } catch {
    return null
  }
}

/**
 * Upsert property_type for a phone number.
 *
 * Single write gateway for property type across all channels.
 * Writes to contact_state (canonical memory) AND mirrors to
 * loan_applications.property_type so pipeline readers always see the same value.
 *
 * Never throws — write failures must never block the caller.
 */
export async function upsertPropertyType(
  phone: string,
  propertyType: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !propertyType) return
  try {
    const sb = createAdminClient()
    const digits = phone.replace(/\D/g, "").slice(-10)

    // 1. contact_state — canonical source
    await sb.from("contact_state").upsert(
      {
        phone,
        property_type: propertyType,
        property_type_updated_at: new Date().toISOString(),
        property_type_updated_channel: channel,
      },
      { onConflict: "phone" },
    )

    // 2. loan_applications mirror — keeps notifications, lender match, and admin display in sync
    if (digits.length === 10) {
      await sb
        .from("loan_applications")
        .update({ property_type: propertyType })
        .ilike("applicant_phone", `%${digits}`)
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Upsert loan_purpose for a phone number.
 *
 * Single write gateway for loan purpose across all channels.
 * Writes to contact_state (canonical memory) AND mirrors to
 * loan_applications.loan_purpose (feeds URLA PDF, MISMO, Fannie Mae, pre-fill).
 * No GHL write — confirmed stale by dashboard audit 2026-05-27.
 *
 * Valid values: purchase / refinance / cash-out-refinance / construction /
 *   renovation / investment / bridge-loan / debt-consolidation / home-equity / other
 *
 * Never throws — write failures must never block the caller.
 */
export async function upsertLoanPurpose(
  phone: string,
  loanPurpose: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !loanPurpose) return
  try {
    const sb = createAdminClient()
    const digits = phone.replace(/\D/g, "").slice(-10)

    // 1. contact_state — canonical source
    await sb.from("contact_state").upsert(
      {
        phone,
        loan_purpose: loanPurpose,
        loan_purpose_updated_at: new Date().toISOString(),
        loan_purpose_updated_channel: channel,
      },
      { onConflict: "phone" },
    )

    // 2. loan_applications mirror — URLA, MISMO, Fannie Mae, and pre-fill all read this
    if (digits.length === 10) {
      await sb
        .from("loan_applications")
        .update({ loan_purpose: loanPurpose })
        .ilike("applicant_phone", `%${digits}`)
    }
  } catch {
    // Non-fatal
  }
}
