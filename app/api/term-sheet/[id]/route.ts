import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/term-sheet/<id>?token=<guest_token> — borrower's stable download
 * link for their term sheet PDF. Guest-token gated, re-signs per click so
 * texted/emailed links never expire.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const token = new URL(request.url).searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 })

  const admin = createAdminClient()
  const { data: ts } = await admin
    .from("term_sheets")
    .select("pdf_path, application_id")
    .eq("id", params.id)
    .single()
  if (!ts?.pdf_path) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: app } = await admin
    .from("loan_applications")
    .select("guest_token")
    .eq("id", ts.application_id)
    .single()
  if (!app || app.guest_token !== token) {
    return NextResponse.json({ error: "Invalid link" }, { status: 403 })
  }

  const { data: signed, error } = await admin.storage
    .from("preme-loan-files")
    .createSignedUrl(ts.pdf_path, 15 * 60)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not open file" }, { status: 500 })
  }
  return NextResponse.redirect(signed.signedUrl)
}
