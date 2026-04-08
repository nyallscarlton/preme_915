import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { createZentrxClient } from "@/lib/supabase/admin"

const ADMIN_PHONE = process.env.ADMIN_PHONE || "+19453088322"
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || "+14709167713"

/**
 * POST /api/pipeline/call-bridge
 * Click-to-call: calls admin's phone, press 1 to connect to lead.
 * Call is recorded and stored in the lead's thread.
 */
export async function POST(request: NextRequest) {
  const { leadId, leadPhone, leadName } = await request.json()

  if (!leadPhone) {
    return NextResponse.json({ error: "Lead phone required" }, { status: 400 })
  }

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )

  // Normalize lead phone to E.164
  const digits = leadPhone.replace(/\D/g, "")
  const e164Lead = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

  // Use the production domain — VERCEL_URL points to auth-protected preview deployments
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.zyntrxmarketing.com"

  try {
    // Step 1: Call admin's phone
    const call = await client.calls.create({
      to: ADMIN_PHONE,
      from: TWILIO_PHONE,
      url: `${baseUrl}/api/pipeline/call-bridge/twiml?leadPhone=${encodeURIComponent(e164Lead)}&leadName=${encodeURIComponent(leadName || "a lead")}&leadId=${encodeURIComponent(leadId || "")}`,
      statusCallback: `${baseUrl}/api/pipeline/call-bridge/status?leadId=${encodeURIComponent(leadId || "")}&leadPhone=${encodeURIComponent(e164Lead)}`,
      statusCallbackEvent: ["completed"],
      statusCallbackMethod: "POST",
      record: true,
      recordingStatusCallback: `${baseUrl}/api/pipeline/call-bridge/recording?leadId=${encodeURIComponent(leadId || "")}&leadPhone=${encodeURIComponent(e164Lead)}&leadName=${encodeURIComponent(leadName || "")}`,
      recordingStatusCallbackEvent: ["completed"],
    })

    // Log the bridge call + auto-cancel all sequences (you're talking to them now)
    if (leadId) {
      const supabase = createZentrxClient()
      await supabase.from("zx_lead_events").insert({
        lead_id: leadId,
        event_type: "manual_call_bridge",
        event_data: {
          twilio_call_sid: call.sid,
          admin_phone: ADMIN_PHONE,
          lead_phone: e164Lead,
        },
      })

      // DO NOT cancel sequences when clicking Call — only cancel when explicitly
      // clicking "Spoke with Lead" or "Not Qualified" in the portal
      // Just log the call bridge event
      await supabase.from("zx_lead_events").insert({
        lead_id: leadId,
        event_type: "manual_call_initiated",
        event_data: { source: "call_bridge" },
      })
    }

    return NextResponse.json({ success: true, callSid: call.sid })
  } catch (err) {
    console.error("[call-bridge] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
