import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyMCStatusChange } from "@/lib/mc-webhook"
import { notifyMCNewApplication } from "@/lib/mc-webhook"
import { sendStatusNotification } from "@/lib/notifications"

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

    // Get application details before update (for notifications)
    const { data: app } = await supabase
      .from("loan_applications")
      .select("application_number, applicant_email, applicant_name, guest_token, status")
      .eq("id", id)
      .single()

    const oldStatus = app?.status || "unknown"

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

    // Fire-and-forget borrower email + Telegram notification
    if (app?.applicant_email && app?.application_number) {
      sendStatusNotification({
        email: app.applicant_email,
        name: app.applicant_name || "",
        applicationNumber: app.application_number,
        oldStatus,
        newStatus: status,
        guestToken: app.guest_token || undefined,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}

// DELETE - Delete application (admin only)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
    }

    // Delete related conditions first
    const adminClient = createAdminClient()
    await adminClient.from("conditions").delete().eq("application_id", id)

    // Delete the application
    const { error } = await adminClient
      .from("loan_applications")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 })
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
