import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/pipeline/apollo/export-csv?metro=dallas
 *
 * Export prospected buyers as CSV for Instantly upload.
 * Only exports buyers with status "prospected" and valid emails.
 * Includes merge fields: first_name, last_name, email, company, city, market
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = request.nextUrl
  const metro = searchParams.get("metro")

  // Get water-damage vertical
  const { data: vertical } = await supabase
    .from("zx_verticals")
    .select("id")
    .eq("slug", "water-damage")
    .single()

  if (!vertical) {
    return NextResponse.json({ error: "Water damage vertical not found" }, { status: 404 })
  }

  let query = supabase
    .from("zx_buyers")
    .select("*")
    .eq("vertical_id", vertical.id)
    .eq("active", false) // only prospected (not yet onboarded)
    .not("email", "is", null)
    .neq("email", "")

  if (metro) {
    query = query.contains("service_area", [metro])
  }

  const { data: buyers, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!buyers?.length) {
    return NextResponse.json({ error: "No prospected buyers found" }, { status: 404 })
  }

  // Build CSV
  const headers = ["email", "first_name", "last_name", "company_name", "city", "market", "title"]
  const rows = buyers.map((b) => {
    const meta = (b.metadata || {}) as Record<string, string>
    const nameParts = (meta.contact_name || "").split(" ")
    const firstName = nameParts[0] || ""
    const lastName = nameParts.slice(1).join(" ") || ""
    const city = meta.city || ""
    const market = (b.service_area as string[])?.[0] || ""
    const title = meta.contact_title || ""

    return [
      b.email,
      firstName,
      lastName,
      b.name,
      city,
      market,
      title,
    ].map((v) => `"${(v || "").replace(/"/g, '""')}"`)
      .join(",")
  })

  const csv = [headers.join(","), ...rows].join("\n")
  const filename = metro
    ? `instantly-prospects-${metro}-${new Date().toISOString().slice(0, 10)}.csv`
    : `instantly-prospects-all-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
