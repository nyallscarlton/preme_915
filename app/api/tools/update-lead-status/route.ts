import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

/**
 * POST /api/tools/update-lead-status
 * Riley calls this after a conversation to update the lead's status and add notes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const args = body.args || body
    const phone = args.phone || ""
    const status = args.status || ""
    const reason = args.reason || ""
    const temperature = args.temperature || ""

    if (!phone || !status) {
      return NextResponse.json({ result: "Missing phone or status." })
    }

    const digits = phone.replace(/\D/g, "").slice(-10)
    if (digits.length < 10) {
      return NextResponse.json({ result: "Invalid phone number." })
    }

    // Find the lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id, status, custom_fields")
      .like("phone", `%${digits}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lead) {
      return NextResponse.json({ result: "Lead not found for this phone number." })
    }

    // Validate status
    const validStatuses = ["contacted", "qualified", "not_qualified", "dead"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ result: `Invalid status. Use one of: ${validStatuses.join(", ")}` })
    }

    // Update lead
    const updates: Record<string, unknown> = { status }
    if (temperature) updates.temperature = temperature

    await supabase.from("leads").update(updates).eq("id", lead.id)

    // Log the status change with reason
    await supabase.from("lead_events").insert({
      lead_id: lead.id,
      event_type: "status_changed",
      event_data: {
        new_status: status,
        reason,
        temperature: temperature || null,
        source: "riley_call",
      },
    })

    // Add a note
    if (reason) {
      await supabase.from("zx_lead_notes").insert({
        lead_id: lead.id,
        content: `Riley: ${reason}`,
        author: "riley",
      })
    }

    // If not_qualified or dead, cancel active sequences
    if (status === "not_qualified" || status === "dead") {
      await supabase
        .from("sequence_enrollments")
        .update({ status: "cancelled", pause_reason: `riley_${status}` })
        .eq("lead_id", lead.id)
        .eq("status", "active")
    }

    return NextResponse.json({
      result: `Lead status updated to ${status}${reason ? ". Reason: " + reason : ""}. ${status === "not_qualified" || status === "dead" ? "Follow-up sequences cancelled." : ""}`,
    })
  } catch (error) {
    console.error("[update-lead-status] Error:", error)
    return NextResponse.json({ result: "Failed to update lead status." })
  }
}
