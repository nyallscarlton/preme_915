import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""

// MC status → Preme status mapping
function mapMCStatusToPreme(mcStatus: string): string {
  const statusMap: Record<string, string> = {
    submitted: "submitted",
    processing: "under_review",
    underwriting: "under_review",
    approved: "approved",
    denied: "rejected",
    closed: "approved",
    on_hold: "on_hold",
  }
  return statusMap[mcStatus] || "submitted"
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token || token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { premePortalId, newStatus } = await request.json()

    if (!premePortalId || !newStatus) {
      return NextResponse.json(
        { error: "Missing required fields: premePortalId, newStatus" },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const premeStatus = mapMCStatusToPreme(newStatus)

    const { error } = await supabase
      .from("loan_applications")
      .update({
        status: premeStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", premePortalId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      premePortalId,
      mappedStatus: premeStatus,
    })
  } catch (error) {
    console.error("[mc-status-webhook] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
