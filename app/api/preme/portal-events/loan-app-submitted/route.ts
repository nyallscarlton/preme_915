/**
 * POST /api/preme/portal-events/loan-app-submitted
 *
 * Browser-callable proxy. Forwards to /api/preme/webhooks/loan-app-submitted
 * with server-side CRON_SECRET.
 *
 * Used by /apply-full client after successful 1003 submission to fire Doc 02.14 §4.7.
 */
import { makeOptionsHandler, makeProxyHandler } from "../_proxy"

export const dynamic = "force-dynamic"

export const OPTIONS = makeOptionsHandler()
export const POST = makeProxyHandler("/api/preme/webhooks/loan-app-submitted")
