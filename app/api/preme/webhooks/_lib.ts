/**
 * Shared utilities for /api/preme/webhooks/* routes.
 * Doc 02.14 §4.1–4.7 — pre-qual + 1003 lifecycle webhooks.
 */
import { NextRequest } from "next/server"
import { type GhlContact, getContact, patchContactCustomFields } from "@/lib/ghl-client"

/** Auth check matches /api/preme/sms/send pattern. */
export function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = request.headers.get("authorization")
  if (bearer === `Bearer ${secret}`) return true
  const internal = request.headers.get("x-internal-auth")
  if (internal === secret) return true
  return false
}

/** Idempotency helper: state field is monotonic, never goes backward. */
const STATE_RANK = { not_sent: 0, link_sent: 1, opened: 2, submitted: 3 } as const
type StateValue = keyof typeof STATE_RANK

/**
 * GHL contact-API responses include `customFields` keyed by the field's
 * internal `id`, NOT by `key`/`fieldKey`. Map state-field keys to their
 * Preme-location ids so the idempotency check can read current value.
 *
 * Verified via the GHL custom-fields API on 2026-04-26 (Preme location
 * `oJdpORlMqp7p4yuhYdNu`):
 *   - pre_qual_state → zsb8znfTiaqLSdG2LFb5
 *   - loan_app_state → MNzouG6txDDhIPafQB5f
 *
 * If a new state field is added to the Preme location, append its id here.
 */
const STATE_FIELD_IDS: Record<string, string> = {
  pre_qual_state: "zsb8znfTiaqLSdG2LFb5",
  loan_app_state: "MNzouG6txDDhIPafQB5f",
}

export function readContactState(contact: GhlContact, key: string): string | undefined {
  const targetId = STATE_FIELD_IDS[key]
  // Match either by key (if GHL ever starts returning it) OR by the known id.
  const cf = (contact.customFields || []).find(
    (f) => f.key === key || (targetId && f.id === targetId) || f.id === key,
  )
  return cf?.value
}

/**
 * Idempotent state advance. Returns the value to PATCH, or null if the current
 * state is already at-or-beyond the desired state (no-op).
 */
export function nextStateOrNull(current: string | undefined, desired: StateValue): StateValue | null {
  const c = (current as StateValue) || "not_sent"
  const cRank = STATE_RANK[c] ?? 0
  const dRank = STATE_RANK[desired]
  if (dRank > cRank) return desired
  return null
}

/**
 * Advance a state field idempotently. Returns:
 *   { advanced: true, from, to } if PATCH was made
 *   { advanced: false, current } if no-op (already at-or-beyond desired)
 *   { advanced: false, error } on failure
 */
export async function advanceStateIdempotent(
  contactId: string,
  fieldKey: string,
  desired: StateValue,
): Promise<
  | { advanced: true; from: string; to: StateValue }
  | { advanced: false; current?: string; error?: string }
> {
  const r = await getContact(contactId)
  if (!r.ok || !r.data) {
    return { advanced: false, error: r.error || "contact lookup failed" }
  }
  const current = readContactState(r.data.contact, fieldKey)
  const next = nextStateOrNull(current, desired)
  if (next === null) {
    return { advanced: false, current }
  }
  const patchRes = await patchContactCustomFields(contactId, { [fieldKey]: next })
  if (!patchRes.ok) {
    return { advanced: false, error: patchRes.error || "PATCH failed" }
  }
  return { advanced: true, from: current || "not_sent", to: next }
}
