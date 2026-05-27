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
 * Never throws — contact_state write failure must never block the caller.
 */
export async function upsertCreditRange(
  phone: string,
  creditRange: string,
  channel: ContactStateChannel,
): Promise<void> {
  if (!phone || !creditRange) return
  try {
    const sb = createAdminClient()
    await sb.from("contact_state").upsert(
      {
        phone,
        credit_range: creditRange,
        credit_range_updated_at: new Date().toISOString(),
        credit_range_updated_channel: channel,
      },
      { onConflict: "phone" },
    )
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
