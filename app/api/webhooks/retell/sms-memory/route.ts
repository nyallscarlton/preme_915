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
      headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    })
  } catch {}
}

const PREME_NUMBERS = new Set([
  "+14709425787", "+14707301614", "+14709342303",
  "+14704706861", "+14708024973", "+14709286438",
  "+14706196417", "+14708353966", "+14707405808",
])

async function resolveGhlContactId(
  metadataContactId: string | undefined,
  leadPhone: string,
): Promise<string | null> {
  if (metadataContactId) return metadataContactId
  if (!leadPhone) return null
  try {
    const digits = leadPhone.replace(/\D/g, "")
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${process.env.GHL_LOCATION_ID}&query=${encodeURIComponent(digits)}&limit=3`,
      { headers: { Authorization: `Bearer ${process.env.GHL_API_KEY}`, Version: "2021-07-28" } },
    )
    const data = await res.json() as { contacts?: Array<{ id: string; phone?: string }> }
    const match = (data.contacts || []).find(c =>
      (c.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10))
    )
    console.log(`[sms-memory] phone lookup ${leadPhone} → ${match?.id || "not found"}`)
    return match?.id || null
  } catch (err) {
    console.error("[sms-memory] GHL phone lookup failed:", err)
    return null
  }
}

/**
 * POST /api/webhooks/retell/sms-memory
 *
 * Handles TWO Retell webhook shapes:
 *
 * 1. Chat agent webhook (event = "chat_ended" | "chat_analyzed"):
 *    Fired by the SMS chat agent when a conversation ends. Contains full transcript.
 *    Body: { event, chat: { chat_id, message_with_tool_calls, metadata, to_number, ... } }
 *
 * 2. Context-injection webhook (no event field — phone-number inbound_sms_webhook_url):
 *    Fired synchronously for each inbound SMS so we can return dynamic variables.
 *    Body: { from_number, to_number, message, chat_id, agent_id, metadata }
 *    Must return { retell_llm_dynamic_variables: { ... } }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ retell_llm_dynamic_variables: {} })
  }

  const event = (body.event as string) || ""

  // ── Path 1: Chat agent event (chat_ended / chat_analyzed) ──────────────────
  if (event === "chat_ended" || event === "chat_analyzed") {
    const chat = (body.chat || {}) as Record<string, unknown>
    const chatId = (chat.chat_id as string) || ""
    const metadata = (chat.metadata as Record<string, string>) || {}
    const toNumber = (chat.to_number as string) || ""
    const leadPhone = PREME_NUMBERS.has(toNumber) ? toNumber : toNumber // to_number = lead for outbound chats

    // For outbound API-created chats, to_number is the lead
    const actualLeadPhone = PREME_NUMBERS.has(chat.from_number as string || "")
      ? (chat.to_number as string) || ""
      : (chat.from_number as string) || toNumber

    const msgs = ((chat.message_with_tool_calls as Array<{role:string;content:string}>) || [])
      .filter(m => m.role === "agent" || m.role === "user") as Array<{role:"agent"|"user";content:string}>

    console.log(`[sms-memory] ${event} chat=${chatId} msgs=${msgs.length} phone=${actualLeadPhone}`)

    if (msgs.length > 0) {
      const contactId = await resolveGhlContactId(metadata.contact_id, actualLeadPhone)
      if (contactId) {
        void syncRetellChatToGhl(contactId, msgs).catch(err =>
          console.error(`[sms-memory] GHL sync on ${event} failed (contact=${contactId}):`, err)
        )
      }
    }

    return NextResponse.json({ ok: true })
  }

  // ── Path 2: Context-injection (inbound_sms_webhook_url, no event field) ────
  const fromNumber = (body.from_number as string) || ""
  const toNumber   = (body.to_number as string) || ""
  const chatId     = (body.chat_id as string) || ""
  const metadata   = (body.metadata as Record<string, string>) || {}
  const inboundText = (body.message as string) || ""

  const leadPhone = PREME_NUMBERS.has(fromNumber) ? toNumber : fromNumber
  const isInbound = !!leadPhone && !PREME_NUMBERS.has(fromNumber)

  console.log(`[sms-memory] context-inject from=${fromNumber} to=${toNumber} chat=${chatId} inbound=${isInbound} msg="${inboundText.slice(0,60)}"`)

  // Fetch Retell chat history to return as context to the agent
  let conversationHistory = ""
  let retellMsgs: Array<{role:"agent"|"user";content:string}> = []
  if (chatId) {
    try {
      const chatRes = await fetch(`https://api.retellai.com/get-chat/${chatId}`, {
        headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` },
      })
      if (chatRes.ok) {
        const chatData = await chatRes.json() as { message_with_tool_calls?: Array<{role:string;content:string}> }
        const all = chatData.message_with_tool_calls || []
        retellMsgs = all.filter(m => m.role === "agent" || m.role === "user") as Array<{role:"agent"|"user";content:string}>
        conversationHistory = retellMsgs
          .map(m => `${m.role === "user" ? "Lead" : "Riley"}: ${m.content}`)
          .join("\n")
      }
    } catch {}
  }

  // Side effects for inbound messages — fire-and-forget
  if (isInbound && inboundText) {
    const supabase = premeClient()
    void (async () => {
      const contactId = await resolveGhlContactId(metadata.contact_id, leadPhone)

      // Sync full chat to GHL
      if (contactId && retellMsgs.length > 0) {
        syncRetellChatToGhl(contactId, retellMsgs).catch(err =>
          console.error(`[sms-memory] GHL sync failed (contact=${contactId}):`, err)
        )
      } else if (!contactId) {
        console.warn(`[sms-memory] No contact_id — GHL sync skipped (phone=${leadPhone})`)
      }

      // Supabase: log + cancel cadence
      const digits = leadPhone.replace(/\D/g, "")
      const variants = [leadPhone, digits.length === 10 ? `+1${digits}` : `+${digits}`]
      const { data: lead } = await supabase
        .from("leads").select("id, first_name, last_name")
        .or(variants.map(p => `phone.eq.${p}`).join(","))
        .limit(1).maybeSingle()

      await supabase.from("contact_interactions").insert({
        phone: leadPhone, channel: "sms", direction: "inbound", content: inboundText,
        metadata: { chat_id: chatId, source: "retell_sms_webhook" },
      }).catch(() => {})

      if (lead?.id) {
        const { cancelled } = await cancelRemainingCadence(lead.id, "inbound_sms_reply")
        if (cancelled > 0) console.log(`[sms-memory] Cancelled ${cancelled} cadence steps for ${lead.first_name}`)
      }

      await slackAlert(
        `*Inbound SMS Reply*\nFrom: ${lead ? `${lead.first_name} ${lead.last_name}` : leadPhone} (${leadPhone})\nMessage: "${inboundText.slice(0, 200)}"\n_Lead is engaged._`
      )
    })()
  }

  return NextResponse.json({
    retell_llm_dynamic_variables: { conversation_history: conversationHistory },
  })
}
