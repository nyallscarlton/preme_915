import Retell from "retell-sdk"

// Lazy-initialize to ensure env vars are available at call time
let _retellClient: Retell | null = null
function getRetellClient(): Retell | null {
  if (_retellClient) return _retellClient
  if (!process.env.RETELL_API_KEY) return null
  _retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY })
  return _retellClient
}

/**
 * Pick an outbound from-number from the rotation pool.
 *
 * Reads RETELL_OUTBOUND_POOL (comma-separated). Random selection across the
 * pool spreads call volume so no single number gets carrier-flagged as
 * "Spam Likely" — rotation is the main reason healthy pools get 2-3x better
 * connect rates than single-number setups.
 *
 * On 2026-04-07 the previous fallback to RETELL_PREME_PHONE_NUMBER
 * (+14709425787) was removed because that number was confirmed Spam-Likely
 * by carriers — Nyalls saw the label on his own phone. The fallback was
 * silently using the burned number whenever the pool was misconfigured.
 * Now we throw instead of falling back.
 *
 * .map(trim) defends against stray whitespace/newlines in env values
 * (Vercel env values have had literal "\n" appended in the past).
 *
 * TODO(reliability): build smarter rotation that auto-evicts a number from
 * the pool after 3 consecutive Retell 404s ("Item +1xxx not found from
 * phone-number"). On 2026-03-31 a single retired number caused 460 sequence
 * call failures in one day because the rotator kept retrying it.
 *
 * TODO(stickiness): for callback continuity, consider remembering the
 * from_number used per lead so a returning callback hits the same caller ID.
 * Requires a per-lead lookup against the call history table.
 */
// Exported variant used by ported zentryx/lib/sequences.ts. Takes a leadId
// arg for compatibility but currently just rotates randomly — sticky-number
// assignment per lead is a future enhancement.
export async function pickOutboundNumber(_leadId?: string): Promise<string> {
  return pickOutboundNumberSync()
}

function pickOutboundNumberSync(): string {
  const pool = (process.env.RETELL_OUTBOUND_POOL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (pool.length === 0) {
    throw new Error(
      "RETELL_OUTBOUND_POOL is empty — cannot place outbound call. " +
      "Refusing to fall back to RETELL_PREME_PHONE_NUMBER (+14709425787, confirmed Spam-Likely 2026-04-07)."
    )
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Resolve lead context for the agent's dynamic greeting.
 */
function resolveLeadContext(lead: {
  source?: string
}): string {
  const source = lead.source || ""
  if (source.includes("google") || source.includes("ppc")) return "google_ad"
  if (source.includes("facebook") || source.includes("meta")) return "facebook_ad"
  if (source.includes("referral")) return "referral"
  if (source.includes("zentryx")) return "landing_page"
  if (source === "callback" || source === "follow_up") return "callback"
  if (source === "inbound" || source === "website") return "inbound"
  return "outbound"
}

/**
 * Trigger an outbound call via Retell for Preme lead qualification.
 */
export async function triggerOutboundCall(lead: {
  id?: string
  first_name: string
  last_name: string
  phone: string
  email?: string
  loan_type?: string
  loan_amount?: string
  property_address?: string
  message?: string
  source?: string
  conversation_history?: string
}): Promise<{ call_id: string } | { error: string; code: string }> {
  const retellClient = getRetellClient()
  if (!retellClient) {
    return { error: "RETELL_API_KEY not configured", code: "no_api_key" }
  }

  const agentId = process.env.RETELL_PREME_AGENT_ID
  if (!agentId) {
    return { error: "RETELL_PREME_AGENT_ID not configured", code: "no_agent_id" }
  }

  // Use the rotation pool (RETELL_OUTBOUND_POOL) — never the burned +14709425787.
  // pickOutboundNumber() throws if the pool is empty rather than falling back.
  let fromNumber: string
  try {
    fromNumber = pickOutboundNumberSync()
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      code: "no_pool",
    }
  }

  const phone = lead.phone.replace(/\D/g, "")
  const e164 = phone.startsWith("1") ? `+${phone}` : `+1${phone}`

  // Build a natural outbound opener that states why Riley is calling
  const loanLabel = lead.loan_type || "real estate financing"
  const sourceContext = resolveLeadContext(lead)
  let openingMessage: string

  if (sourceContext === "callback" || sourceContext === "follow_up") {
    openingMessage = `Hey ${lead.first_name}, this is Riley from Preme Home Loans. I'm following up on our earlier conversation about ${loanLabel}. Got a quick minute?`
  } else if (sourceContext === "google_ad" || sourceContext === "facebook_ad" || sourceContext === "landing_page") {
    openingMessage = `Hey ${lead.first_name}, this is Riley from Preme Home Loans. I saw you submitted an inquiry about ${loanLabel} — wanted to follow up real quick. Got a minute?`
  } else {
    openingMessage = `Hey ${lead.first_name}, this is Riley from Preme Home Loans. We received your inquiry about ${loanLabel} and I wanted to follow up. Is now a good time?`
  }

  const dynamicVars: Record<string, string> = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    lead_email: lead.email || "",
    lead_phone: lead.phone,
    loan_type: lead.loan_type || "",
    loan_amount: lead.loan_amount || "",
    property_address: lead.property_address || "",
    lead_message: lead.message || "",
    lead_context: sourceContext,
    conversation_history: lead.conversation_history || "No prior interactions.",
    opening_message: openingMessage,
  }

  try {
    const call = await retellClient.call.createPhoneCall({
      from_number: fromNumber,
      to_number: e164,
      override_agent_id: agentId,
      metadata: {
        lead_id: lead.id || "",
        source: "preme",
      },
      retell_llm_dynamic_variables: dynamicVars,
    })
    return { call_id: call.call_id }
  } catch (error: any) {
    const msg = error?.message || String(error)
    const status = error?.status || "unknown"
    console.error(`[retell-preme] Failed to create call (${status}):`, msg)
    return { error: msg, code: `api_${status}` }
  }
}

/**
 * Fetch call details (transcript, recording, analysis) from Retell.
 */
export async function getCallDetails(callId: string) {
  const retellClient = getRetellClient()
  if (!retellClient) return null

  try {
    const call = await retellClient.call.retrieve(callId)
    return {
      transcript: call.transcript || null,
      recording_url: call.recording_url || null,
      call_analysis: (call.call_analysis as Record<string, unknown>) || null,
      duration_ms: call.end_timestamp && call.start_timestamp
        ? call.end_timestamp - call.start_timestamp
        : null,
    }
  } catch (error) {
    console.error("[retell-preme] Failed to get call details:", error)
    return null
  }
}

/**
 * Verify Retell webhook signature.
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
): Promise<boolean> {
  if (!process.env.RETELL_API_KEY) return false
  try {
    return await Retell.verify(body, process.env.RETELL_API_KEY, signature)
  } catch {
    return false
  }
}
