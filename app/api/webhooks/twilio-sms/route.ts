import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

    // Find matching lead by last 10 digits of phone
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .or(`phone.ilike.%${digits}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lead) {
      await supabase.from("lead_messages").insert({
        lead_id: lead.id,
        direction: "inbound",
        body,
        from_number: from,
        to_number: to || "+14709425787",
        twilio_sid: sid || null,
        status: "received",
      })
    } else {
      // Log unmatched inbound SMS for debugging
      console.warn(
        `[twilio-sms] Inbound from ${from} — no matching lead found for digits ${digits}`
      )
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
