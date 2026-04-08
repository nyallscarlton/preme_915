import { NextRequest, NextResponse } from "next/server"
import { createZentrxClient } from "@/lib/supabase/admin"
import { sendTelegram } from "@/lib/telegram"

// GET /api/pipeline/disputes — List all disputes (filterable by status)
export async function GET(request: NextRequest) {
  const supabase = createZentrxClient()
  const { searchParams } = request.nextUrl

  let query = supabase
    .from("zx_calls")
    .select("*, zx_buyers(name), zx_leads(first_name, last_name, phone)")
    .not("dispute_reason", "is", null)
    .order("disputed_at", { ascending: false })

  const outcome = searchParams.get("outcome")
  if (outcome) {
    query = query.eq("dispute_outcome", outcome)
  }

  const status = searchParams.get("status")
  if (status) {
    query = query.eq("status", status)
  }

  const buyerId = searchParams.get("buyer_id")
  if (buyerId) {
    query = query.eq("buyer_id", buyerId)
  }

  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ disputes: data || [] })
}

// POST /api/pipeline/disputes — Submit a dispute for a call
export async function POST(request: NextRequest) {
  try {
    const supabase = createZentrxClient()
    const body = await request.json()

    const { call_id, reason } = body

    if (!call_id) {
      return NextResponse.json({ error: "call_id is required" }, { status: 400 })
    }

    if (!reason?.trim()) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 })
    }

    // Get the call record
    const { data: call, error: callErr } = await supabase
      .from("zx_calls")
      .select("*, zx_buyers(name)")
      .eq("id", call_id)
      .single()

    if (callErr || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 })
    }

    if (call.status === "disputed") {
      return NextResponse.json({ error: "Call is already disputed" }, { status: 409 })
    }

    if (call.status === "refunded") {
      return NextResponse.json({ error: "Call has already been refunded" }, { status: 409 })
    }

    // Update call record with dispute info
    const { data: updated, error: updateErr } = await supabase
      .from("zx_calls")
      .update({
        status: "disputed",
        dispute_reason: reason.trim(),
        dispute_outcome: "pending",
        disputed_at: new Date().toISOString(),
      })
      .eq("id", call_id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Log event if there's a lead
    if (call.lead_id) {
      await supabase.from("zx_lead_events").insert({
        lead_id: call.lead_id,
        event_type: "call_disputed",
        event_data: {
          call_id: call.id,
          reason: reason.trim(),
          amount: call.amount_charged,
          buyer_id: call.buyer_id,
        },
      })
    }

    // Send Telegram notification for QA review
    const buyerName = (call as any).zx_buyers?.name || "Unknown"
    const message = [
      `⚠️ *Call Dispute — QA Review Needed*`,
      ``,
      `Buyer: ${buyerName}`,
      `Call ID: ${call.id}`,
      `Amount: $${call.amount_charged}`,
      `Duration: ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`,
      ``,
      `Reason: ${reason.trim()}`,
      ``,
      `Recording: ${call.recording_url || "N/A"}`,
    ].join("\n")

    await sendTelegram(message).catch(console.error)

    return NextResponse.json({ dispute: updated })
  } catch (error) {
    console.error("[admin/disputes] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
