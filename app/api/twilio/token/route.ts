/**
 * Generate a Twilio access token for browser-based Voice calling.
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import twilio from "twilio"

export const dynamic = "force-dynamic"

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID!
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET!
const TWILIO_TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID!

export async function GET() {
  try {
    // Auth check
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { AccessToken } = twilio.jwt
    const { VoiceGrant } = AccessToken

    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      { identity: `preme-admin-${user.id.substring(0, 8)}`, ttl: 3600 }
    )

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: false,
    })
    token.addGrant(voiceGrant)

    return NextResponse.json({ token: token.toJwt() })
  } catch (err) {
    console.error("[twilio/token] Error:", err)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
