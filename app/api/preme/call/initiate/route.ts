/**
 * POST /api/preme/call/initiate
 *
 * Fires Riley (Retell voice agent) to call a GHL contact.
 * Used by the GHL custom actions page and any internal trigger.
 *
 * Auth: x-internal-auth or Bearer CRON_SECRET
 *
 * Body: { contact_id: string, context?: string }
 * - contact_id: GHL contact ID
 * - context: optional hint for Riley (e.g. "stale_lead", "callback_requested")
 */

import { NextRequest, NextResponse } from "next/server"
import Retell from "retell-sdk"
import { getContact } from "@/lib/ghl-client"

export const dynamic = "force-dynamic"

const RILEY_AGENT_ID = "agent_1df04d574af225fbc5d2684119"
const RILEY_FROM_NUMBER = "+14709425787"

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = req.headers.get("authorization")
  if (bearer === `Bearer ${secret}`) return true
  const internal = req.headers.get("x-internal-auth")
  if (internal === secret) return true
  // Allow from GHL actions page via query token
  const url = new URL(req.url)
  if (url.searchParams.get("token") === secret) return true
  return false
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: { contact_id?: string; context?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  if (!body.contact_id) {
    return NextResponse.json({ ok: false, error: "contact_id required" }, { status: 400 })
  }

  // Look up contact phone + name from GHL
  const contactRes = await getContact(body.contact_id)
  if (!contactRes.ok || !contactRes.data?.contact) {
    return NextResponse.json(
      { ok: false, error: `GHL contact lookup failed: ${contactRes.error}` },
      { status: 502 },
    )
  }

  const contact = contactRes.data.contact
  const rawPhone = contact.phone
  if (!rawPhone) {
    return NextResponse.json({ ok: false, error: "contact has no phone number" }, { status: 400 })
  }

  // Normalize to E.164 and reject obvious fake/test numbers
  const digits = rawPhone.replace(/\D/g, "")
  const toPhone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : rawPhone
  if (/^(\+1)?555/.test(toPhone) || digits.length < 10) {
    return NextResponse.json({ ok: false, error: `invalid phone number: ${rawPhone}` }, { status: 400 })
  }

  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RETELL_API_KEY not configured" }, { status: 500 })
  }

  try {
    const client = new Retell({ apiKey })
    const call = await client.call.createPhoneCall({
      from_number: RILEY_FROM_NUMBER,
      to_number: toPhone,
      agent_id: RILEY_AGENT_ID,
      retell_llm_dynamic_variables: {
        first_name: contact.firstName || "there",
        lead_context: body.context || "manual_outreach",
      },
      metadata: {
        contact_id: body.contact_id,
        source: "ghl_manual_call",
      },
    })

    return NextResponse.json({
      ok: true,
      call_id: call.call_id,
      to: toPhone,
      from: RILEY_FROM_NUMBER,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

/** GET: health probe */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, endpoint: "/api/preme/call/initiate" })
}
