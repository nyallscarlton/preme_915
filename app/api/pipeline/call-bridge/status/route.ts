import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/pipeline/call-bridge/status
 * Twilio calls this when the bridge call completes.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get("leadId") || ""

  const formData = await request.formData()
  const callStatus = formData.get("CallStatus") as string
  const callDuration = formData.get("CallDuration") as string
  const callSid = formData.get("CallSid") as string

  if (leadId) {
    const supabase = createAdminClient()
    await supabase.from("zx_lead_events").insert({
      lead_id: leadId,
      event_type: "manual_call_ended",
      event_data: {
        call_sid: callSid,
        status: callStatus,
        duration: parseInt(callDuration || "0"),
      },
    })
  }

  return NextResponse.json({ ok: true })
}
