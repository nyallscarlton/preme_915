import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createZentrxClient } from "@/lib/supabase/admin"
import { cancelRemainingCadence } from "@/lib/preme-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "xoxb-10810278616865-10793966886901-IkgPJuagaGNceBA2WFIysKbC"
const PREME_CHANNEL_ID = "C0APBULDQS1"

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "quit", "cancel", "opt out", "optout", "remove"]
const POSITIVE_KEYWORDS = ["yes", "interested", "call me", "help", "ready", "available", "please", "info", "apply", "start"]

function twiml(): NextResponse {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "application/xml" } }
  )
}

// POST — Twilio inbound SMS webhook (public, no auth)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get("From") as string
    const body = formData.get("Body") as string
    const sid = formData.get("MessageSid") as string
    const to = formData.get("To") as string

    if (!from || !body) return twiml()

    const supabase = createAdminClient()
    const digits = from.replace(/\D/g, "").slice(-10)
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`
    const bodyLower = body.trim().toLowerCase()

    // Find matching lead in preme.leads
    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name, last_name, phone, email, status")
      .or(`phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Log to contact_interactions (single source of truth for inbound SMS)
    const zxClient = createZentrxClient()
    await zxClient.from("contact_interactions").insert({
      phone: e164,
      channel: "sms",
      direction: "inbound",
      content: body,
      metadata: {
        from_number: from,
        to_number: to || null,
        twilio_sid: sid || null,
        matched_lead_id: lead?.id || null,
        matched_lead_name: lead?.first_name || null,
        source: "twilio_inbound_webhook",
      },
    })

    if (!lead) {
      console.warn(`[twilio-sms] Inbound from ${from} — no matching lead for digits ${digits}`)
      return twiml()
    }

    // Log lead event
    await zxClient.from("lead_events").insert({
      lead_id: lead.id,
      event_type: "sms_inbound",
      event_data: { content: body, from: from, twilio_sid: sid || null },
    }).then(() => {}, (e: unknown) => console.warn("[twilio-sms] lead_events insert failed:", e))

    // ── OPT-OUT HANDLING ──
    if (OPT_OUT_KEYWORDS.some((kw) => bodyLower === kw || bodyLower.includes(kw))) {
      // Cancel all cadence steps
      await cancelRemainingCadence(lead.id, "sms_opt_out")

      // Update lead status
      await supabase.from("leads").update({
        status: "opted_out",
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id)

      // Log opt-out event
      try {
        await zxClient.from("lead_events").insert({
          lead_id: lead.id,
          event_type: "sms_opt_out",
          event_data: { message: body, from: from },
        })
      } catch {}

      console.log(`[twilio-sms] Lead ${lead.id} (${lead.first_name}) opted out via "${body}"`)
      return twiml()
    }

    // ── POSITIVE REPLY HANDLING ──
    if (POSITIVE_KEYWORDS.some((kw) => bodyLower.includes(kw))) {
      // Post to #preme for immediate attention
      try {
        const leadName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim()
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: PREME_CHANNEL_ID,
            text: `\u{1F7E2} *Positive SMS reply*\n\u2022 Lead: ${leadName}\n\u2022 Phone: ${e164}\n\u2022 Message: "${body}"\n\u2022 Status: ${lead.status || "unknown"}\n\nNeeds immediate follow-up.`,
          }),
        })
      } catch (err) {
        console.error("[twilio-sms] Slack notification failed:", err)
      }

      // Log positive reply event
      try {
        await zxClient.from("lead_events").insert({
          lead_id: lead.id,
          event_type: "sms_positive_reply",
          event_data: { message: body, from: from },
        })
      } catch {}

      console.log(`[twilio-sms] Positive reply from ${lead.first_name}: "${body}" — posted to #preme`)
    }

    return twiml()
  } catch (err) {
    console.error("[twilio-sms] Webhook error:", err)
    return twiml()
  }
}
