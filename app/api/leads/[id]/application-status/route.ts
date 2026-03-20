/**
 * GET /api/leads/[id]/application-status
 *
 * Returns the status of any application sent to this lead,
 * including open tracking and completion progress.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Fields that count toward application completeness
const TRACKED_FIELDS = [
  "applicant_name",
  "applicant_email",
  "applicant_phone",
  "loan_type",
  "loan_purpose",
  "loan_amount",
  "property_address",
  "property_type",
  "property_value",
  "credit_score_range",
  "annual_income",
  "employment_status",
] as const

export async function GET(
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
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Look up application by lead_id first, then fall back to phone/email match
    let application: any = null

    const { data: byLeadId } = await adminClient
      .from("loan_applications")
      .select("*")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (byLeadId) {
      application = byLeadId
    } else {
      // Fall back: get lead info and match by phone/email
      const { data: lead } = await adminClient
        .from("leads")
        .select("phone, email")
        .eq("id", params.id)
        .single()

      if (lead) {
        const conditions: string[] = []
        if (lead.phone) {
          const digits = lead.phone.replace(/\D/g, "").slice(-10)
          conditions.push(`applicant_phone.ilike.%${digits}%`)
        }
        if (lead.email) {
          conditions.push(`applicant_email.eq.${lead.email}`)
        }

        if (conditions.length > 0) {
          const { data: byContact } = await adminClient
            .from("loan_applications")
            .select("*")
            .or(conditions.join(","))
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()

          application = byContact
        }
      }
    }

    if (!application) {
      return NextResponse.json({
        success: true,
        has_application: false,
      })
    }

    // Calculate completion progress
    let filledCount = 0
    for (const field of TRACKED_FIELDS) {
      const val = application[field]
      if (val !== null && val !== undefined && val !== "" && val !== 0) {
        filledCount++
      }
    }
    const progress = Math.round((filledCount / TRACKED_FIELDS.length) * 100)

    return NextResponse.json({
      success: true,
      has_application: true,
      application_number: application.application_number,
      application_id: application.id,
      status: application.status,
      created_at: application.created_at,
      updated_at: application.updated_at,
      submitted_at: application.submitted_at,
      sent_via: application.sent_via,
      sent_at: application.sent_at,
      opened: !!application.first_opened_at,
      first_opened_at: application.first_opened_at,
      progress,
      submitted: application.status === "submitted" || !!application.submitted_at,
      guest_token: application.guest_token,
    })
  } catch (error) {
    console.error("[application-status] API error:", error)
    return NextResponse.json({ error: "Failed to fetch application status" }, { status: 500 })
  }
}
