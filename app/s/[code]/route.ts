import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Statuses where the borrower's next step is the full 1003 sign page
const SIGN_STAGES = new Set(["sent", "opened", "submitted", "under_review", "approved", "funded"])

/**
 * GET /s/<code> — the borrower's one evergreen link. Routes to the right
 * step for their stage: initial application before approval, the 1003
 * sign page after. Unknown codes land on the public apply page.
 */
export async function GET(_request: NextRequest, { params }: { params: { code: string } }) {
  const base = getBaseUrl()
  const code = params.code?.trim()
  if (!code || code.length > 32) return NextResponse.redirect(`${base}/apply`)

  const admin = createAdminClient()
  const { data: app } = await admin
    .from("loan_applications")
    .select("id, status, guest_token")
    .eq("short_code", code)
    .maybeSingle()

  if (!app?.guest_token) return NextResponse.redirect(`${base}/apply`)

  const token = encodeURIComponent(app.guest_token)
  const dest = SIGN_STAGES.has(app.status)
    ? `${base}/sign?token=${token}`
    : `${base}/apply?guest=1&token=${token}`
  return NextResponse.redirect(dest)
}
