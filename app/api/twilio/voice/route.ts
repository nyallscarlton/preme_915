/**
 * TwiML Voice Handler — called by Twilio when the browser client connects.
 * Returns TwiML that dials the lead's number with Preme caller ID and recording.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const PREME_NUMBER = process.env.RETELL_PREME_PHONE_NUMBER || "+14709425787"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const toNumber = formData.get("To") as string
    const leadId = formData.get("lead_id") as string

    if (!toNumber) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No number provided.</Say></Response>`,
        { headers: { "Content-Type": "application/xml" } }
      )
    }

    // Log to messages thread
    if (leadId) {
      const supabase = createAdminClient()
      await supabase.from("lead_messages").insert({
        lead_id: leadId,
        direction: "outbound",
        type: "call",
        body: `📞 Calling...`,
        from_number: PREME_NUMBER,
        to_number: toNumber,
        metadata: { status: "initiated", mode: "browser" },
      }).catch(() => {})
    }

    // TwiML: dial the lead with Preme caller ID, record the call
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${PREME_NUMBER}" record="record-from-answer-dual" recordingStatusCallback="https://www.premerealestate.com/api/webhooks/twilio-recording${leadId ? `?lead_id=${leadId}` : ""}">
    <Number>${toNumber}</Number>
  </Dial>
</Response>`

    return new NextResponse(twiml, {
      headers: { "Content-Type": "application/xml" },
    })
  } catch (err) {
    console.error("[twilio/voice] Error:", err)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>`,
      { headers: { "Content-Type": "application/xml" } }
    )
  }
}
