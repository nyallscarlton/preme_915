/**
 * POST /api/preme/portal-events/pre-qual-submitted
 *
 * Browser-callable proxy. Forwards to /api/preme/webhooks/pre-qual-submitted
 * with server-side CRON_SECRET.
 *
 * Used by PrequalifyForm after successful submission. Doc 02.14 §4.2.
 *
 * Body: { contact_id: string, form_data?: Record<string, unknown> }
 */
import { makeOptionsHandler, makeProxyHandler } from "../_proxy"

export const dynamic = "force-dynamic"

export const OPTIONS = makeOptionsHandler()
export const POST = makeProxyHandler("/api/preme/webhooks/pre-qual-submitted")
