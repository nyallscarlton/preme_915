import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// GET /api/conditions/loans/[loanId] — returns loan + all its conditions
export async function GET(
  _request: NextRequest,
  { params }: { params: { loanId: string } }
) {
  try {
    const supabase = createAdminClient()
    const { loanId } = params

    const [{ data: loan, error: loanErr }, { data: conditions, error: condErr }] =
      await Promise.all([
        supabase.from("loans").select("*").eq("id", loanId).single(),
        supabase
          .from("loan_conditions")
          .select("*")
          .eq("loan_id", loanId)
          .order("title", { ascending: true }),
      ])

    if (loanErr || !loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 })
    }

    return NextResponse.json({ loan, conditions: conditions ?? [] })
  } catch (error) {
    console.error("[conditions/loans/[loanId]] Error:", error)
    return NextResponse.json({ error: "Failed to fetch loan" }, { status: 500 })
  }
}
