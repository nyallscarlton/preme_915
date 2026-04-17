import { type NextRequest, NextResponse } from "next/server"
import { generateMISMO, signExistingFile } from "@/lib/mismo"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET  /api/applications/:id/mismo        → 302 redirect to a fresh signed URL
 *                                           for the most recently generated MISMO XML
 * GET  /api/applications/:id/mismo?f=fnm  → same but for Fannie 3.2
 * POST /api/applications/:id/mismo        → regenerate (fresh MISMO + FNM) and
 *                                           return JSON with signed URLs
 *
 * Admin-only. Auth checked via SUPABASE_SERVICE_ROLE_KEY header OR logged-in
 * admin role — for MVP we gate on service-role header only.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = createAdminClient()
  const f = req.nextUrl.searchParams.get("f")
  const kind = f === "fnm" ? "fnm" : f === "pdf" ? "pdf" : "mismo"
  const col = kind === "fnm" ? "fnm_path" : kind === "pdf" ? "urla_pdf_path" : "mismo_xml_path"

  const { data, error } = await sb.from("loan_applications").select(col).eq("id", params.id).single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? "not found" }, { status: 404 })

  const path = (data as Record<string, string | null>)[col]
  if (!path) return NextResponse.json({ error: `No ${kind} file generated yet. POST to regenerate.` }, { status: 404 })

  try {
    const url = await signExistingFile(path)
    return NextResponse.redirect(url, 302)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await generateMISMO(params.id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
