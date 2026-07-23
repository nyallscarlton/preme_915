/**
 * POST /api/preme/portal/send-1003
 *
 * Solomon "Send 1003" action — fires the loan_app_send objective via the
 * canonical /api/preme/sms/send pipeline. Server-side adds CRON_SECRET so
 * the browser never sees it.
 *
 * Doc 02.14 §4.5. Gating on pre_qual_approved tag is enforced inside
 * /api/preme/sms/send — this route is a thin proxy that builds the right
 * payload and forwards.
 *
 * Body: { contact_id: string, to_phone: string, first_name: string }
 *
 * Returns: pass-through of /api/preme/sms/send response (200 success, 403 if
 * pre_qual_approved tag absent, etc.).
 */
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const GHL_ID_PATTERN = /^[A-Za-z0-9_-]{12,32}$/

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }

  let body: { contact_id?: string; to_phone?: string; first_name?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const { contact_id, to_phone, first_name } = body
  if (!contact_id || !GHL_ID_PATTERN.test(contact_id)) {
    return NextResponse.json(
      { ok: false, error: "contact_id (string, GHL id format) required" },
      { status: 400 },
    )
  }
  if (!to_phone || typeof to_phone !== "string") {
    return NextResponse.json(
      { ok: false, error: "to_phone (E.164 string) required" },
      { status: 400 },
    )
  }

  const portalUrl =
    `${request.nextUrl.origin}/apply-full?contact=${encodeURIComponent(contact_id)}`

  const sendBody = {
    contact_id,
    to_phone,
    first_name: first_name || "there",
    objective: "loan_app_send",
    payload: { portal_1003_url: portalUrl, phase: "P3" },
    source: "portal-send-1003",
  }

  const res = await fetch(`${request.nextUrl.origin}/api/preme/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(sendBody),
  })
  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    data = { raw: text }
  }
  return NextResponse.json(data, { status: res.status })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/preme/portal/send-1003",
    method: "POST",
    payload: { contact_id: "<ghl_contact_id>", to_phone: "+1...", first_name: "..." },
    effect:
      "Forwards loan_app_send to /api/preme/sms/send. Gated on pre_qual_approved tag.",
    spec: "Doc 02.14 §4.5",
  })
}
