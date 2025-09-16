export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"
export const fetchCache = "force-no-store"

import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // In a real app, this would:
    // 1. Look up guest applications by email in the database
    // 2. Generate a secure token with expiration
    // 3. Send email with magic link
    // 4. Store token in database for validation

    // Generate a secure token (in production, use crypto.randomBytes or similar)
    const token = `ml_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    console.log("Generated magic link token:", token)
    console.log("Token expires at:", expiresAt)

    // Mock finding applications for this email
    const mockApplications = [
      {
        id: "app_123",
        email: email,
        status: "under_review",
        submittedAt: new Date().toISOString(),
        loanAmount: 500000,
        propertyAddress: "123 Main St, Beverly Hills, CA 90210",
      },
    ]

    if (mockApplications.length === 0) {
      return NextResponse.json({ error: "No applications found for this email address" }, { status: 404 })
    }

    // In production, you would send an actual email here
    // For now, we'll return the magic link URL for testing
    const magicLinkUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/guest-dashboard?token=${token}`

    console.log("Magic link URL:", magicLinkUrl)

    // Mock email sending
    console.log(`Sending magic link email to: ${email}`)
    console.log(`Magic link: ${magicLinkUrl}`)

    return NextResponse.json({
      success: true,
      message: "Magic link sent successfully",
      // In production, don't return the actual link
      magicLink: magicLinkUrl, // Only for testing
    })
  } catch (error) {
    console.error("Error sending magic link:", error)
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 })
  }
}
