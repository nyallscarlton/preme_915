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

const PREME_NUMBERS = new Set([
  "+14709425787", "+14707301614", "+14709342303",
  "+14704706861", "+14708024973", "+14709286438",
  "+14706196417", "+14708353966", "+14707405808",
])

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ""
const SLACK_CHANNEL = process.env.SLACK_PREME_CHANNEL || "C0AQ9KENFPA"

async function slackAlert(text: string) {
  if (!SLACK_TOKEN) return
  fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
  }).catch(() => {})
}

async function resolveGhlContactId(phone: string, metaContactId?: string): Promise<string | null> {
  if (metaContactId) return metaContactId
  if (!phone) return null
  try {
    const digits = phone.replace(/\D/g, "")
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${process.env.GHL_LOCATION_ID}&query=${encodeURIComponent(digits)}&limit=3`,
      { headers: { Authorization: `Bearer ${process.env.GHL_API_KEY}`, Version: "2021-07-28" } },
    )
    const data = await res.json() as { contacts?: Array<{ id: string; phone?: string }> }
    const match = (data.contacts || []).find(c =>
      (c.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10))
    )
    console.log(`[sms-memory] GHL lookup ${phone} → ${match?.id || "not found"}`)
    return match?.id || null
  } catch { return null }
}

type RetellMsg = { role: "agent" | "user"; content: string }

async function fetchActiveChatMsgs(leadPhone: string): Promise<{ chatId: string; msgs: RetellMsg[]; metadata: Record<string, string> } | null> {
  try {
    const res = await fetch("https://api.retellai.com/list-chat?limit=50&sort_order=descending", {
      headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` },
    })
    if (!res.ok) return null
    const chats = await res.json() as Array<{
      chat_id: string; chat_status: string;
      to_number?: string; from_number?: string;
      message_with_tool_calls?: Array<{ role: string; content: string }>;
      metadata?: Record<string, string>
    }>
    const match = chats.find(c =>
      c.chat_status === "ongoing" &&
      (c.to_number === leadPhone || c.from_number === leadPhone)
    )
    if (!match) return null
    const msgs = (match.message_with_tool_calls || [])
      .filter(m => m.role === "agent" || m.role === "user") as RetellMsg[]
    return { chatId: match.chat_id, msgs, metadata: match.metadata || {} }
  } catch { return null }
}

/**
 * POST /api/webhooks/retell/sms-memory
 *
 * Three Retell event shapes handled:
 *
 * 1. chat_inbound  (phone number inbound_sms_webhook_url)
 *    Fires on EVERY inbound SMS from the lead. No chat_id in payload.
 *    Body: { event: "chat_inbound", chat_inbound: { from_number, to_number, agent_id } }
 *    Must return: { chat_inbound: { dynamic_variables: {...} } }
 *
 * 2. chat_ended / chat_analyzed  (chat agent webhook_url)
 *    Fires once when the conversation ends. Full transcript included.
 *    Body: { event: "chat_ended", chat: { chat_id, message_with_tool_calls, metadata, ... } }
 *
 * 3. Legacy context-injection (no event field — old format)
 *    Body: { from_number, to_number, message, chat_id, metadata }
 *    Must return: { retell_llm_dynamic_variables: {...} }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ chat_inbound: { dynamic_variables: {} } })
  }

  const event = (body.event as string) || ""
  console.log(`[sms-memory] event="${event}" keys=${Object.keys(body).join(",")}`)

  // ── 1. chat_inbound: fires on every lead reply ──────────────────────────────
  if (event === "chat_inbound") {
    const ci = (body.chat_inbound || {}) as Record<string, string>
    const fromNumber = ci.from_number || ""
    const toNumber   = ci.to_number || ""
    const leadPhone  = PREME_NUMBERS.has(fromNumber) ? toNumber : fromNumber

    console.log(`[sms-memory] chat_inbound from=${fromNumber} to=${toNumber} lead=${leadPhone}`)

    // Look up active chat for this lead to get full transcript
    const chatData = await fetchActiveChatMsgs(leadPhone)
    let conversationHistory = ""

    if (chatData && chatData.msgs.length > 0) {
      conversationHistory = chatData.msgs
        .map(m => `${m.role === "user" ? "Lead" : "Riley"}: ${m.content}`)
        .join("\n")

      // Sync full chat to GHL synchronously
      const contactId = await resolveGhlContactId(leadPhone, chatData.metadata.contact_id)
      if (contactId) {
        await syncRetellChatToGhl(contactId, chatData.msgs).catch(err =>
          console.error(`[sms-memory] GHL sync failed (contact=${contactId}):`, err)
        )
      } else {
        console.warn(`[sms-memory] no GHL contact for ${leadPhone}`)
      }

      // Cancel cadence + Slack alert (non-critical)
      if (leadPhone) {
        const supabase = premeClient()
        const digits = leadPhone.replace(/\D/g, "")
        const variants = [leadPhone, digits.length === 10 ? `+1${digits}` : `+${digits}`]
        const { data: lead } = await supabase.from("leads").select("id, first_name, last_name")
          .or(variants.map(p => `phone.eq.${p}`).join(",")).limit(1).maybeSingle()
        if (lead?.id) {
          const { cancelled } = await cancelRemainingCadence(lead.id, "inbound_sms_reply")
          if (cancelled > 0) console.log(`[sms-memory] cancelled ${cancelled} cadence steps for ${lead.first_name}`)
        }
        const lastUserMsg = [...chatData.msgs].reverse().find(m => m.role === "user")
        if (lastUserMsg) {
          slackAlert(`*Inbound SMS*\nFrom: ${lead ? `${lead.first_name} ${lead.last_name}` : leadPhone}\nMessage: "${lastUserMsg.content.slice(0, 200)}"`)
        }
      }
    }

    // Return dynamic variables for the agent
    return NextResponse.json({
      chat_inbound: {
        dynamic_variables: { conversation_history: conversationHistory },
      },
    })
  }

  // ── 2. chat_ended / chat_analyzed: sync full transcript ────────────────────
  if (event === "chat_ended" || event === "chat_analyzed") {
    const chat = (body.chat || {}) as Record<string, unknown>
    const chatId = (chat.chat_id as string) || ""
    const metadata = (chat.metadata as Record<string, string>) || {}
    const actualLeadPhone = PREME_NUMBERS.has(chat.from_number as string || "")
      ? (chat.to_number as string) || ""
      : (chat.from_number as string) || ""

    const msgs = ((chat.message_with_tool_calls as Array<{ role: string; content: string }>) || [])
      .filter(m => m.role === "agent" || m.role === "user") as RetellMsg[]

    console.log(`[sms-memory] ${event} chat=${chatId} msgs=${msgs.length} phone=${actualLeadPhone}`)

    if (msgs.length > 0) {
      const contactId = await resolveGhlContactId(actualLeadPhone, metadata.contact_id)
      if (contactId) {
        await syncRetellChatToGhl(contactId, msgs).catch(err =>
          console.error(`[sms-memory] GHL sync on ${event} failed:`, err)
        )
      }
    }
    return NextResponse.json({ ok: true })
  }

  // ── 3. Legacy: no event field (old context-injection format) ───────────────
  const fromNumber  = (body.from_number as string) || ""
  const toNumber    = (body.to_number as string) || ""
  const chatId      = (body.chat_id as string) || ""
  const metadata    = (body.metadata as Record<string, string>) || {}
  const leadPhone   = PREME_NUMBERS.has(fromNumber) ? toNumber : fromNumber

  console.log(`[sms-memory] legacy from=${fromNumber} chat=${chatId}`)

  let retellMsgs: RetellMsg[] = []
  let conversationHistory = ""
  if (chatId) {
    try {
      const chatRes = await fetch(`https://api.retellai.com/get-chat/${chatId}`, {
        headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` },
      })
      if (chatRes.ok) {
        const chatData = await chatRes.json() as { message_with_tool_calls?: Array<{ role: string; content: string }> }
        retellMsgs = (chatData.message_with_tool_calls || [])
          .filter(m => m.role === "agent" || m.role === "user") as RetellMsg[]
        conversationHistory = retellMsgs
          .map(m => `${m.role === "user" ? "Lead" : "Riley"}: ${m.content}`)
          .join("\n")
      }
    } catch {}
  }

  if (retellMsgs.length > 0 && leadPhone) {
    const contactId = await resolveGhlContactId(leadPhone, metadata.contact_id)
    if (contactId) {
      await syncRetellChatToGhl(contactId, retellMsgs).catch(() => {})
    }
  }

  return NextResponse.json({
    retell_llm_dynamic_variables: { conversation_history: conversationHistory },
  })
}
