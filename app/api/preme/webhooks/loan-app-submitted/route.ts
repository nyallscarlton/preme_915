/**
 * POST /api/preme/webhooks/loan-app-submitted
 *
 * Doc 02.14 §4.7 — 1003 submit webhook (CRITICAL path).
 * Source: app.premerealestate.com 1003 form on submit.
 * Effect: PATCH GHL contact loan_app_state = "submitted", add tag loan_app_submitted.
 *
 * Payload: { "contact_id": "<ghl_contact_id>", "1003_data": { ... } }
 *
 * Note: 1003_data is large + sensitive — we do NOT echo it to GHL custom fields.
 * Underwriting data lives in the portal (Doc 02.14 §2.2). Only state + tag PATCH here.
 */
import { NextRequest, NextResponse } from "next/server"
import { addContactTags, patchContactCustomFields } from "@/lib/ghl-client"
import { isAuthorized } from "../_lib"

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

  const patchRes = await patchContactCustomFields(contactId, { loan_app_state: "submitted" })
  if (!patchRes.ok) {
    console.error(
      `[preme-webhooks] loan-app-submitted: PATCH FAIL contact=${contactId}: ${patchRes.error}`,
    )
    return NextResponse.json({ ok: false, error: patchRes.error }, { status: 502 })
  }

  const tagRes = await addContactTags(contactId, ["loan_app_submitted"])
  if (!tagRes.ok) {
    console.error(
      `[preme-webhooks] loan-app-submitted: tag add FAIL contact=${contactId}: ${tagRes.error}`,
    )
    return NextResponse.json(
      {
        ok: false,
        partial: true,
        fields_patched: true,
        tag_added: false,
        error: tagRes.error,
      },
      { status: 502 },
    )
  }

  console.log(
    `[preme-webhooks] loan-app-submitted: contact=${contactId} state=submitted tag=loan_app_submitted`,
  )
  return NextResponse.json({
    ok: true,
    contact_id: contactId,
    state: "submitted",
    tag_added: "loan_app_submitted",
  })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/preme/webhooks/loan-app-submitted",
    method: "POST",
    auth: "Bearer CRON_SECRET or x-internal-auth header",
    payload: { contact_id: "<ghl_contact_id>", "1003_data": "<not stored in GHL>" },
    effect: "PATCH loan_app_state=submitted, add tag loan_app_submitted",
    spec: "Doc 02.14 §4.7",
  })
}
