import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cancelRemainingCadence } from "@/lib/preme-cadence"
import { syncSmsToGhl } from "@/lib/ghl-client"

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
 * Retell calls this during SMS chat conversations.
 * Captures inbound replies from leads into preme.contact_interactions
 * and alerts Slack on new inbound messages so the team can follow up.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const event = body.event || body.type || ""
    const chat = body.chat || body
    const message = body.message || body.data || {}

    const fromNumber = chat.from_number || body.from_number || ""
    const toNumber = chat.to_number || body.to_number || ""

    // Determine which number is the lead
    const premeNumbers = new Set([
      "+14709425787", "+14707301614", "+14709342303",
      "+14704706861", "+14708024973", "+14709286438",
      "+14706196417", "+14708353966", "+14707405808",
    ])
    const leadPhone = premeNumbers.has(fromNumber) ? toNumber : fromNumber
    const isInbound = !premeNumbers.has(fromNumber)

    if (!leadPhone) {
      return NextResponse.json({ ok: true, skipped: "no_phone" })
    }

    const supabase = premeClient()

    // Handle message events
    if (event === "message_received" || event === "chat_message") {
      const content = message.content || message.text || body.content || ""
      const role = message.role || body.role || (isInbound ? "user" : "agent")

      if (content) {
        await supabase.from("contact_interactions").insert({
          phone: leadPhone,
          channel: "sms",
          direction: role === "user" ? "inbound" : "outbound",
          content,
          metadata: {
            chat_id: chat.chat_id || body.chat_id,
            source: "retell_sms_webhook",
          },
        })

        // On inbound lead reply: cancel cadence + alert Slack + sync to GHL
        if (role === "user") {
          // GHL contact_id stored in chat metadata at send time — no Supabase lookup needed
          const ghlContactId = (chat.metadata?.contact_id as string | undefined) ||
            (body.metadata?.contact_id as string | undefined)

          // Also try Supabase for cadence cancellation (lead.id needed)
          const rawDigits = leadPhone.replace(/\D/g, "")
          const phoneVariants = [leadPhone]
          if (rawDigits.length === 11 && rawDigits.startsWith("1")) {
            phoneVariants.push(rawDigits.slice(1))
          } else if (rawDigits.length === 10) {
            phoneVariants.push(`+1${rawDigits}`)
          }

          const { data: lead } = await supabase
            .from("leads")
            .select("id, first_name, last_name")
            .or(phoneVariants.map(p => `phone.eq.${p}`).join(","))
            .limit(1)
            .maybeSingle()

          const name = lead
            ? `${lead.first_name} ${lead.last_name}`
            : leadPhone

          // Cancel remaining cadence — lead is engaged via text
          if (lead?.id) {
            const { cancelled } = await cancelRemainingCadence(
              lead.id,
              "inbound_sms_reply"
            )
            if (cancelled > 0) {
              console.log(`[sms-memory] Cancelled ${cancelled} cadence steps for ${name} — inbound SMS reply`)
            }
          }

          // Sync inbound reply to GHL conversation thread
          if (ghlContactId) {
            void syncSmsToGhl(ghlContactId, "inbound", content).catch((err) =>
              console.error(`[sms-memory] GHL inbound sync failed (contact=${ghlContactId}):`, err),
            )
          } else {
            console.warn(`[sms-memory] No ghl_contact_id in chat metadata — inbound reply NOT synced to GHL (phone=${leadPhone})`)
          }

          await slackAlert(
            `*Inbound SMS Reply*\n` +
            `From: ${name} (${leadPhone})\n` +
            `Message: "${content.slice(0, 200)}"\n` +
            `_Cadence auto-cancelled. Lead is engaged — reply needed._`
          )
        }
      }
    }

    // Handle chat_ended — capture any missed messages
    if (event === "chat_ended" || event === "chat_analyzed") {
      const messages = chat.message_with_tool_calls || body.messages || []

      for (const msg of messages) {
        if (msg.content && msg.role === "user") {
          // Check if we already have this message
          const { count } = await supabase
            .from("contact_interactions")
            .select("id", { count: "exact", head: true })
            .eq("phone", leadPhone)
            .eq("channel", "sms")
            .eq("direction", "inbound")
            .eq("content", msg.content)

          if (!count || count === 0) {
            await supabase.from("contact_interactions").insert({
              phone: leadPhone,
              channel: "sms",
              direction: "inbound",
              content: msg.content,
              metadata: {
                chat_id: chat.chat_id || body.chat_id,
                message_id: msg.message_id,
                source: "retell_sms_chat_ended",
              },
            })
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[sms-memory] Webhook error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
