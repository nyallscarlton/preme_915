import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/dscr/lenders — Fetch all active DSCR lenders
// Admin/service-role only — never exposed to borrowers
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("dscr_lenders")
    .select("*")
    .eq("active", true)
    .order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
