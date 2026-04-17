import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyMCNewApplication } from "@/lib/mc-webhook"
import { sendApplicationConfirmationEmail } from "@/lib/follow-up"
import { sendNewApplicationTelegram, notifyPremeAppSubmission } from "@/lib/notifications"
import { triggerApplicationFollowUp, cancelPendingFollowUps } from "@/lib/lead-followup"
import { generateMISMO } from "@/lib/mismo"

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

    const isPreQual: boolean = !!data.is_pre_qual

    // Extract + encrypt PII, strip plaintext from insert payload
    const plainSsn: string | null = data.applicant_ssn || null
    const plainEin: string | null = data.entity_ein || null
    const declarations = data._declarations || null
    const reoProperties: unknown[] = Array.isArray(data._reo_properties) ? data._reo_properties : []

    const applicantSsnEncrypted = plainSsn
      ? (await adminClient.rpc("encrypt_pii", { plaintext: plainSsn })).data ?? null
      : null
    const entityEinEncrypted = plainEin
      ? (await adminClient.rpc("encrypt_pii", { plaintext: plainEin })).data ?? null
      : null

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { applicant_ssn, entity_ein, _declarations, _reo_properties, ...safe } = data

    const nowIso = new Date().toISOString()
    const applicationData = {
      ...safe,
      applicant_ssn_encrypted: applicantSsnEncrypted,
      entity_ein_encrypted: entityEinEncrypted,
      user_id: user?.id || null,
      application_number: applicationNumber,
      guest_token: data.is_guest ? crypto.randomUUID() : null,
      status: isPreQual ? "pre_qualified" : "submitted",
      is_pre_qual: isPreQual,
      pre_qualified_at: isPreQual ? nowIso : null,
      submitted_at: isPreQual ? null : nowIso,
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

    // Insert child rows: declarations + REO schedule
    if (declarations && typeof declarations === "object") {
      const { error: declErr } = await adminClient
        .from("loan_declarations")
        .insert([{ loan_application_id: application.id, borrower_id: null, ...declarations }])
      if (declErr) console.error("[applications] declarations insert error:", declErr.message)
    }
    if (reoProperties.length > 0) {
      const rows = reoProperties.map((r: any) => ({
        loan_application_id: application.id,
        is_subject: false,
        disposition_status: r.disposition_status || "HeldForInvestment",
        usage_type: r.usage_type || "Investment",
        address_line1: r.address_line1 || "",
        city: r.city || "",
        state: r.state || "",
        postal_code: r.postal_code || "",
        present_market_value: Number(r.present_market_value) || 0,
        lien_upb_amount: Number(r.lien_upb_amount) || 0,
        monthly_mortgage_payment: Number(r.monthly_mortgage_payment) || 0,
        monthly_rental_income_gross: Number(r.monthly_rental_income_gross) || 0,
        monthly_rental_income_net: Number(r.monthly_rental_income_net) || 0,
        monthly_maintenance_expense: Number(r.monthly_maintenance_expense) || 0,
        unit_count: Number(r.unit_count) || 1,
      }))
      const { error: reoErr } = await adminClient.from("loan_reo_properties").insert(rows)
      if (reoErr) console.error("[applications] REO insert error:", reoErr.message)
    }

    // --- POST-INSERT ACTIONS (all fire-and-forget) ---

    const applicantName = application.applicant_name || "Unknown"
    const firstName = applicantName.split(" ")[0] || "there"
    const applicantPhone = application.applicant_phone || ""
    const applicantEmail = application.applicant_email || ""
    const loanPurpose = application.loan_purpose || application.loan_type || null

    // --- PRE-QUAL SHORT-CIRCUIT ---
    // Pre-qual submissions: run DSCR matcher, cache result, return inline.
    // No MISMO gen, no confirmation email, no lead follow-up cadence yet
    // (those fire when they complete the full 1003).
    if (isPreQual) {
      const matchRes = await runDscrMatch(adminClient, application)
      return NextResponse.json({
        success: true,
        application,
        lenderMatch: matchRes,
        message: "Pre-qualification complete",
      })
    }

    // 0. MISMO generation — run in parallel with notifications so the Slack
    //    post at step 1b can include the download URL when it's ready.
    const mismoPromise = generateMISMO(application.id).catch((err) => {
      console.error("[applications] MISMO generation error:", err)
      return null
    })

    // 0b. Borrower profile upsert (cross-application prefill) — fire-and-forget
    adminClient
      .rpc("upsert_profile_from_application", { p_loan_application_id: application.id })
      .then(({ error }) => {
        if (error) console.error("[applications] profile upsert error:", error.message)
      })

    // 1. MC notification
    notifyMCNewApplication(application).catch(() => {})

    // 1b. #preme Slack notification + DSCR matcher — wait for MISMO so the
    //     post includes the download link
    const mismo = await mismoPromise
    notifyPremeAppSubmission({
      ...application,
      mismo_xml_url: mismo?.mismoUrl ?? null,
      fnm_url: mismo?.fnmUrl ?? null,
      urla_pdf_url: mismo?.urlaUrl ?? null,
    }).catch(() => {})

    // 2. Confirmation email (immediate)
    if (applicantEmail && !applicantEmail.endsWith("@placeholder.preme")) {
      sendApplicationConfirmationEmail({
        email: applicantEmail,
        firstName,
        applicationNumber,
        loanAmount: application.loan_amount,
        propertyAddress: application.property_address,
        propertyType: application.property_type,
        loanPurpose,
        creditScore: application.credit_score_range,
        guestToken: application.guest_token,
      }).catch((err) => console.error("[applications] Confirmation email error:", err))
    }

    // 3. Telegram alert (immediate)
    sendNewApplicationTelegram({
      applicantName,
      applicantPhone,
      applicantEmail,
      loanAmount: application.loan_amount,
      propertyType: application.property_type,
      propertyAddress: application.property_address,
      creditScore: application.credit_score_range,
      loanPurpose,
      applicationNumber,
    }).catch((err) => console.error("[applications] Telegram alert error:", err))

    // 4. Create lead record + queue follow-up cadence (if phone provided)
    if (applicantPhone) {
      createLeadAndQueueFollowUp(adminClient, {
        firstName,
        lastName: applicantName.split(" ").slice(1).join(" ") || "",
        phone: applicantPhone,
        email: applicantEmail,
        loanType: loanPurpose,
        applicationId: application.id,
      }).catch((err) => console.error("[applications] Lead creation error:", err))
    }

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

/**
 * Run DSCR match against pre-qual inputs, cache the result on the row,
 * and return a UI-friendly summary for the pre-approval screen.
 */
async function runDscrMatch(
  adminClient: ReturnType<typeof createAdminClient>,
  app: Record<string, any>
): Promise<{
  qualifiedCount: number
  topLender: { name: string | null; min_fico: number | null; maxLtvPurchase: number | null } | null
  reason: string | null
}> {
  try {
    const ficoMatch = /(\d+)/.exec(app.credit_score_range ?? "")
    const dscrApp = {
      state: app.property_state || "",
      propertyType: app.property_type || "residential",
      loanPurpose: app.loan_purpose || "Purchase",
      loanAmount: Number(app.loan_amount) || 0,
      fico: ficoMatch ? parseInt(ficoMatch[1], 10) : 0,
      ltv: Math.min(80, Math.round(((Number(app.loan_amount) || 0) / (Number(app.property_value) || 1)) * 100)),
    }
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://app.premerealestate.com"
    const res = await fetch(`${base}/api/dscr/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application: dscrApp, applicationId: app.id, save: false }),
    })
    if (!res.ok) throw new Error(`matcher returned ${res.status}`)
    const result = await res.json()
    const top = result.qualified?.[0]
    const summary = {
      qualifiedCount: result.qualifiedCount ?? 0,
      topLender: top
        ? { name: top?.lender?.name ?? null, min_fico: top?.lender?.min_fico ?? null, maxLtvPurchase: top?.lender?.ltv?.purchase ?? null }
        : null,
      reason: (result.disqualified?.[0]?.reasons?.[0] as string | undefined) ?? null,
    }
    await adminClient
      .from("loan_applications")
      .update({ pre_qual_lender_match: { ...summary, rawQualified: result.qualified?.slice(0, 3) ?? [] } })
      .eq("id", app.id)
    return summary
  } catch (err) {
    console.error("[applications] DSCR match error:", err)
    return { qualifiedCount: 0, topLender: null, reason: "Lender match engine unavailable — we'll review manually." }
  }
}

/**
 * Create a lead record from the application and trigger the application follow-up cadence.
 */
async function createLeadAndQueueFollowUp(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    firstName: string
    lastName: string
    phone: string
    email: string
    loanType: string | null
    applicationId: string
  },
) {
  // Check if lead already exists for this phone
  const digits = params.phone.replace(/\D/g, "")
  const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

  const { data: existingLead } = await adminClient
    .from("leads")
    .select("id")
    .eq("phone", e164)
    .maybeSingle()

  let leadId: string

  if (existingLead) {
    leadId = existingLead.id
    // Update existing lead with latest info
    await adminClient
      .from("leads")
      .update({
        loan_type: params.loanType,
        source: "application",
        status: "new",
      })
      .eq("id", leadId)
  } else {
    // Insert new lead
    const { data: newLead, error } = await adminClient
      .from("leads")
      .insert({
        first_name: params.firstName,
        last_name: params.lastName,
        phone: e164,
        email: params.email,
        loan_type: params.loanType,
        source: "application",
        status: "new",
      })
      .select("id")
      .single()

    if (error || !newLead) {
      console.error("[applications] Failed to create lead:", error?.message)
      return
    }

    leadId = newLead.id
  }

  // Cancel any existing lead follow-up cadence (Path 2/3) to prevent double-queuing
  await cancelPendingFollowUps(leadId)

  // Queue the application follow-up cadence
  await triggerApplicationFollowUp({
    id: leadId,
    first_name: params.firstName,
    last_name: params.lastName,
    phone: e164,
    email: params.email,
    loan_type: params.loanType,
    source: "application",
  })
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
      .eq("user_id", user.id)
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
