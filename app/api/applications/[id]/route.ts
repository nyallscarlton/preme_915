import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyMCStatusChange } from "@/lib/mc-webhook"
import { notifyMCNewApplication } from "@/lib/mc-webhook"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET - Get single application
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const { id } = params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: application, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ success: true, application })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 })
  }
}

// PATCH - Update application status
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json()
    const { id } = params
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify lender/admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get application number for MC webhook
    const { data: app } = await supabase
      .from("loan_applications")
      .select("application_number")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("loan_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fire-and-forget MC notification
    if (app?.application_number) {
      notifyMCStatusChange(id, status, app.application_number).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}

// PUT - Guest submits/updates their application (authenticated via guest_token)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await request.json()
    const { id } = params
    const adminClient = createAdminClient()

    // Authenticate via guest_token
    const guestToken = data.guest_token
    if (!guestToken) {
      return NextResponse.json({ error: "Missing guest token" }, { status: 401 })
    }

    // Verify the token matches the application
    const { data: existing, error: lookupError } = await adminClient
      .from("loan_applications")
      .select("id, guest_token, application_number")
      .eq("id", id)
      .eq("guest_token", guestToken)
      .single()

    if (lookupError || !existing) {
      return NextResponse.json({ error: "Invalid token or application" }, { status: 403 })
    }

    // Build update payload (strip internal fields)
    const { guest_token: _gt, is_guest: _ig, ...updateFields } = data

    const { data: application, error } = await adminClient
      .from("loan_applications")
      .update({
        ...updateFields,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("[applications] PUT error:", error)
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
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}
