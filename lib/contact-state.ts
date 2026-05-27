/**
 * preme.contact_state — canonical per-contact qualifying facts
 *
 * Single source of truth for facts Riley learns across voice and SMS.
 * All three write sources (voice, sms, application) route through here.
 * Both agents (voice inbound-context + SMS getOrCreateRileyChat) read here.
 *
 * Milestone 1: credit_range only.
 * Subsequent milestones add columns (property_type, loan_purpose, timeline, etc.)
 * one at a time, each fully proven before the next.
 */

import { createAdminClient } from "@/lib/supabase/admin"

export type ContactStateChannel = "sms" | "voice" | "application"

export interface ContactState {
  phone: string
  credit_range: string | null
  credit_range_updated_at: string | null
  credit_range_updated_channel: ContactStateChannel | null
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
      .select("phone, credit_range, credit_range_updated_at, credit_range_updated_channel")
      .eq("phone", phone)
      .maybeSingle()
    return (data as ContactState) || null
  } catch {
    return null
  }
}
