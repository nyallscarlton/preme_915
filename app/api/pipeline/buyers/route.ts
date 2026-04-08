import { NextRequest, NextResponse } from "next/server"
import { createZentrxClient } from "@/lib/supabase/admin"

// GET /api/pipeline/buyers — List all buyers with balances, call counts, active status
export async function GET(request: NextRequest) {
  const supabase = createZentrxClient()
  const { searchParams } = request.nextUrl

  let query = supabase
    .from("zx_buyers")
    .select("*, zx_verticals(slug, name)")
    .order("created_at", { ascending: false })

  const active = searchParams.get("active")
  if (active !== null) {
    query = query.eq("active", active === "true")
  }

  const paused = searchParams.get("paused")
  if (paused !== null) {
    query = query.eq("paused", paused === "true")
  }

  const verticalId = searchParams.get("vertical_id")
  if (verticalId) {
    query = query.eq("vertical_id", verticalId)
  }

  const vertical = searchParams.get("vertical")
  if (vertical) {
    query = query.eq("zx_verticals.slug", vertical)
  }

  const { data: buyers, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get call counts for each buyer
  const buyerIds = (buyers || []).map((b) => b.id)
  const { data: callCounts } = await supabase
    .from("zx_calls")
    .select("buyer_id")
    .in("buyer_id", buyerIds)

  const countMap: Record<string, number> = {}
  for (const row of callCounts || []) {
    countMap[row.buyer_id] = (countMap[row.buyer_id] || 0) + 1
  }

  const { data: billableCounts } = await supabase
    .from("zx_calls")
    .select("buyer_id")
    .in("buyer_id", buyerIds)
    .eq("billable", true)

  const billableMap: Record<string, number> = {}
  for (const row of billableCounts || []) {
    billableMap[row.buyer_id] = (billableMap[row.buyer_id] || 0) + 1
  }

  const enriched = (buyers || []).map((buyer) => ({
    ...buyer,
    total_calls: countMap[buyer.id] || 0,
    billable_calls: billableMap[buyer.id] || 0,
  }))

  return NextResponse.json({ buyers: enriched })
}

// POST /api/pipeline/buyers — Create new buyer
export async function POST(request: NextRequest) {
  try {
    const supabase = createZentrxClient()
    const body = await request.json()

    const { name, phone, email, service_area, vertical_slug, webhook_url, webhook_secret, pricing_model, price_per_lead } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Resolve vertical
    let verticalId: string | null = null
    if (vertical_slug) {
      const { data: vertical } = await supabase
        .from("zx_verticals")
        .select("id")
        .eq("slug", vertical_slug)
        .single()

      if (!vertical) {
        return NextResponse.json({ error: "Invalid vertical" }, { status: 400 })
      }
      verticalId = vertical.id
    } else if (body.vertical_id) {
      verticalId = body.vertical_id
    } else {
      // Default to first active vertical
      const { data: vertical } = await supabase
        .from("zx_verticals")
        .select("id")
        .eq("active", true)
        .limit(1)
        .single()

      verticalId = vertical?.id || null
    }

    if (!verticalId) {
      return NextResponse.json({ error: "No vertical found" }, { status: 400 })
    }

    const { data: buyer, error } = await supabase
      .from("zx_buyers")
      .insert({
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        service_area: service_area || [],
        vertical_id: verticalId,
        webhook_url: webhook_url || "",
        webhook_secret: webhook_secret || null,
        pricing_model: pricing_model || "per_lead",
        price_per_lead: price_per_lead || 350,
        active: true,
        paused: false,
        balance: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[admin/buyers] Insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ buyer }, { status: 201 })
  } catch (error) {
    console.error("[admin/buyers] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
