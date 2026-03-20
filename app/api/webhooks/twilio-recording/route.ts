/**
 * Twilio Recording Status Webhook
 * Updates the lead_messages entry with the recording URL when ready.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const callSid = formData.get("CallSid") as string
    const recordingUrl = formData.get("RecordingUrl") as string
    const recordingDuration = formData.get("RecordingDuration") as string
    const leadId = request.nextUrl.searchParams.get("lead_id")

    if (!callSid || !recordingUrl) {
      return new NextResponse("OK", { status: 200 })
    }

    // Twilio recording URLs need .mp3 appended for playback
    const playableUrl = `${recordingUrl}.mp3`

    const supabase = createAdminClient()

    // Find the message entry by twilio_sid
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
          metadata: {
            ...meta,
            recording_url: playableUrl,
            recording_duration: parseInt(recordingDuration || "0"),
          },
        })
        .eq("id", msgs[0].id)

      console.log(`[twilio-recording] Saved recording for call ${callSid}`)
    }

    return new NextResponse("OK", { status: 200 })
  } catch (err) {
    console.error("[twilio-recording] Error:", err)
    return new NextResponse("OK", { status: 200 })
  }
}
