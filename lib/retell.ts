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
  loan_type?: string
  property_address?: string
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

  const fromNumber = process.env.RETELL_PREME_PHONE_NUMBER
  if (!fromNumber) {
    return { error: "RETELL_PREME_PHONE_NUMBER not configured", code: "no_phone" }
  }

  const phone = lead.phone.replace(/\D/g, "")
  const e164 = phone.startsWith("1") ? `+${phone}` : `+1${phone}`

  const dynamicVars: Record<string, string> = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    loan_type: lead.loan_type || "",
    property_address: lead.property_address || "",
    lead_source: resolveLeadContext(lead),
    conversation_history: lead.conversation_history || "No prior interactions.",
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
