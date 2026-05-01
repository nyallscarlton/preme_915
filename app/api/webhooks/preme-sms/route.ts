/**
 * POST /api/webhooks/preme-sms
 *
 * Twilio inbound SMS webhook — fires for EVERY message the lead sends to +14703159898.
 * This gives real-time per-message visibility vs. Retell's SMS chat which only fires
 * on chat_ended.
 *
 * Flow:
 * 1. Receive lead's message from Twilio
 * 2. Sync inbound message to GHL immediately
 * 3. Generate Riley's response via Retell LLM (createChatCompletion)
 * 4. Send response via Twilio → triggers delivery status callback
 * 5. Sync Riley's response to GHL
 * 6. Return empty TwiML (we're sending the reply ourselves, not via TwiML)
 */

import { NextRequest, NextResponse } from "next/server"
import Twilio from "twilio"
import Retell from "retell-sdk"
import { createClient } from "@supabase/supabase-js"
import { syncSmsToGhl } from "@/lib/ghl-client"
import { cancelRemainingCadence } from "@/lib/preme-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const PREME_SMS_FROM = "+14703159898"
const RILEY_LLM_ID   = "llm_c33550bf8b4560f9fc6bc17d3ec6" // Preme SMS LLM
const GHL_LOCATION   = process.env.GHL_LOCATION_ID || "oJdpORlMqp7p4yuhYdNu"

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "quit", "cancel", "optout", "opt out"]

function twiml() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "application/xml" } }
  )
}

function premeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" } }
  )
}

async function resolveGhlContact(phone: string): Promise<{ id: string; firstName?: string } | null> {
  const digits = phone.replace(/\D/g, "").slice(-10)
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION}&query=${digits}&limit=3`,
      { headers: { Authorization: `Bearer ${process.env.GHL_API_KEY}`, Version: "2021-07-28" } }
    )
    const data = await res.json() as { contacts?: Array<{ id: string; phone?: string; firstName?: string }> }
    return (data.contacts || []).find(c =>
      (c.phone || "").replace(/\D/g, "").endsWith(digits)
    ) || null
  } catch { return null }
}

async function getOrCreateRileyChat(leadPhone: string, contactId: string): Promise<string | null> {
  // Look up active chat_id from Supabase
  const sb = premeClient()
  const { data } = await sb.from("contact_interactions")
    .select("metadata")
    .eq("phone", leadPhone.startsWith("+") ? leadPhone : `+1${leadPhone.replace(/\D/g,"")}`)
    .eq("channel", "sms")
    .not("metadata->retell_chat_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const existingChatId = (data?.metadata as Record<string,string> | null)?.retell_chat_id
  if (existingChatId) return existingChatId

  // Create a new Retell API chat with Riley's LLM
  const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! })
  try {
    const chat = await retell.chat.create({
      agent_id: "agent_ce0308f227491edfd0606f0aef", // Riley SMS agent (chat type)
      metadata: { contact_id: contactId, lead_phone: leadPhone, source: "preme_twilio_sms" },
      retell_llm_dynamic_variables: { first_name: "there" },
    })
    return chat.chat_id
  } catch (err) {
    console.error("[preme-sms] Failed to create Riley chat:", err)
    return null
  }
}

async function generateRileyResponse(chatId: string, userMessage: string): Promise<string | null> {
  const retell = new Retell({ apiKey: process.env.RETELL_API_KEY! })
  try {
    const completion = await retell.chat.createChatCompletion({
      chat_id: chatId,
      content: userMessage,
    })
    const agentMsg = completion.messages?.find(m => m.role === "agent")
    return (agentMsg as { role: string; content: string } | undefined)?.content || null
  } catch (err) {
    console.error("[preme-sms] Riley LLM error:", err)
    return null
  }
}

async function sendViaTwilio(to: string, body: string, contactId: string): Promise<void> {
  const client = new Twilio.Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  const msg = await client.messages.create({
    from: PREME_SMS_FROM,
    to,
    body,
    statusCallback: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.premerealestate.com"}/api/webhooks/preme-sms-status`,
  })
  console.log(`[preme-sms] sent sid=${msg.sid} to=${to}`)
  // Sync outbound to GHL immediately
  await syncSmsToGhl(contactId, "outbound", body).catch(err =>
    console.error("[preme-sms] GHL outbound sync failed:", err)
  )
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const from    = form.get("From") as string
    const body    = form.get("Body") as string
    const msgSid  = form.get("MessageSid") as string

    if (!from || !body) return twiml()

    const digits  = from.replace(/\D/g, "")
    const e164    = digits.startsWith("1") ? `+${digits}` : `+1${digits}`
    const bodyLow = body.trim().toLowerCase()

    console.log(`[preme-sms] inbound from=${from} msg="${body.slice(0,80)}"`)

    // 1. Resolve GHL contact
    const contact = await resolveGhlContact(from)
    if (!contact) {
      console.warn(`[preme-sms] no GHL contact for ${from}`)
      return twiml()
    }

    // 2. Sync inbound to GHL immediately
    await syncSmsToGhl(contact.id, "inbound", body).catch(err =>
      console.error("[preme-sms] GHL inbound sync failed:", err)
    )

    // 3. Log to Supabase
    const sb = premeClient()
    await sb.from("contact_interactions").insert({
      phone: e164, channel: "sms", direction: "inbound", content: body,
      metadata: { twilio_sid: msgSid, source: "preme_twilio_sms", ghl_contact_id: contact.id },
    }).catch(() => {})

    // 4. Opt-out handling
    if (OPT_OUT_KEYWORDS.some(kw => bodyLow === kw || bodyLow.includes(kw))) {
      const { data: lead } = await sb.from("leads").select("id")
        .ilike("phone", `%${digits.slice(-10)}%`).limit(1).maybeSingle()
      if (lead?.id) await cancelRemainingCadence(lead.id, "sms_opt_out")
      await sendViaTwilio(from, "Got it, removing you from our list. Best of luck! - Riley", contact.id)
      return twiml()
    }

    // 5. Get or create Riley's Retell chat session for this lead
    const chatId = await getOrCreateRileyChat(e164, contact.id)
    if (!chatId) {
      console.error("[preme-sms] could not get Riley chat — no response sent")
      return twiml()
    }

    // Store chat_id for future lookups
    await sb.from("contact_interactions").update({
      metadata: { twilio_sid: msgSid, source: "preme_twilio_sms", ghl_contact_id: contact.id, retell_chat_id: chatId }
    }).eq("phone", e164).eq("channel", "sms").eq("direction", "inbound").eq("content", body).catch(() => {})

    // 6. Generate Riley's response
    const rileyResponse = await generateRileyResponse(chatId, body)
    if (!rileyResponse) {
      console.error("[preme-sms] no Riley response generated")
      return twiml()
    }

    // 7. Send Riley's response via Twilio + sync to GHL
    await sendViaTwilio(from, rileyResponse, contact.id)

    return twiml()
  } catch (err) {
    console.error("[preme-sms] webhook error:", err)
    return twiml()
  }
}
