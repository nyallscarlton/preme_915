import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/conditions/loans — returns all active loans with blocking counts
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data: loans, error } = await supabase
      .from("loans")
      .select("*")
      .eq("status", "Active")
      .order("closing_date", { ascending: true, nullsFirst: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get blocking counts per loan
    const loansWithBlocking = await Promise.all(
      (loans ?? []).map(async (loan) => {
        const { count } = await supabase
          .from("loan_conditions")
          .select("*", { count: "exact", head: true })
          .eq("loan_id", loan.id)
          .eq("is_blocking", true)
          .eq("status", "Open")
        return { ...loan, has_blocking: (count ?? 0) > 0 }
      })
    )

    return NextResponse.json(loansWithBlocking)
  } catch (error) {
    console.error("[conditions/loans] Error:", error)
    return NextResponse.json({ error: "Failed to fetch loans" }, { status: 500 })
  }
}
