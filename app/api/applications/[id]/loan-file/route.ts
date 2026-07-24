import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/applications/<id>/loan-file?type=urla|mismo
 *
 * Stable download link for generated loan files — re-signs a fresh storage
 * URL on every request, so links in Slack messages never expire (the raw
 * signed URLs die after 15 minutes, which 400'd old Slack buttons).
 * Admin/lender session required.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) {
    // Not signed in — bounce through login and come back to this download
    const next = encodeURIComponent(`/api/applications/${params.id}/loan-file?${new URL(request.url).searchParams.toString()}`)
    return NextResponse.redirect(new URL(`/auth?next=${next}`, request.url))
  }

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single()
  if (!profile || !["admin", "lender"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const type = new URL(request.url).searchParams.get("type") || "urla"
  const { data: app } = await admin
    .from("loan_applications")
    .select("urla_pdf_path, mismo_xml_path")
    .eq("id", params.id)
    .single()

  const path = type === "mismo" ? app?.mismo_xml_path : app?.urla_pdf_path
  if (!path) return NextResponse.json({ error: "File not generated yet" }, { status: 404 })

  const { data: signed, error } = await admin.storage
    .from("preme-loan-files")
    .createSignedUrl(path, 15 * 60)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: error?.message || "Could not sign file" }, { status: 500 })
  }
  return NextResponse.redirect(signed.signedUrl)
}
