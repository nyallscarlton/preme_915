import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = await request.json()

    if (!token || !password || !confirmPassword) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Verify guest token and get application
    const { data: application, error: fetchError } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("guest_token", token)
      .single()

    if (fetchError || !application) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
    }

    if (application.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved applications can be converted to full accounts" },
        { status: 400 }
      )
    }

    // Create Supabase auth user
    const nameParts = (application.applicant_name || "").split(" ")
    const firstName = nameParts[0] || ""
    const lastName = nameParts.slice(1).join(" ") || ""

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: application.applicant_email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: "applicant",
        },
      },
    })

    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
    }

    // Link all guest applications by this email to the new user
    await supabase
      .from("loan_applications")
      .update({
        user_id: authData.user.id,
        is_guest: false,
        guest_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("applicant_email", application.applicant_email)

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      redirectUrl: "/login?converted=true",
    })
  } catch (error) {
    console.error("Error converting guest application:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
