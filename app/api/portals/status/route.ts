import { NextRequest, NextResponse } from 'next/server'
import { LENDER_PORTALS, getPortalConfig, getPortalCredentials } from '@/lib/browser/portal-config'
import type { PortalConnectionStatus, PortalScrapeResult } from '@/lib/browser/types'

/**
 * In-memory cache of latest scrape results.
 * In production, replace with database persistence (Supabase / Prisma).
 */
const scrapeCache = new Map<string, PortalScrapeResult>()

// Expose cache for other routes to read
export { scrapeCache }

/**
 * GET /api/portals/status
 * Returns the connection status and latest scrape info for all portals.
 */
export async function GET() {
  const statuses: PortalConnectionStatus[] = LENDER_PORTALS.map((portal) => {
    const hasCreds = getPortalCredentials(portal) !== null
    const cached = scrapeCache.get(portal.id)

    return {
      portalId: portal.id,
      portalName: portal.name,
      status: !hasCreds ? 'disconnected' : cached?.success === false ? 'error' : hasCreds ? 'connected' : 'disconnected',
      lastSyncedAt: cached?.scrapedAt,
      error: cached?.error,
      activeLoanCount: cached?.loans.length ?? 0,
    }
  })

  return NextResponse.json({ portals: statuses })
}

/**
 * POST /api/portals/status
 * Triggers a manual scrape of a specific portal.
 * Body: { portalId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { portalId } = body as { portalId?: string }

    if (!portalId) {
      return NextResponse.json({ success: false, error: 'portalId is required' }, { status: 400 })
    }

    const portal = getPortalConfig(portalId)
    if (!portal) {
      return NextResponse.json(
        { success: false, error: `Unknown portal: ${portalId}` },
        { status: 404 }
      )
    }

    const creds = getPortalCredentials(portal)
    if (!creds) {
      return NextResponse.json(
        {
          success: false,
          error: `Credentials not configured. Set ${portal.credentialEnvPrefix}_USERNAME and ${portal.credentialEnvPrefix}_PASSWORD.`,
        },
        { status: 400 }
      )
    }

    // Dynamic import to avoid bundling Playwright in client builds
    const { runPortalCheck } = await import('@/lib/browser/scheduler')
    const result = await runPortalCheck(portalId)

    // Cache result
    scrapeCache.set(portalId, result)

    return NextResponse.json({ success: true, result })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
