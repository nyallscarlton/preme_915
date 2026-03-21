import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { notifyMCNewApplication } from "@/lib/mc-webhook"
import { sendApplicationConfirmationEmail } from "@/lib/follow-up"
import { sendNewApplicationTelegram } from "@/lib/notifications"
import { triggerApplicationFollowUp, cancelPendingFollowUps } from "@/lib/lead-followup"

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

    // --- POST-INSERT ACTIONS (all fire-and-forget) ---

    const applicantName = application.applicant_name || "Unknown"
    const firstName = applicantName.split(" ")[0] || "there"
    const applicantPhone = application.applicant_phone || ""
    const applicantEmail = application.applicant_email || ""
    const loanPurpose = application.loan_purpose || application.loan_type || null

    // 1. MC notification
    notifyMCNewApplication(application).catch(() => {})

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
