import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { triageConditions, type TriageInput } from "@/lib/triage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST /api/conditions/triage
// Triage (or re-triage) open conditions for a loan.
// Body: { loan_id: string, condition_ids?: string[] }
// If condition_ids provided, only triage those. Otherwise triage all open conditions.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { loan_id, condition_ids } = body as {
      loan_id: string
      condition_ids?: string[]
    }

    if (!loan_id) {
      return NextResponse.json(
        { success: false, error: "loan_id is required" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get loan for closing date context
    const { data: loan } = await supabase
      .from("loans")
      .select("closing_date")
      .eq("id", loan_id)
      .single()

    // Fetch conditions to triage
    let query = supabase
      .from("loan_conditions")
      .select("id, title, description, description_details, category, prior_to, status, sub_status, condition_type")
      .eq("loan_id", loan_id)

    if (condition_ids && condition_ids.length > 0) {
      query = query.in("id", condition_ids)
    } else {
      // Default: only open conditions
      query = query.eq("status", "Open")
    }

    const { data: conditions, error: fetchErr } = await query

    if (fetchErr || !conditions) {
      return NextResponse.json(
        { success: false, error: fetchErr?.message ?? "No conditions found" },
        { status: 400 }
      )
    }

    if (conditions.length === 0) {
      return NextResponse.json({
        success: true,
        triaged: 0,
        message: "No open conditions to triage",
      })
    }

    // Run AI triage
    const inputs: TriageInput[] = conditions.map((c) => ({
      title: c.title,
      description: c.description,
      description_details: c.description_details,
      category: c.category,
      prior_to: c.prior_to,
      status: c.status,
      sub_status: c.sub_status,
      condition_type: c.condition_type,
    }))

    const results = await triageConditions(inputs, loan?.closing_date)

    // Write triage results back to DB
    let updated = 0
    for (let i = 0; i < conditions.length; i++) {
      const result = results[i]
      const { error: updateErr } = await supabase
        .from("loan_conditions")
        .update({
          action_owner: result.action_owner,
          action_owner_name: result.action_owner_name,
          priority: result.priority,
          is_blocking: result.is_blocking,
          action_summary: result.action_summary,
        })
        .eq("id", conditions[i].id)

      if (!updateErr) updated++
    }

    return NextResponse.json({
      success: true,
      triaged: updated,
      results: conditions.map((c, i) => ({
        id: c.id,
        title: c.title,
        ...results[i],
      })),
    })
  } catch (error) {
    console.error("[conditions/triage] Error:", error)
    return NextResponse.json(
      { success: false, error: "Triage failed — see server logs" },
      { status: 500 }
    )
  }
}
