import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Retell from "retell-sdk"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`
}

async function getRetellSmsMessages(phone: string) {
  try {
    const client = new Retell({ apiKey: process.env.RETELL_API_KEY! })
    const digits = phone.replace(/\D/g, "").slice(-10)
    const chatList = await client.chat.list({ limit: 30, sort_order: "descending" }) as any
    const chats = chatList.items || chatList || []
    const matching = chats.filter((c: any) =>
      c.to_number?.includes(digits) || c.from_number?.includes(digits)
    )

    const messages: { role: string; content: string; time: number }[] = []
    for (const chat of matching.slice(0, 3)) {
      try {
        const full = await client.chat.retrieve(chat.chat_id)
        for (const m of ((full as any).message_with_tool_calls || [])) {
          if (m.content) {
            messages.push({ role: m.role, content: m.content, time: m.created_timestamp || 0 })
          }
        }
      } catch {}
    }
    messages.sort((a, b) => a.time - b.time)
    return messages
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body
    let phone = args.phone || ""

    // If no phone, try to get from call_id
    const callId = body.call_id || ""
    if ((!phone || phone.replace(/\D/g, "").length < 10) && callId) {
      try {
        const client = new Retell({ apiKey: process.env.RETELL_API_KEY! })
        const call = await client.call.retrieve(callId)
        // Only use this for INBOUND calls — outbound already has context
        if ((call as any).direction === "outbound") {
          return NextResponse.json({ result: "This is an outbound call. You already have the lead's info — use what's in your conversation_history. Do not look up memory on outbound calls." })
        }
        phone = (call as any).from_number || (call as any).to_number || ""
      } catch {}
    }

    // DO NOT fall back to most recent inbound call — that returns the wrong person's data

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ result: "No caller identified. Ask the caller for their name or phone number." })
    }

    const normalized = normalizePhone(phone)
    const digits = phone.replace(/\D/g, "").slice(-10)

    // Get lead info
    const { data: lead } = await supabase
      .from("zx_leads")
      .select("first_name, last_name, email, status, custom_fields")
      .like("phone", `%${digits}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get stored interactions
    const { data: interactions } = await supabase
      .from("zx_contact_interactions")
      .select("channel, direction, content, summary, created_at")
      .eq("phone", normalized)
      .order("created_at", { ascending: false })
      .limit(5)

    // Get SMS messages from Retell
    const smsMessages = await getRetellSmsMessages(phone)

    // Build the memory string
    const lines: string[] = []

    if (lead) {
      lines.push(`CALLER: ${lead.first_name} ${lead.last_name}`.trim())
      if (lead.email) lines.push(`EMAIL: ${lead.email}`)
      if (lead.status !== "new") lines.push(`STATUS: ${lead.status}`)
      const cf = (lead.custom_fields || {}) as Record<string, unknown>
      if (cf.loan_type) lines.push(`LOAN TYPE: ${cf.loan_type}`)
    }

    if (interactions && interactions.length > 0) {
      lines.push("\nRECENT INTERACTIONS:")
      for (const i of interactions.reverse()) {
        const time = new Date(i.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
        const ch = i.channel === "sms" ? "TEXT" : i.channel === "voice" ? "CALL" : "EMAIL"
        const dir = i.direction === "inbound" ? "THEM" : "RILEY"
        const content = (i.summary || i.content || "").substring(0, 150)
        if (content) lines.push(`[${time}] ${ch} ${dir}: ${content}`)
      }
    }

    if (smsMessages.length > 0) {
      lines.push("\nTEXT MESSAGE THREAD:")
      for (const m of smsMessages.slice(-10)) {
        const time = m.time ? new Date(m.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "?"
        const who = m.role === "user" ? "THEM" : "RILEY"
        lines.push(`[${time}] ${who}: ${m.content.substring(0, 200)}`)
      }
    }

    const result = lines.length > 0 ? lines.join("\n") : "No prior interactions found for this caller."
    return NextResponse.json({ result })
  } catch (error) {
    console.error("[lookup-memory] Error:", error)
    return NextResponse.json({ result: "Memory lookup failed. Proceed without prior context." })
  }
}
