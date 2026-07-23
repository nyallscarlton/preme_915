import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const NYALLS_CELL = "+19453088322"
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || ""
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || ""
const FORWARD_FROM = "+14703159898" // Standalone Twilio number for outbound bridges

/**
 * POST /api/webhooks/retell/forward-to-nyalls
 *
 * Retell hits this when someone calls +14708353966 (Nyalls Direct Line).
 * No AI agent — just forward the call to Nyalls's cell via Twilio.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const callerNumber = body.from_number || body.caller_number || body.from || ""

    console.log(`[forward-to-nyalls] Incoming call from ${callerNumber} → forwarding to ${NYALLS_CELL}`)

    // Use Twilio to bridge the caller to Nyalls's cell
    const twilioAuth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64")

    // Create a TwiML response that dials Nyalls
    const twimlUrl = `https://www.premerealestate.com/api/webhooks/retell/forward-to-nyalls/twiml?caller=${encodeURIComponent(callerNumber)}`

    const callParams = new URLSearchParams({
      To: NYALLS_CELL,
      From: FORWARD_FROM,
      Url: twimlUrl,
      Timeout: "30",
      StatusCallback: `https://www.premerealestate.com/api/webhooks/retell/forward-to-nyalls/status`,
      StatusCallbackMethod: "POST",
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: callParams.toString(),
      }
    )

    if (res.ok) {
      const data = await res.json()
      console.log(`[forward-to-nyalls] Call initiated: ${data.sid}`)
      return NextResponse.json({ ok: true, call_sid: data.sid })
    } else {
      const err = await res.text()
      console.error(`[forward-to-nyalls] Twilio error: ${res.status} ${err}`)
      return NextResponse.json({ ok: false, error: err }, { status: 500 })
    }
  } catch (error) {
    console.error("[forward-to-nyalls] Error:", error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

/**
 * GET /api/webhooks/retell/forward-to-nyalls/twiml
 * Returns TwiML that whispers the caller info then connects
 */
export async function GET(request: NextRequest) {
  const caller = request.nextUrl.searchParams.get("caller") || "Unknown"

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Incoming call from a Preme lead.</Say>
  <Dial callerId="${FORWARD_FROM}" timeout="25">
    <Number>${NYALLS_CELL}</Number>
  </Dial>
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}
