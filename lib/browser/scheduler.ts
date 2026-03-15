/**
 * Portal Scraping Scheduler
 *
 * Orchestrates scraping across all configured lender portals with
 * rate limiting, error handling, and structured JSON output.
 */

import { getConfiguredPortals, LENDER_PORTALS, getPortalConfig } from './portal-config'
import { getAllActiveLoans } from './portal-scraper'
import type { PortalScrapeResult } from './types'

/** Minimum delay (ms) between portal scrapes to avoid detection */
const PORTAL_DELAY_MS = 10_000

/** Log prefix for monitoring */
const LOG_PREFIX = '[portal-scheduler]'

// ---------------------------------------------------------------------------
// Daily Sweep
// ---------------------------------------------------------------------------

/**
 * Iterate through ALL configured portals (those with credentials set)
 * and scrape their active loan pipelines.
 *
 * Returns an array of results — one per portal.
 */
export async function runDailySweep(): Promise<PortalScrapeResult[]> {
  const portals = getConfiguredPortals()
  const results: PortalScrapeResult[] = []

  console.log(`${LOG_PREFIX} Starting daily sweep — ${portals.length} portal(s) configured`)

  for (const portal of portals) {
    console.log(`${LOG_PREFIX} Scraping ${portal.name}...`)

    try {
      const result = await getAllActiveLoans(portal.id)
      results.push(result)

      if (result.success) {
        console.log(
          `${LOG_PREFIX} ${portal.name}: OK — ${result.loans.length} active loan(s)`
        )
      } else {
        console.error(`${LOG_PREFIX} ${portal.name}: FAILED — ${result.error}`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`${LOG_PREFIX} ${portal.name}: EXCEPTION — ${errorMsg}`)
      results.push({
        portalId: portal.id,
        portalName: portal.name,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: errorMsg,
        loans: [],
      })
    }

    // Rate limit: wait between portals
    if (portals.indexOf(portal) < portals.length - 1) {
      console.log(`${LOG_PREFIX} Waiting ${PORTAL_DELAY_MS / 1000}s before next portal...`)
      await delay(PORTAL_DELAY_MS)
    }
  }

  console.log(`${LOG_PREFIX} Daily sweep complete — ${results.length} portal(s) processed`)
  return results
}

// ---------------------------------------------------------------------------
// Single Portal Check
// ---------------------------------------------------------------------------

/**
 * Run a scrape on a single portal by ID.
 */
export async function runPortalCheck(portalId: string): Promise<PortalScrapeResult> {
  const portal = getPortalConfig(portalId)
  if (!portal) {
    return {
      portalId,
      portalName: portalId,
      scrapedAt: new Date().toISOString(),
      success: false,
      error: `Unknown portal ID: ${portalId}`,
      loans: [],
    }
  }

  console.log(`${LOG_PREFIX} Running check on ${portal.name}...`)
  const result = await getAllActiveLoans(portalId)

  if (result.success) {
    console.log(`${LOG_PREFIX} ${portal.name}: OK — ${result.loans.length} active loan(s)`)
  } else {
    console.error(`${LOG_PREFIX} ${portal.name}: FAILED — ${result.error}`)
  }

  return result
}

// ---------------------------------------------------------------------------
// Summary / Reporting
// ---------------------------------------------------------------------------

/**
 * Generate a summary report from scrape results.
 */
export function generateSweepSummary(results: PortalScrapeResult[]): {
  totalPortals: number
  successfulPortals: number
  failedPortals: number
  totalActiveLoans: number
  conditionsOutstanding: number
  lockExpiringSoon: number
  errors: { portalId: string; error: string }[]
} {
  const now = new Date()
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

  let totalLoans = 0
  let conditionsCount = 0
  let lockExpiring = 0
  const errors: { portalId: string; error: string }[] = []

  for (const r of results) {
    if (!r.success && r.error) {
      errors.push({ portalId: r.portalId, error: r.error })
    }
    totalLoans += r.loans.length
    for (const loan of r.loans) {
      conditionsCount += loan.conditions.filter((c) => c.status === 'outstanding').length
      if (loan.lockExpiration) {
        const lockDate = new Date(loan.lockExpiration)
        if (lockDate <= fiveDaysFromNow) lockExpiring++
      }
    }
  }

  return {
    totalPortals: results.length,
    successfulPortals: results.filter((r) => r.success).length,
    failedPortals: results.filter((r) => !r.success).length,
    totalActiveLoans: totalLoans,
    conditionsOutstanding: conditionsCount,
    lockExpiringSoon: lockExpiring,
    errors,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
