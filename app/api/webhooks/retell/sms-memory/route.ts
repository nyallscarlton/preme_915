import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cancelRemainingCadence } from "@/lib/preme-cadence"
import { syncRetellChatToGhl } from "@/lib/ghl-client"

export const dynamic = "force-dynamic"

function premeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" } }
  )
}

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ""
const SLACK_CHANNEL = process.env.SLACK_PREME_CHANNEL || "C0AQ9KENFPA"

async function slackAlert(text: string) {
  if (!SLACK_TOKEN) return
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    })
  } catch {}
}

/**
 * POST /api/webhooks/retell/sms-memory
 *
 * Retell calls this as a context-injection webhook (inbound_sms_webhook_url).
 * Fires synchronously for every inbound SMS — both new conversations and replies
 * to API-created chats. Retell waits for our response to get dynamic variables
 * before the agent replies.
 *
 * Retell payload shape (no "event" field — it's a context hook, not a notification):
 * {
 *   "from_number": "+1...",   // sender (lead on inbound)
 *   "to_number": "+1...",     // recipient (Preme number on inbound)
 *   "message": "...",         // the inbound message text
 *   "chat_id": "...",
 *   "agent_id": "...",
 *   "metadata": { contact_id, source, ... }
 * }
 *
 * We must return { retell_llm_dynamic_variables: { ... } } for the agent.
 */
export async function POST(request: NextRequest) {
  let rawBody: Record<string, unknown> = {}
  try {
    rawBody = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ retell_llm_dynamic_variables: {} })
  }

  try {
    const fromNumber = (rawBody.from_number as string) || ""
    const toNumber = (rawBody.to_number as string) || ""
    const chatId = (rawBody.chat_id as string) || ""
    const metadata = (rawBody.metadata as Record<string, string>) || {}

    // The inbound message text — Retell sends it as "message" (string), not nested object
    const inboundText = (rawBody.message as string) || ""

    const premeNumbers = new Set([
      "+14709425787", "+14707301614", "+14709342303",
      "+14704706861", "+14708024973", "+14709286438",
      "+14706196417", "+14708353966", "+14707405808",
    ])

    const leadPhone = premeNumbers.has(fromNumber) ? toNumber : fromNumber
    const isInbound = !!leadPhone && !premeNumbers.has(fromNumber)

    console.log(`[sms-memory] from=${fromNumber} to=${toNumber} chat=${chatId} inbound=${isInbound} msg="${inboundText.slice(0,60)}"`)

    const supabase = premeClient()

    // Pull conversation history from Retell for context injection
    let conversationHistory = ""
    if (chatId) {
      try {
        const chatRes = await fetch(`https://api.retellai.com/get-chat/${chatId}`, {
          headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` },
        })
        if (chatRes.ok) {
          const chatData = await chatRes.json() as { message_with_tool_calls?: Array<{role:string;content:string}> }
          const msgs = chatData.message_with_tool_calls || []
          conversationHistory = msgs
            .filter(m => m.role === "user" || m.role === "agent")
            .map(m => `${m.role === "user" ? "Lead" : "Riley"}: ${m.content}`)
            .join("\n")
        }
      } catch {}
    }

    // Side effects — fire-and-forget so they don't delay Retell's response
    if (isInbound && inboundText) {
      // GHL contact_id is in Retell chat metadata
      const ghlContactId = metadata.contact_id

      void (async () => {
        // 1. Sync full Retell chat transcript to GHL (deduped) — catches Riley's replies too
        if (ghlContactId && chatId) {
          const retellMsgs = await fetch(`https://api.retellai.com/get-chat/${chatId}`, {
            headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` },
          }).then(r => r.json() as Promise<{ message_with_tool_calls?: Array<{role:string;content:string}> }>)
            .then(d => (d.message_with_tool_calls || []).filter(m => m.role === "agent" || m.role === "user") as Array<{role:"agent"|"user";content:string}>)
            .catch(() => [] as Array<{role:"agent"|"user";content:string}>)

          if (retellMsgs.length > 0) {
            syncRetellChatToGhl(ghlContactId, retellMsgs).catch((err) =>
              console.error(`[sms-memory] GHL chat sync failed (contact=${ghlContactId}):`, err),
            )
          }
        } else if (!ghlContactId) {
          console.warn(`[sms-memory] No contact_id in metadata — chat not synced to GHL (phone=${leadPhone})`)
        }

        // 2. Supabase: log interaction + cancel cadence
        const rawDigits = leadPhone.replace(/\D/g, "")
        const phoneVariants = [leadPhone]
        if (rawDigits.length === 11 && rawDigits.startsWith("1")) phoneVariants.push(rawDigits.slice(1))
        else if (rawDigits.length === 10) phoneVariants.push(`+1${rawDigits}`)

        const { data: lead } = await supabase
          .from("leads")
          .select("id, first_name, last_name")
          .or(phoneVariants.map(p => `phone.eq.${p}`).join(","))
          .limit(1)
          .maybeSingle()

        const name = lead ? `${lead.first_name} ${lead.last_name}` : leadPhone

        await supabase.from("contact_interactions").insert({
          phone: leadPhone,
          channel: "sms",
          direction: "inbound",
          content: inboundText,
          metadata: { chat_id: chatId, source: "retell_sms_webhook" },
        }).catch(() => {})

        if (lead?.id) {
          const { cancelled } = await cancelRemainingCadence(lead.id, "inbound_sms_reply")
          if (cancelled > 0) {
            console.log(`[sms-memory] Cancelled ${cancelled} cadence steps for ${name}`)
          }
        }

        // 3. Slack alert
        await slackAlert(
          `*Inbound SMS Reply*\n` +
          `From: ${name} (${leadPhone})\n` +
          `Message: "${inboundText.slice(0, 200)}"\n` +
          `_Lead is engaged — reply needed._`
        )
      })()
    }

    // Return dynamic variables to the Retell SMS agent
    return NextResponse.json({
      retell_llm_dynamic_variables: {
        conversation_history: conversationHistory,
      },
    })
  } catch (error) {
    console.error("[sms-memory] Webhook error:", error)
    // Always return valid dynamic variables so Retell can proceed
    return NextResponse.json({ retell_llm_dynamic_variables: {} })
  }
}
