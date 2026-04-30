/**
 * Thin GHL v2 API client for the Preme sub-account.
 *
 * Centralizes the bearer-token + Version header dance and the contact PATCH
 * shape so callers don't repeat the boilerplate. Used by:
 *   - lib/preme-sms.ts (post-send state PATCHes)
 *   - app/api/preme/webhooks/* (pre-qual + 1003 lifecycle webhooks per Doc 02.14)
 *
 * Auth: GHL_API_KEY (Private Integration Token, "pit-…"). Reads at call time
 * (not module load) so test/dryRun paths don't blow up when env is absent.
 *
 * Failure policy: every helper returns { ok: boolean, error?: string }. Callers
 * decide whether to surface, retry, or swallow. Per Doc 02.14, post-send PATCH
 * failures must NOT block the SMS send (graceful degradation).
 */

const GHL_BASE = "https://services.leadconnectorhq.com"
const GHL_VERSION = "2021-07-28"

interface GhlResult<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

function getCreds(): { apiKey: string; locationId: string } | { error: string } {
  const apiKey = process.env.GHL_API_KEY
  const locationId = process.env.GHL_LOCATION_ID
  if (!apiKey || !locationId) {
    return { error: "GHL_API_KEY or GHL_LOCATION_ID not configured" }
  }
  return { apiKey, locationId }
}

async function ghlFetch<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<GhlResult<T>> {
  const creds = getCreds()
  if ("error" in creds) return { ok: false, status: 0, error: creds.error }

  try {
    const res = await fetch(`${GHL_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        Version: GHL_VERSION,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data: T | undefined
    try {
      data = text ? (JSON.parse(text) as T) : undefined
    } catch {
      // non-JSON response — leave data undefined
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: text || `HTTP ${res.status}`, data }
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: msg }
  }
}

export interface GhlContact {
  id: string
  tags?: string[]
  customFields?: Array<{ id?: string; key?: string; value?: string }>
  phone?: string
  email?: string
  firstName?: string
  lastName?: string
}

/** GET /contacts/{id} — returns the contact record. */
export async function getContact(contactId: string): Promise<GhlResult<{ contact: GhlContact }>> {
  return ghlFetch<{ contact: GhlContact }>("GET", `/contacts/${contactId}`)
}

/** Helper: does this contact carry the given tag? Returns ok:false if contact lookup fails. */
export async function contactHasTag(
  contactId: string,
  tag: string,
): Promise<GhlResult<{ has: boolean }>> {
  const r = await getContact(contactId)
  if (!r.ok || !r.data) return { ok: false, status: r.status, error: r.error || "no contact data" }
  const tags = r.data.contact?.tags || []
  return { ok: true, status: r.status, data: { has: tags.includes(tag) } }
}

/**
 * PUT /contacts/{id} — set one or more custom fields by key.
 * Idempotent: GHL accepts re-PATCHing the same value.
 */
export async function patchContactCustomFields(
  contactId: string,
  fields: Record<string, string | number | null>,
): Promise<GhlResult> {
  const customFields = Object.entries(fields).map(([key, value]) => ({
    key,
    field_value: value,
  }))
  return ghlFetch("PUT", `/contacts/${contactId}`, { customFields })
}

/** POST /contacts/{id}/tags — add tag(s). Idempotent. */
export async function addContactTags(
  contactId: string,
  tags: string[],
): Promise<GhlResult> {
  return ghlFetch("POST", `/contacts/${contactId}/tags`, { tags })
}

/** POST /contacts/{id}/notes — add a note visible in the contact activity feed. */
export async function addContactNote(
  contactId: string,
  body: string,
): Promise<GhlResult> {
  return ghlFetch("POST", `/contacts/${contactId}/notes`, { body })
}

/**
 * Find the first existing conversation for a contact, or create an SMS one.
 * Returns the conversationId.
 */
export async function findOrCreateConversation(
  contactId: string,
): Promise<GhlResult<{ conversationId: string }>> {
  const creds = getCreds()
  if ("error" in creds) return { ok: false, status: 0, error: creds.error }

  const searchRes = await ghlFetch<{ conversations?: Array<{ id: string }> }>(
    "GET",
    `/conversations/search?locationId=${creds.locationId}&contactId=${contactId}&limit=1`,
  )
  if (searchRes.ok && searchRes.data?.conversations?.length) {
    return { ok: true, status: 200, data: { conversationId: searchRes.data.conversations[0].id } }
  }

  const createRes = await ghlFetch<{ conversation?: { id: string } }>(
    "POST",
    "/conversations/",
    { locationId: creds.locationId, contactId },
  )
  if (!createRes.ok || !createRes.data?.conversation?.id) {
    return { ok: false, status: createRes.status, error: createRes.error || "failed to create conversation" }
  }
  return { ok: true, status: 201, data: { conversationId: createRes.data.conversation.id } }
}

/**
 * Sync an SMS message into GHL's conversation thread.
 * Fire-and-forget safe — callers should never await this on the critical path.
 */
export async function syncSmsToGhl(
  contactId: string,
  direction: "inbound" | "outbound",
  body: string,
): Promise<GhlResult> {
  const convRes = await findOrCreateConversation(contactId)
  if (!convRes.ok || !convRes.data) return convRes
  return ghlFetch("POST", "/conversations/messages", {
    type: "SMS",
    contactId,
    conversationId: convRes.data.conversationId,
    direction,
    message: body,
  })
}

/** Convenience: state field + tag in one call. Sequenced — field PATCH first, then tag. */
export async function patchStateAndTag(
  contactId: string,
  fields: Record<string, string | number | null>,
  tags?: string[],
): Promise<GhlResult> {
  const fieldRes = await patchContactCustomFields(contactId, fields)
  if (!fieldRes.ok) return fieldRes
  if (tags && tags.length > 0) {
    return addContactTags(contactId, tags)
  }
  return fieldRes
}
