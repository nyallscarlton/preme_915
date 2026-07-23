/**
 * POST /api/preme/portal-events/loan-app-opened
 *
 * Browser-callable proxy. Forwards to /api/preme/webhooks/loan-app-opened
 * with server-side CRON_SECRET.
 *
 * Used by /apply-full client on initial mount to fire Doc 02.14 §4.6.
 */
import { makeOptionsHandler, makeProxyHandler } from "../_proxy"

export const dynamic = "force-dynamic"

export const OPTIONS = makeOptionsHandler()
export const POST = makeProxyHandler("/api/preme/webhooks/loan-app-opened")
