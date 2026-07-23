import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const NYALLS_CELL = "+19453088322"

/**
 * POST /api/twilio/forward-to-nyalls
 *
 * Twilio voice webhook for Nyalls's direct line (+14706341105).
 * Returns TwiML that forwards the call straight to Nyalls's cell.
 * No AI, no Riley, just a direct ring.
 */
export async function POST(request: NextRequest) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+14706341105" timeout="25" record="record-from-answer">
    <Number>${NYALLS_CELL}</Number>
  </Dial>
  <Say>Nyalls is unavailable right now. Please leave a message after the beep.</Say>
  <Record maxLength="120" transcribe="true" />
</Response>`

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}

/**
 * GET handler for Twilio (some callbacks use GET)
 */
export async function GET(request: NextRequest) {
  return POST(request)
}
