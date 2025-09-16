export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"
export const fetchCache = "force-no-store"

import { type NextRequest, NextResponse } from "next/server"

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
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // In a real app, this would:
    // 1. Verify the guest token and get application data
    // 2. Check if application is approved
    // 3. Create Supabase user account
    // 4. Transfer guest application data to user account
    // 5. Invalidate the guest token
    // 6. Send welcome email

    console.log("Converting guest application to full account")
    console.log("Token:", token)

    // Mock token validation
    if (!token.startsWith("ml_")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Mock application data retrieval
    const guestApplication = {
      id: "app_123",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "(555) 123-4567",
      status: "approved",
      loanAmount: 500000,
      propertyAddress: "123 Main St, Beverly Hills, CA 90210",
    }

    // Check if application is approved
    if (guestApplication.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved applications can be converted to full accounts" },
        { status: 400 },
      )
    }

    // Mock account creation process
    console.log("Creating Supabase account for:", guestApplication.email)
    console.log("Transferring application data...")

    // Simulate account creation delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock successful account creation
    const newUser = {
      id: `user_${Date.now()}`,
      email: guestApplication.email,
      firstName: guestApplication.firstName,
      lastName: guestApplication.lastName,
      role: "applicant",
      createdAt: new Date().toISOString(),
    }

    console.log("Account created successfully:", newUser)

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      user: newUser,
      redirectUrl: "/portal",
    })
  } catch (error) {
    console.error("Error converting guest application:", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
