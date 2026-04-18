import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/applications/[id]/interactions
 * Fetches all contact interactions for an applicant by phone number.
 * Queries contact_interactions using the last 10 digits of the phone.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()

  try {
    // Get the application to find the phone number
    const { data: app, error: appError } = await supabase
      .from("loan_applications")
      .select("applicant_phone, applicant_email, applicant_name")
      .eq("id", params.id)
      .single()

    if (appError || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    if (!app.applicant_phone) {
      return NextResponse.json({ interactions: [] })
    }

    const digits = app.applicant_phone.replace(/\D/g, "").slice(-10)

    if (!digits || digits.length < 7) {
      return NextResponse.json({ interactions: [] })
    }

    // Fetch interactions matching the phone
    const { data: interactions, error: intError } = await supabase
      .from("contact_interactions")
      .select("*")
      .ilike("phone", `%${digits}%`)
      .order("created_at", { ascending: true })
      .limit(100)

    if (intError) {
      console.error("[interactions] Query error:", intError)
      return NextResponse.json({ interactions: [] })
    }

    return NextResponse.json({
      interactions: interactions || [],
      applicantName: app.applicant_name || "Applicant",
    })
  } catch (err) {
    console.error("[interactions] Error:", err)
    return NextResponse.json({ error: "Failed to fetch interactions" }, { status: 500 })
  }
}
