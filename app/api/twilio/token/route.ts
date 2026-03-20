/**
 * Generate a Twilio access token for browser-based Voice calling.
 * The token grants the browser permission to make outbound calls
 * through the TwiML App.
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"

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
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build Twilio access token manually using JWT
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      jti: `${TWILIO_API_KEY_SID}-${now}`,
      iss: TWILIO_API_KEY_SID,
      sub: TWILIO_ACCOUNT_SID,
      exp: now + 3600, // 1 hour
      grants: {
        identity: `preme-admin-${user.id.substring(0, 8)}`,
        voice: {
          outgoing: {
            application_sid: TWILIO_TWIML_APP_SID,
          },
        },
      },
    }

    const token = jwt.sign(payload, TWILIO_API_KEY_SECRET, {
      algorithm: "HS256",
      header: {
        typ: "JWT",
        alg: "HS256",
        cty: "twilio-fpa;v=1",
      },
    })

    return NextResponse.json({ token })
  } catch (err) {
    console.error("[twilio/token] Error:", err)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
}
