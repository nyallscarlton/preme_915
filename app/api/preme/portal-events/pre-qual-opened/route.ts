/**
 * POST /api/preme/portal-events/pre-qual-opened
 *
 * Browser-callable proxy. Forwards to /api/preme/webhooks/pre-qual-opened
 * with server-side CRON_SECRET.
 *
 * Used by /prequalify page on initial mount when ?contact_id is present.
 * Doc 02.14 §4.1.
 */
import { makeOptionsHandler, makeProxyHandler } from "../_proxy"

export const dynamic = "force-dynamic"

export const OPTIONS = makeOptionsHandler()
export const POST = makeProxyHandler("/api/preme/webhooks/pre-qual-opened")
