import { type NextRequest, NextResponse } from "next/server"
import { submitApplication, getAllApplications } from "@/lib/applications-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST - Submit new application
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const result = await submitApplication(data)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      application: result.application,
      message: "Application submitted successfully",
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 })
  }
}

// GET - Get all applications (admin)
export async function GET() {
  try {
    const result = await getAllApplications()

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      applications: result.applications,
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 })
  }
}
