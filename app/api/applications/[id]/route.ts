import { type NextRequest, NextResponse } from "next/server"
import { updateApplicationStatus } from "@/lib/applications-service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// PATCH - Update application status
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json()
    const { id } = params

    const result = await updateApplicationStatus(id, status)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}
