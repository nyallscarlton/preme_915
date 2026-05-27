/**
 * POST /api/preme/webhooks/pre-qual-opened
 *
 * Doc 02.14 §4.1 — Pre-qual page-load webhook.
 * Source: premerealestate.com pre-qual page (initial GET fires this).
 * Effect: PATCH GHL contact pre_qual_state = "opened" (idempotent — no-op if
 *   already opened or submitted).
 *
 * Payload: { "contact_id": "<ghl_contact_id>" }
 *
 * Auth: Bearer CRON_SECRET (or x-internal-auth header).
 */
import { NextRequest, NextResponse } from "next/server"
import { advanceStateIdempotent, isAuthorized } from "../_lib"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: { contact_id?: string }
  try {
    body = (await request.json()) as { contact_id?: string }
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const contactId = body.contact_id
  if (!contactId || typeof contactId !== "string") {
    return NextResponse.json(
      { ok: false, error: "contact_id (string) required" },
      { status: 400 },
    )
  }

  const r = await advanceStateIdempotent(contactId, "pre_qual_state", "opened")
  if (r.advanced) {
    console.log(
      `[preme-webhooks] pre-qual-opened: contact=${contactId} ${r.from} → ${r.to}`,
    )
    return NextResponse.json({ ok: true, advanced: true, from: r.from, to: r.to })
  }
  if (r.error) {
    console.error(`[preme-webhooks] pre-qual-opened: contact=${contactId} ERROR: ${r.error}`)
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
  }
  console.log(
    `[preme-webhooks] pre-qual-opened: contact=${contactId} no-op (current=${r.current})`,
  )
  return NextResponse.json({ ok: true, advanced: false, current: r.current })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/preme/webhooks/pre-qual-opened",
    method: "POST",
    auth: "Bearer CRON_SECRET or x-internal-auth header",
    payload: { contact_id: "<ghl_contact_id>" },
    effect: "idempotent PATCH pre_qual_state = opened",
    spec: "Doc 02.14 §4.1",
  })
}
