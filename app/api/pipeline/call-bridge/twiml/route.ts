import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/pipeline/call-bridge/twiml
 * TwiML that plays when admin picks up: "Press 1 to connect to [lead name]"
 * On pressing 1, bridges to the lead's number with recording.
 */
export async function POST(request: NextRequest) {
  return handleTwiml(request)
}

export async function GET(request: NextRequest) {
  return handleTwiml(request)
}

function handleTwiml(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const leadPhone = searchParams.get("leadPhone") || ""
  const leadName = searchParams.get("leadName") || "a lead"
  const leadId = searchParams.get("leadId") || ""
  const callerId = searchParams.get("callerId") || process.env.PREME_OUTBOUND_CALLER_ID || "+14707405808"

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.zyntrxmarketing.com"

  // Check if this is a digit callback (user pressed a key)
  const digits = new URL(request.url).searchParams.get("Digits")

  if (digits === "1") {
    // Connect to lead
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now.</Say>
  <Dial record="record-from-answer-dual" recordingStatusCallback="${baseUrl}/api/pipeline/call-bridge/recording?leadId=${encodeURIComponent(leadId)}&amp;leadPhone=${encodeURIComponent(leadPhone)}&amp;leadName=${encodeURIComponent(leadName)}" recordingStatusCallbackEvent="completed" callerId="${callerId}">
    <Number>${leadPhone}</Number>
  </Dial>
  <Say voice="alice">The call has ended.</Say>
</Response>`
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    })
  }

  // Initial prompt: gather digit input
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="${baseUrl}/api/pipeline/call-bridge/twiml?leadPhone=${encodeURIComponent(leadPhone)}&amp;leadName=${encodeURIComponent(leadName)}&amp;leadId=${encodeURIComponent(leadId)}&amp;callerId=${encodeURIComponent(callerId)}" method="GET">
    <Say voice="alice">Incoming call bridge to ${leadName}. Press 1 to connect.</Say>
  </Gather>
  <Say voice="alice">No input received. Goodbye.</Say>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}
