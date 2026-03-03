import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { matchAllLenders, type DscrApplication, type DscrLender } from "@/lib/dscr-matcher"

// POST /api/dscr/match — Run lender matching engine
// Admin/service-role only — never exposed to borrowers
export async function POST(req: NextRequest) {
  const body = await req.json()
  const app: DscrApplication = body.application

  if (!app || !app.state || !app.propertyType || !app.loanPurpose) {
    return NextResponse.json({ error: "Missing required application fields" }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: lenders, error } = await supabase
    .from("dscr_lenders")
    .select("*")
    .eq("active", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = matchAllLenders(app, lenders as DscrLender[])

  // Save match results for audit trail if requested
  if (body.save) {
    await supabase.from("dscr_match_results").insert({
      application_id: body.applicationId || null,
      application_snapshot: app,
      qualified_count: results.qualifiedCount,
      disqualified_count: results.disqualifiedCount,
      results,
      matched_by: body.matchedBy || null,
    })
  }

  return NextResponse.json(results)
}
