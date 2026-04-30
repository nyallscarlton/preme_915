/**
 * POST /api/applications/[id]/send-full-app
 *
 * Admin-triggered: emails/texts the borrower the magic link to complete
 * the full 1003. Core logic lives in lib/send-full-app.ts so the pre-qual
 * auto-trigger can reuse it.
 *
 * Body: { delivery_method: "email" | "sms" | "both" }  (default "both")
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendFullAppLink, type SendMethod } from "@/lib/send-full-app"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Profile lookup uses the admin client to bypass RLS — mirrors the
    // PATCH /applications/:id pattern. The session-scoped client was
    // returning null here because RLS on preme.profiles doesn't allow
    // the authenticated user to read their own role row, which caused
    // a spurious 403 Forbidden even for real admins.
    const admin = createAdminClient()
    const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single()
    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const method: SendMethod = body.delivery_method ?? "both"

    const result = await sendFullAppLink(params.id, method, "admin_manual", user.id)
    if (!result.success) return NextResponse.json(result, { status: 404 })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[send-full-app] error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 })
  }
}
