import { NextResponse } from 'next/server'
import { LENDER_PORTALS } from '@/lib/browser/portal-config'
import type { LoanStatus } from '@/lib/browser/types'
import { scrapeCache } from '../status/route'

/**
 * GET /api/portals/loans
 * Returns all tracked loans with their current portal statuses,
 * aggregated from the latest scrape results across all portals.
 */
export async function GET() {
  const allLoans: LoanStatus[] = []

  for (const portal of LENDER_PORTALS) {
    const cached = scrapeCache.get(portal.id)
    if (cached?.success && cached.loans.length > 0) {
      allLoans.push(...cached.loans)
    }
  }

  // Sort by last updated (most recent first)
  allLoans.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())

  return NextResponse.json({
    totalLoans: allLoans.length,
    loans: allLoans,
  })
}
