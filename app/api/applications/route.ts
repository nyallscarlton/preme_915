import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyMCNewApplication } from "@/lib/mc-webhook"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST - Submit new application
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const supabase = createClient()
    const adminClient = createAdminClient()

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const applicationNumber = `PREME-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 6).toUpperCase()}`

    const applicationData = {
      ...data,
      user_id: user?.id || null,
      application_number: applicationNumber,
      guest_token: data.is_guest ? crypto.randomUUID() : null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }

    // Use admin client to bypass RLS for inserts (guests have no auth context)
    const { data: application, error } = await adminClient
      .from("loan_applications")
      .insert([applicationData])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fire-and-forget MC notification
    notifyMCNewApplication(application).catch(() => {})

    return NextResponse.json({
      success: true,
      application,
      message: "Application submitted successfully",
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 })
  }
}

// GET - Get applications for current user (or all for admin)
export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    let query = supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false })

    // Non-admin users only see their own applications
    if (!profile || !["lender", "admin"].includes(profile.role)) {
      query = query.or(`user_id.eq.${user.id},applicant_email.eq.${user.email}`)
    }

    const { data: applications, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      applications: applications || [],
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 })
  }
}
