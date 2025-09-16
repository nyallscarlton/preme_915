import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    // In a real app, this would:
    // 1. Look up the token in the database
    // 2. Check if it's expired
    // 3. Return the associated application data

    console.log("Verifying token:", token)

    // Mock token validation
    if (!token.startsWith("ml_")) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 401 })
    }

    // Mock application data
    const applicationData = {
      id: "app_123",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      phone: "(555) 123-4567",
      status: "under_review",
      submittedAt: "2024-01-15T10:30:00Z",
      loanAmount: 500000,
      loanPurpose: "Investment property purchase",
      propertyAddress: "123 Main St, Beverly Hills, CA 90210",
      propertyValue: 750000,
      downPayment: 150000,
      annualIncome: 120000,
      employmentStatus: "full-time",
      employerName: "Tech Corp",
      creditScore: "740-799",
      statusHistory: [
        {
          status: "submitted",
          date: "2024-01-15T10:30:00Z",
          message: "Application submitted successfully",
        },
        {
          status: "under_review",
          date: "2024-01-16T09:15:00Z",
          message: "Application is being reviewed by our underwriting team",
        },
      ],
      nextSteps: [
        "Initial document review in progress",
        "Credit verification pending",
        "Property appraisal to be scheduled",
      ],
    }

    return NextResponse.json({
      success: true,
      application: applicationData,
    })
  } catch (error) {
    console.error("Error verifying token:", error)
    return NextResponse.json({ error: "Failed to verify token" }, { status: 500 })
  }
}
