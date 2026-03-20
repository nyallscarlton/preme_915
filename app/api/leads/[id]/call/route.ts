import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID!
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN!
const PREME_NUMBER = process.env.RETELL_PREME_PHONE_NUMBER || "+14709425787"
const OWNER_PHONE = process.env.OWNER_PHONE || "+19453088322"

/**
 * POST — Initiate a call that connects YOU to the lead.
 *
 * Flow:
 * 1. Twilio calls YOUR phone from the Preme number
 * 2. When you pick up, Twilio bridges you to the lead's number
 * 3. The lead sees the Preme caller ID
 * 4. Call is recorded for the messages thread
 *
 * Optional body: { mode: "ai" } to have Riley (AI agent) call instead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    let body: { mode?: string } = {}
    try {
      body = await request.json()
    } catch {
      // No body — default to direct call
    }

    const admin = createAdminClient()

    // Get lead data
    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .single()

    if (leadErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    if (!lead.phone) {
      return NextResponse.json(
        { error: "Lead has no phone number" },
        { status: 400 }
      )
    }

    const digits = lead.phone.replace(/\D/g, "")
    const leadE164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    // --- AI mode: have Riley call the lead ---
    if (body.mode === "ai") {
      const { triggerOutboundCall } = await import("@/lib/retell")
      const result = await triggerOutboundCall({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        loan_type: lead.loan_type || undefined,
        source: lead.source || undefined,
      })

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 502 })
      }

      await admin
        .from("leads")
        .update({ retell_call_id: result.call_id, status: lead.status === "new" ? "contacted" : lead.status, updated_at: new Date().toISOString() })
        .eq("id", params.id)

      await admin.from("lead_messages").insert({
        lead_id: params.id,
        direction: "outbound",
        type: "call",
        body: `🤖 Riley calling ${lead.first_name} ${lead.last_name}`,
        from_number: PREME_NUMBER,
        to_number: leadE164,
        metadata: { call_id: result.call_id, status: "initiated", mode: "ai" },
      })

      return NextResponse.json({ success: true, call_id: result.call_id, mode: "ai" })
    }

    // --- Direct mode: call YOUR phone, bridge to lead ---
    const twiml = `<Response><Dial callerId="${PREME_NUMBER}" record="record-from-answer-dual" recordingStatusCallback="https://www.premerealestate.com/api/webhooks/twilio-recording?lead_id=${params.id}"><Number>${leadE164}</Number></Dial></Response>`

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`
    const twilioAuth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")

    const callParams = new URLSearchParams({
      From: PREME_NUMBER,
      To: OWNER_PHONE,
      Twiml: twiml,
      Record: "true",
      StatusCallback: `https://www.premerealestate.com/api/webhooks/twilio-call-status?lead_id=${params.id}`,
      StatusCallbackEvent: "completed",
    })

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: callParams.toString(),
    })

    const twilioData = await twilioRes.json()

    if (!twilioRes.ok) {
      console.error("[call] Twilio error:", twilioData)
      return NextResponse.json(
        { error: twilioData.message || "Failed to initiate call" },
        { status: 502 }
      )
    }

    // Update lead status
    await admin
      .from("leads")
      .update({
        status: lead.status === "new" ? "contacted" : lead.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)

    // Log to messages thread
    await admin.from("lead_messages").insert({
      lead_id: params.id,
      direction: "outbound",
      type: "call",
      body: `📞 Calling ${lead.first_name} ${lead.last_name}...`,
      from_number: PREME_NUMBER,
      to_number: leadE164,
      metadata: {
        twilio_sid: twilioData.sid,
        status: "initiated",
        mode: "direct",
      },
    })

    return NextResponse.json({
      success: true,
      call_sid: twilioData.sid,
      mode: "direct",
    })
  } catch (err) {
    console.error("[call] API error:", err)
    return NextResponse.json(
      { error: "Failed to initiate call" },
      { status: 500 }
    )
  }
}
