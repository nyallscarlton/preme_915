import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Look up guest applications by email
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("id, guest_token, status, application_number")
      .eq("applicant_email", email)
      .eq("is_guest", true)
      .order("created_at", { ascending: false })

    if (error || !applications || applications.length === 0) {
      return NextResponse.json(
        { error: "No guest applications found for this email address" },
        { status: 404 }
      )
    }

    // Use the most recent application's guest token
    const latestApp = applications[0]

    if (!latestApp.guest_token) {
      return NextResponse.json(
        { error: "No guest access token found for this application" },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const magicLinkUrl = `${baseUrl}/guest-dashboard?token=${latestApp.guest_token}`

    // TODO: Send actual email via Resend (Phase 3)
    // For now, return the link directly for testing
    return NextResponse.json({
      success: true,
      message: "Magic link sent successfully. Check your email.",
      magicLink: magicLinkUrl, // Remove in production
    })
  } catch (error) {
    console.error("Error sending magic link:", error)
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
  }
}
