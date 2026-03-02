import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    const { data: application, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("guest_token", token)
      .single()

    if (error || !application) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired access link" },
        { status: 404 }
      )
    }

    // Map to the shape the guest dashboard expects
    const mapped = {
      id: application.application_number || application.id,
      email: application.applicant_email,
      firstName: application.applicant_name?.split(" ")[0] || "",
      lastName: application.applicant_name?.split(" ").slice(1).join(" ") || "",
      phone: application.applicant_phone,
      status: application.status,
      submittedAt: application.submitted_at || application.created_at,
      loanAmount: application.loan_amount || 0,
      loanPurpose: application.loan_purpose || "",
      propertyAddress: [
        application.property_address,
        application.property_city,
        application.property_state,
        application.property_zip,
      ]
        .filter(Boolean)
        .join(", "),
      propertyValue: application.property_value || 0,
      downPayment: 0,
      annualIncome: application.annual_income || 0,
      employmentStatus: application.employment_status || "",
      employerName: application.employer_name || "",
      creditScore: application.credit_score_range || "",
      statusHistory: [
        {
          status: "submitted",
          date: application.submitted_at || application.created_at,
          message: "Your application has been received and is being processed.",
        },
        ...(application.status !== "submitted"
          ? [
              {
                status: application.status,
                date: application.updated_at || application.created_at,
                message: `Application status updated to ${application.status.replace("_", " ")}.`,
              },
            ]
          : []),
      ],
      nextSteps: getNextSteps(application.status),
    }

    return NextResponse.json({ ok: true, application: mapped })
  } catch (error) {
    console.error("Token verification error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to verify token" },
      { status: 500 }
    )
  }
}

function getNextSteps(status: string): string[] {
  switch (status) {
    case "submitted":
      return [
        "Our team is reviewing your application",
        "You may be contacted for additional documentation",
        "Expected response within 2-3 business days",
      ]
    case "under_review":
      return [
        "Your application is under detailed review",
        "Underwriting analysis in progress",
        "We may request additional documents",
      ]
    case "approved":
      return [
        "Congratulations! Your loan is approved",
        "Create an account to manage your loan",
        "Closing documents will be prepared",
      ]
    case "rejected":
      return [
        "We were unable to approve this application",
        "Contact us to discuss alternative options",
        "You may reapply after addressing the concerns",
      ]
    default:
      return ["Your application is being processed"]
  }
}
