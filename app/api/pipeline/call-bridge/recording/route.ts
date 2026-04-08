import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { storeInteraction } from "@/lib/memory"

/**
 * POST /api/pipeline/call-bridge/recording
 * Twilio calls this when a recording is ready.
 * Stores the recording URL in the lead's thread.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get("leadId") || ""
  const leadPhone = searchParams.get("leadPhone") || ""
  const leadName = searchParams.get("leadName") || ""

  // Parse Twilio form data
  const formData = await request.formData()
  const recordingUrl = formData.get("RecordingUrl") as string
  const recordingSid = formData.get("RecordingSid") as string
  const recordingDuration = parseInt(formData.get("RecordingDuration") as string || "0")
  const callSid = formData.get("CallSid") as string

  // Twilio recording URLs need .mp3 appended
  const audioUrl = recordingUrl ? `${recordingUrl}.mp3` : null

  const supabase = createAdminClient()

  // Store in lead events
  if (leadId) {
    await supabase.from("zx_lead_events").insert({
      lead_id: leadId,
      event_type: "manual_call_recording",
      event_data: {
        recording_url: audioUrl,
        recording_sid: recordingSid,
        recording_duration: recordingDuration,
        call_sid: callSid,
        lead_name: leadName,
      },
    })

    // Update lead status to contacted
    await supabase
      .from("zx_leads")
      .update({ status: "contacted" })
      .eq("id", leadId)
      .in("status", ["new", "contacting", "calling"])
  }

  // Store in contact interactions so it shows in the unified thread
  if (leadPhone) {
    await storeInteraction(leadPhone, {
      channel: "voice",
      direction: "outbound",
      content: null,
      summary: `Manual call to ${leadName || "lead"} (${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, "0")})`,
      metadata: {
        recording_url: audioUrl,
        recording_sid: recordingSid,
        duration_ms: recordingDuration * 1000,
        call_sid: callSid,
        call_type: "manual_bridge",
      },
    }).catch(err => console.error("[call-bridge] Failed to store interaction:", err))
  }

  return NextResponse.json({ ok: true })
}
