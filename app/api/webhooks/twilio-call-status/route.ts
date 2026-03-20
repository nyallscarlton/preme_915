/**
 * Twilio Call Status Webhook
 * Updates the lead_messages entry when a direct call completes.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const callSid = formData.get("CallSid") as string
    const callStatus = formData.get("CallStatus") as string
    const duration = formData.get("CallDuration") as string
    const leadId = request.nextUrl.searchParams.get("lead_id")

    if (!callSid) {
      return new NextResponse("OK", { status: 200 })
    }

    const supabase = createAdminClient()
    const durationSec = parseInt(duration || "0")
    const durationStr = durationSec > 0 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : "0s"

    // Update the message entry
    const { data: msgs } = await supabase
      .from("lead_messages")
      .select("id, metadata")
      .eq("type", "call")
      .filter("metadata->>twilio_sid", "eq", callSid)
      .limit(1)

    if (msgs && msgs.length > 0) {
      const meta = (msgs[0].metadata as Record<string, unknown>) || {}
      await supabase
        .from("lead_messages")
        .update({
          body: `📞 Call — ${callStatus === "completed" ? durationStr : callStatus}`,
          metadata: {
            ...meta,
            status: callStatus,
            duration_sec: durationSec,
            duration_str: durationStr,
          },
        })
        .eq("id", msgs[0].id)
    }

    return new NextResponse("OK", { status: 200 })
  } catch (err) {
    console.error("[twilio-call-status] Error:", err)
    return new NextResponse("OK", { status: 200 })
  }
}
