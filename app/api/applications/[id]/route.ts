import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyMCStatusChange } from "@/lib/mc-webhook"
import { notifyMCNewApplication } from "@/lib/mc-webhook"
import { sendStatusNotification, notifyPremeAppSubmission } from "@/lib/notifications"

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

// Fields an admin is allowed to edit
const EDITABLE_FIELDS = [
  "status",
  "loan_amount",
  "loan_type",
  "loan_purpose",
  "credit_score_range",
  "property_value",
  "property_type",
  "property_address",
  "property_city",
  "property_state",
  "property_zip",
  "applicant_name",
  "applicant_email",
  "applicant_phone",
  "annual_income",
  "employment_status",
  "employer_name",
  "cash_reserves",
  "investment_accounts",
  "retirement_accounts",
]

// PATCH - Update application fields (status, loan details, etc.)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { id } = params
    const supabase = createClient()
    const adminClient = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify lender/admin role (use admin client to bypass RLS)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build update payload — only allow whitelisted fields
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const key of EDITABLE_FIELDS) {
      if (key in body) updateData[key] = body[key]
    }

    // Get application details before update (for status change notifications)
    const { data: app } = await adminClient
      .from("loan_applications")
      .select("application_number, applicant_email, applicant_name, guest_token, status")
      .eq("id", id)
      .single()

    const oldStatus = app?.status || "unknown"
    const statusChanged = "status" in body && body.status !== oldStatus

    const { data: updated, error } = await adminClient
      .from("loan_applications")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fire-and-forget notifications only on status change
    if (statusChanged && app?.application_number) {
      notifyMCStatusChange(id, body.status, app.application_number).catch(() => {})

      // Auto-issue full 1003 when admin approves a pre_qualified row.
      // The Approve button in Review Application is the trigger; the email
      // + SMS are the automatic consequence (no separate "Send" click needed).
      if (oldStatus === "pre_qualified" && body.status === "approved") {
        const { sendFullAppLink } = await import("@/lib/send-full-app")
        sendFullAppLink(id, "both", "auto_prequal_approval", user.id).catch((err) =>
          console.error("[applications PATCH] auto-issue 1003 failed:", err)
        )
      } else if (app.applicant_email) {
        // Standard borrower-facing status email for any other transition
        sendStatusNotification({
          email: app.applicant_email,
          name: app.applicant_name || "",
          applicationNumber: app.application_number,
          oldStatus,
          newStatus: body.status,
          guestToken: app.guest_token || undefined,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true, application: updated })
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
    const adminClient = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use admin client for profile lookup (bypasses RLS)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
    }

    // Delete related conditions first
    await adminClient.from("conditions").delete().eq("application_id", id)

    // Delete related documents
    await adminClient.from("loan_documents").delete().eq("application_id", id)

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

    // Fire-and-forget #preme Slack notification + DSCR matcher
    notifyPremeAppSubmission(application).catch(() => {})

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
