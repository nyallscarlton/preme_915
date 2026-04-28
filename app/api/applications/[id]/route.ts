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

    // Fire-and-forget notifications only on status change.
    // NOTE: the 1003 is NEVER auto-issued on approve anymore — admin manually
    // triggers it via the 'Send Full 1003 Link' button after reviewing the
    // DSCR match. This keeps human review in the loop for every file.
    if (statusChanged && app?.application_number) {
      notifyMCStatusChange(id, body.status, app.application_number).catch(() => {})

      if (app.applicant_email) {
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

    // Distinguish full-1003 PUTs from short-form (Riley's /apply) PUTs by
    // looking at the body shape. /apply-full's submit serializer always
    // includes `applicant_ssn` as a key (value may be null if the user left
    // it blank); /apply's serializer never sends `applicant_ssn` at all.
    //
    // - Full-1003 PUT: validate the required 1003 fields. If anything is
    //   missing, reject with 400 + the list, do not flip status to submitted.
    // - Short-form PUT (Riley/pre-qual link): accept whatever fields the
    //   borrower filled, persist them, but DO NOT mark this as a real 1003
    //   submit (no MISMO). Status moves to "submitted" only when the full
    //   1003 path runs successfully.
    const isFullOneThirty = "applicant_ssn" in (data as Record<string, unknown>)
    if (isFullOneThirty) {
      const requiredForSubmit: Array<{ key: string; label: string }> = [
        { key: "applicant_ssn", label: "SSN" },
        { key: "applicant_dob", label: "Date of birth" },
        { key: "applicant_first_name", label: "First name" },
        { key: "applicant_last_name", label: "Last name" },
        { key: "property_address", label: "Property address" },
        { key: "loan_amount", label: "Loan amount" },
      ]
      const missing = requiredForSubmit.filter(({ key }) => {
        const v = (data as Record<string, unknown>)[key]
        return v === null || v === undefined || v === "" || v === 0
      })
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: "Missing required 1003 fields",
            missing: missing.map((m) => m.label),
          },
          { status: 400 }
        )
      }
    }

    // Build update payload (strip internal fields that aren't DB columns)
    const {
      guest_token: _gt,
      is_guest: _ig,
      _declarations,
      _reo_properties,
      applicant_ssn,
      entity_ein,
      ...updateFields
    } = data

    // Encrypt PII on submit — same treatment as the POST path
    let applicant_ssn_encrypted: string | null = null
    let entity_ein_encrypted: string | null = null
    if (applicant_ssn) {
      const { data: ct } = await adminClient.rpc("encrypt_pii", { plaintext: applicant_ssn })
      applicant_ssn_encrypted = (ct as string) ?? null
    }
    if (entity_ein) {
      const { data: ct } = await adminClient.rpc("encrypt_pii", { plaintext: entity_ein })
      entity_ein_encrypted = (ct as string) ?? null
    }

    const { data: application, error } = await adminClient
      .from("loan_applications")
      .update({
        ...updateFields,
        ...(applicant_ssn_encrypted ? { applicant_ssn_encrypted } : {}),
        ...(entity_ein_encrypted ? { entity_ein_encrypted } : {}),
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

    // Upsert declarations if provided
    if (_declarations && typeof _declarations === "object") {
      await adminClient.from("loan_declarations").delete().eq("loan_application_id", id).is("borrower_id", null)
      const { error: declErr } = await adminClient
        .from("loan_declarations")
        .insert([{ loan_application_id: id, borrower_id: null, ..._declarations }])
      if (declErr) console.error("[applications] PUT declarations insert error:", declErr.message)
    }

    // Upsert REO properties if provided
    if (_reo_properties && Array.isArray(_reo_properties) && _reo_properties.length > 0) {
      await adminClient.from("loan_reo_properties").delete().eq("loan_application_id", id)
      const rows = _reo_properties.map((r: any) => ({ loan_application_id: id, ...r }))
      const { error: reoErr } = await adminClient.from("loan_reo_properties").insert(rows)
      if (reoErr) console.error("[applications] PUT REO insert error:", reoErr.message)
    }

    // Upsert borrower profile for cross-application prefill — fire-and-forget
    adminClient.rpc("upsert_profile_from_application", { p_loan_application_id: id })
      .then(({ error }: { error: unknown }) => { if (error) console.error("[applications] PUT profile upsert:", error) })

    // Fire MISMO + FNM + 1003 PDF generation ONLY for full-1003 PUTs.
    // Per Bible Doc 02.8 (Portal Scope), MISMO artifacts are produced only at
    // Stage 8 when the borrower completes /apply-full. Riley's short form
    // (/apply) and other partial PUTs must NOT generate MISMO — gating on
    // isFullOneThirty (presence of applicant_ssn in the body) keeps that
    // promise. See related: validation block above.
    const mismo = isFullOneThirty
      ? await (await import("@/lib/mismo"))
          .generateMISMO(id)
          .catch((err) => {
            console.error("[applications] PUT MISMO generation error:", err)
            return null
          })
      : null

    // Fire-and-forget MC notification
    notifyMCNewApplication(application).catch(() => {})

    // #preme Slack notification — now includes MISMO + PDF + FNM download buttons
    notifyPremeAppSubmission({
      ...application,
      mismo_xml_url: mismo?.mismoUrl ?? null,
      fnm_url: mismo?.fnmUrl ?? null,
      urla_pdf_url: mismo?.urlaUrl ?? null,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      application,
      mismoUrl: mismo?.mismoUrl ?? null,
      urlaUrl: mismo?.urlaUrl ?? null,
      fnmUrl: mismo?.fnmUrl ?? null,
      message: "Application submitted successfully",
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}
