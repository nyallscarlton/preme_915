import Retell from "retell-sdk"
import { buildConversationContext } from "@/lib/memory"

let _client: Retell | null = null

function getClient(): Retell {
  if (_client) return _client
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) throw new Error("RETELL_API_KEY is required")
  _client = new Retell({ apiKey })
  return _client
}

/**
 * Send an SMS via Retell's chat SMS API.
 * Uses the same agent as voice so conversation memory carries over.
 * Returns the chat_id for tracking.
 */
export async function sendRetellSms(to: string, body: string): Promise<string> {
  const fromNumber = process.env.RETELL_OUTBOUND_PHONE_NUMBER || process.env.RETELL_PHONE_NUMBER || "+14707301614"
  const client = getClient()

  const chat = await client.chat.createSMSChat({
    from_number: fromNumber,
    to_number: to,
    retell_llm_dynamic_variables: {
      initial_message: body,
    },
    metadata: { source: "sequence_automation" },
  })

  return chat.chat_id || "sent"
}

/**
 * Trigger an outbound call via Retell with conversation history.
 * Pulls prior interactions from memory so Riley knows what happened before.
 * Marks metadata as first_attempt for double-dial logic.
 *
 * TODO(reliability): see matching note in lib/retell.ts pickOutboundNumber.
 * When Retell returns 404 "Item +1xxx not found from phone-number", we currently
 * throw and log sequence_call_failed without removing the bad number from the
 * pool — so the next sequence cycle picks the same number and fails again.
 * On 2026-03-31 this caused 460 failures in a single day from one retired number.
 * Build an auto-evict mechanism: 3 strikes = drop from pool until manually re-added.
 */
export async function triggerDoubleDialCall(
  toNumber: string,
  agentId: string,
  metadata?: Record<string, string>,
  overrideFromNumber?: string
): Promise<string> {
  // .map(trim) defends against stray whitespace/newlines in the env var value
  // (a literal "\n" in RETELL_OUTBOUND_POOL on Vercel poisoned the last entry on 2026-03-31)
  const pool = (process.env.RETELL_OUTBOUND_POOL || process.env.RETELL_OUTBOUND_PHONE_NUMBER || "").split(",").map(s => s.trim()).filter(Boolean)
  const fromNumber = overrideFromNumber || (pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : process.env.RETELL_PHONE_NUMBER || "")
  const client = getClient()

  // Build conversation context from prior interactions
  let conversationHistory = ""
  try {
    conversationHistory = await buildConversationContext(toNumber)
  } catch (err) {
    console.error("[retell-sms] Failed to build conversation context:", err)
  }

  const call = await client.call.createPhoneCall({
    from_number: fromNumber,
    to_number: toNumber,
    override_agent_id: agentId,
    retell_llm_dynamic_variables: {
      conversation_history: conversationHistory,
      first_name: metadata?.lead_name?.split(" ")[0] || "",
    },
    metadata: {
      ...metadata,
      // Only set first_attempt if not already overridden (e.g. by second_attempt from pending dials)
      // Double-dial disabled — was doubling calls and burning numbers
      double_dial: "disabled",
    },
  })

  return call.call_id
}

/**
 * Trigger the second call of a double-dial sequence.
 * Called ~60s after the first call ends with no answer.
 */
export async function triggerSecondDial(
  toNumber: string,
  agentId: string,
  metadata?: Record<string, string>
): Promise<string> {
  const fromNumber = process.env.RETELL_PHONE_NUMBER || "+14709425787"
  const client = getClient()

  // Build conversation context for second attempt too
  let conversationHistory = ""
  try {
    conversationHistory = await buildConversationContext(toNumber)
  } catch (err) {
    console.error("[retell-sms] Failed to build conversation context:", err)
  }

  const call = await client.call.createPhoneCall({
    from_number: fromNumber,
    to_number: toNumber,
    override_agent_id: agentId,
    retell_llm_dynamic_variables: {
      conversation_history: conversationHistory,
      first_name: metadata?.lead_name?.split(" ")[0] || "",
    },
    metadata: {
      ...metadata,
      double_dial: "second_attempt",
    },
  })

  return call.call_id
}
