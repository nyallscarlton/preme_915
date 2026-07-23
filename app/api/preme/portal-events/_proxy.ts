/**
 * Shared proxy logic for portal-event routes.
 *
 * Browser-callable. Caller passes contact_id (and optional payload). Server reads
 * CRON_SECRET from env and forwards to the internal /api/preme/webhooks/* route.
 * The CRON_SECRET never leaves the server.
 *
 * Doc 02.14 §4.1, §4.6, §4.7 — portal/page-load + form-submit events.
 *
 * Light anti-abuse: contact_id must match GHL's id format ([A-Za-z0-9_-]{12,32}).
 * For tonight's MVP we trust browser callers from same origin; production should
 * add session check + rate-limit.
 */
import { NextRequest, NextResponse } from "next/server"

const GHL_ID_PATTERN = /^[A-Za-z0-9_-]{12,32}$/

// Origins allowed to call portal-events from the browser (cross-origin).
// Doc 02.14 §4.1 + §4.2 — pre-qual page is hosted on go.premerealestate.com
// (zentryx project) but webhooks live on app.premerealestate.com (preme-portal).
const ALLOWED_ORIGINS = new Set([
  "https://go.premerealestate.com",
  "https://www.premerealestate.com",
  "https://premerealestate.com",
  "https://app.premerealestate.com",
  "http://localhost:3000",
])

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    }
  }
  return {}
}

export interface ProxyResult {
  status: number
  body: Record<string, unknown>
}

/**
 * Forward to internal webhook with CRON_SECRET. Used by the portal-events routes.
 *
 * `webhookPath` is the path relative to the same origin, e.g. "/api/preme/webhooks/loan-app-opened".
 * Returns the response body + status pass-through.
 */
export async function forwardToInternalWebhook(
  request: NextRequest,
  webhookPath: string,
  body: Record<string, unknown>,
): Promise<ProxyResult> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { status: 500, body: { ok: false, error: "CRON_SECRET not configured" } }
  }

  // Build absolute URL from the incoming request's origin (works in dev + prod).
  const origin = request.nextUrl.origin
  const url = `${origin}${webhookPath}`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      data = { raw: text }
    }
    return { status: res.status, body: data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: 502, body: { ok: false, error: `proxy_fail: ${msg}` } }
  }
}

export function validateContactId(id: unknown): string | null {
  if (typeof id !== "string") return null
  if (!GHL_ID_PATTERN.test(id)) return null
  return id
}

export function makeProxyHandler(webhookPath: string) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const origin = request.headers.get("origin")
    const cors = corsHeaders(origin)
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400, headers: cors })
    }
    const contactId = validateContactId(body.contact_id)
    if (!contactId) {
      return NextResponse.json(
        { ok: false, error: "contact_id (string, GHL id format) required" },
        { status: 400, headers: cors },
      )
    }
    const result = await forwardToInternalWebhook(request, webhookPath, body)
    return NextResponse.json(result.body, { status: result.status, headers: cors })
  }
}

/** OPTIONS preflight handler (export from each route). */
export function makeOptionsHandler() {
  return (request: NextRequest): NextResponse => {
    const origin = request.headers.get("origin")
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
  }
}
