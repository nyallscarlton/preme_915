import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST - Convert a lead to a loan application
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Fetch the lead
    const { data: lead, error: leadError } = await adminClient
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    if (lead.status === "converted") {
      return NextResponse.json({ error: "Lead has already been converted" }, { status: 400 })
    }

    // Generate application number
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const applicationNumber = `PHL-${timestamp}-${random}`

    // Create draft loan application from lead data
    const applicationData = {
      application_number: applicationNumber,
      applicant_name: `${lead.first_name} ${lead.last_name}`.trim(),
      applicant_email: lead.email,
      applicant_phone: lead.phone,
      loan_type: lead.loan_type || "conventional",
      loan_amount: lead.loan_amount || null,
      status: "draft",
      source: lead.source || "lead_conversion",
      notes: `Converted from lead on ${new Date().toISOString().split("T")[0]}. ${lead.message ? `Lead message: ${lead.message}` : ""}`.trim(),
      created_at: new Date().toISOString(),
    }

    const { data: application, error: appError } = await adminClient
      .from("loan_applications")
      .insert([applicationData])
      .select()
      .single()

    if (appError) {
      console.error("[leads/convert] Insert application error:", appError)
      return NextResponse.json({ error: "Failed to create application" }, { status: 500 })
    }

    // Update lead status to converted
    await adminClient
      .from("leads")
      .update({
        status: "converted",
        updated_at: new Date().toISOString(),
        qualification_data: {
          ...(lead.qualification_data || {}),
          converted_at: new Date().toISOString(),
          converted_by: user.id,
          application_id: application.id,
          application_number: applicationNumber,
        },
      })
      .eq("id", params.id)

    return NextResponse.json({
      success: true,
      application_id: application.id,
      application_number: applicationNumber,
    })
  } catch (error) {
    console.error("[leads/convert] API error:", error)
    return NextResponse.json({ error: "Failed to convert lead" }, { status: 500 })
  }
}
