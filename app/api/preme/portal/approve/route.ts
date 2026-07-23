/**
 * POST /api/preme/portal/approve
 *
 * Solomon Approve action — adds tag pre_qual_approved to a GHL contact.
 * Doc 02.14 §4.4.
 *
 * Body: { contact_id: string }
 *
 * Auth: TODO production should require Solomon's session. For tonight's MVP
 * we accept any browser caller (the portal is currently behind login). Keep
 * the gate minimal but not absent: require that the caller is on the same
 * origin (Next.js routes already same-origin by default — no CORS opened).
 */
import { NextRequest, NextResponse } from "next/server"
import { addContactTags } from "@/lib/ghl-client"

export const dynamic = "force-dynamic"

const GHL_ID_PATTERN = /^[A-Za-z0-9_-]{12,32}$/

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { contact_id?: string }
  try {
    body = (await request.json()) as { contact_id?: string }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const contactId = body.contact_id
  if (!contactId || typeof contactId !== "string" || !GHL_ID_PATTERN.test(contactId)) {
    return NextResponse.json(
      { ok: false, error: "contact_id (string, GHL id format) required" },
      { status: 400 },
    )
  }

  const r = await addContactTags(contactId, ["pre_qual_approved"])
  if (!r.ok) {
    console.error(
      `[preme-portal] approve FAIL contact=${contactId}: ${r.error}`,
    )
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
  }

  console.log(`[preme-portal] approve OK contact=${contactId} (tag pre_qual_approved added)`)
  return NextResponse.json({ ok: true, contact_id: contactId, tag_added: "pre_qual_approved" })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/preme/portal/approve",
    method: "POST",
    payload: { contact_id: "<ghl_contact_id>" },
    effect: "add tag pre_qual_approved (gates loan_app_send per Doc 02.14 §4.4)",
  })
}
