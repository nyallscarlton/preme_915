import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createZentrxClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST — Twilio inbound SMS webhook (public, no auth)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get("From") as string
    const body = formData.get("Body") as string
    const sid = formData.get("MessageSid") as string
    const to = formData.get("To") as string

    if (!from || !body) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "application/xml" } }
      )
    }

    const supabase = createAdminClient()
    const digits = from.replace(/\D/g, "").slice(-10)
    const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    // Find matching lead in preme.leads (same digits-suffix logic the rest of the system uses)
    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name")
      .or(`phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Always log to preme.contact_interactions (single source of truth for inbound SMS).
    // The legacy preme.lead_messages table was never created — writes were silently failing.
    // Switched 2026-04-08 after 7+ days of dead inbound SMS pipeline.
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
      console.warn(
        `[twilio-sms] Inbound from ${from} — no matching Preme lead for digits ${digits} (logged to contact_interactions anyway)`
      )
    } else {
      // Also create a lead event so the portal thread shows the inbound message
      await zxClient.from("lead_events").insert({
        lead_id: lead.id,
        event_type: "sms_inbound",
        event_data: { content: body, from: from, twilio_sid: sid || null },
      }).then(() => {}, (e: unknown) => console.warn("[twilio-sms] lead_events insert failed:", e))
    }

    // Return empty TwiML (no auto-reply)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "application/xml" } }
    )
  } catch (err) {
    console.error("[twilio-sms] Webhook error:", err)
    // Always return valid TwiML even on error
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "application/xml" } }
    )
  }
}
