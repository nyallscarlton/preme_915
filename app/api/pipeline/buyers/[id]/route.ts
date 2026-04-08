import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
// Stripe billing not yet active — stubbed
const pauseBuyer = async (id: string, reason: string) => ({ paused: true, id, reason })
const resumeBuyer = async (id: string) => ({ paused: false, id })

// GET /api/pipeline/buyers/[id] — Buyer detail with recent calls and transactions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()

  // Get buyer with vertical info
  const { data: buyer, error } = await supabase
    .from("zx_buyers")
    .select("*, zx_verticals(slug, name)")
    .eq("id", params.id)
    .single()

  if (error || !buyer) {
    return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
  }

  // Get recent calls and transactions in parallel
  const [callsRes, transactionsRes] = await Promise.all([
    supabase
      .from("zx_calls")
      .select("*")
      .eq("buyer_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("zx_buyer_transactions")
      .select("*")
      .eq("buyer_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({
    buyer,
    calls: callsRes.data || [],
    transactions: transactionsRes.data || [],
  })
}

// PATCH /api/pipeline/buyers/[id] — Update buyer settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    // Handle pause/resume via stripe lib
    if (body.action === "pause") {
      const result = await pauseBuyer(params.id, body.reason || "Manual pause by admin")
      return NextResponse.json({ success: true, ...result })
    }

    if (body.action === "resume") {
      const result = await resumeBuyer(params.id)
      return NextResponse.json({ success: true, ...result })
    }

    // Standard field updates
    const allowedFields = [
      "name", "phone", "email", "service_area", "webhook_url", "webhook_secret",
      "pricing_model", "price_per_lead", "active", "auto_recharge_enabled",
      "auto_recharge_threshold", "auto_recharge_amount", "max_concurrent_calls",
      "stripe_customer_id",
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("zx_buyers")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ buyer: data })
  } catch (error) {
    console.error("[admin/buyers] PATCH error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
