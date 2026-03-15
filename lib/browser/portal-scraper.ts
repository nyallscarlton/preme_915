/**
 * Generic Portal Scraping Service
 *
 * Connects to a remote Browserless.io Chrome instance via Playwright,
 * logs into lender portals, and extracts loan pipeline data.
 *
 * Requires:
 *   - BROWSERLESS_API_KEY env var
 *   - Per-portal credentials: {PREFIX}_USERNAME, {PREFIX}_PASSWORD
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { getPortalConfig, getPortalCredentials, type LenderPortal } from './portal-config'
import type { LoanStatus, Condition, PortalScrapeResult } from './types'

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function getBrowserlessEndpoint(): string {
  const token = process.env.BROWSERLESS_API_KEY
  if (!token) {
    throw new Error(
      'BROWSERLESS_API_KEY is not set. Add it to your .env.local file.'
    )
  }
  return `wss://chrome.browserless.io?token=${token}`
}

async function connectBrowser(): Promise<Browser> {
  const endpoint = getBrowserlessEndpoint()
  return chromium.connectOverCDP(endpoint)
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Log in to a lender portal. Returns an authenticated Page.
 * Throws on CAPTCHA detection or credential failure.
 */
export async function loginToPortal(portalId: string): Promise<{ browser: Browser; page: Page }> {
  const portal = getPortalConfig(portalId)
  if (!portal) throw new Error(`Unknown portal: ${portalId}`)

  const creds = getPortalCredentials(portal)
  if (!creds) {
    throw new Error(
      `Credentials not configured for ${portal.name}. ` +
      `Set ${portal.credentialEnvPrefix}_USERNAME and ${portal.credentialEnvPrefix}_PASSWORD env vars.`
    )
  }

  const browser = await connectBrowser()
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  await page.goto(portal.loginUrl, { waitUntil: 'networkidle', timeout: 30_000 })

  // Detect CAPTCHA
  const pageContent = await page.content()
  if (/captcha|recaptcha|hcaptcha/i.test(pageContent)) {
    await browser.close()
    throw new Error(`CAPTCHA detected on ${portal.name}. Manual intervention required.`)
  }

  // Fill login form
  await page.fill(portal.selectors.usernameField, creds.username)
  await page.fill(portal.selectors.passwordField, creds.password)
  await page.click(portal.selectors.submitButton)

  // Wait for navigation after login
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    // Some portals redirect multiple times; give extra time
  })
  await delay(2000)

  // Check for login failure indicators
  const errorVisible = await page
    .locator('[class*="error"], [class*="alert-danger"], [role="alert"]')
    .first()
    .isVisible()
    .catch(() => false)

  if (errorVisible) {
    await browser.close()
    throw new Error(`Login failed for ${portal.name}. Check credentials.`)
  }

  return { browser, page }
}

// ---------------------------------------------------------------------------
// Loan Status
// ---------------------------------------------------------------------------

/**
 * Navigate to a specific loan and extract its status.
 */
export async function getLoanStatus(
  portalId: string,
  loanNumber: string
): Promise<LoanStatus | null> {
  const { browser, page } = await loginToPortal(portalId)
  try {
    // Portal-specific loan lookup — generic pattern: search for loan number
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="loan" i]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(loanNumber)
      await page.keyboard.press('Enter')
      await delay(3000)
    }

    // Extract status from the page (placeholder — will need portal-specific parsing)
    const portal = getPortalConfig(portalId)!
    const statusEl = portal.selectors.loanStatusField
      ? await page.locator(portal.selectors.loanStatusField).first().textContent().catch(() => null)
      : null

    return {
      loanNumber,
      borrowerName: '',
      propertyAddress: '',
      loanAmount: 0,
      status: parseStatus(statusEl || ''),
      conditions: [],
      lastUpdated: new Date().toISOString(),
      portalId,
    }
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// All Active Loans
// ---------------------------------------------------------------------------

/**
 * Scrape the pipeline/dashboard for all active loans on a portal.
 */
export async function getAllActiveLoans(portalId: string): Promise<PortalScrapeResult> {
  const portal = getPortalConfig(portalId)
  if (!portal) {
    return {
      portalId,
      portalName: portalId,
      scrapedAt: new Date().toISOString(),
      success: false,
      error: `Unknown portal: ${portalId}`,
      loans: [],
    }
  }

  let browser: Browser | null = null
  try {
    const session = await loginToPortal(portalId)
    browser = session.browser
    const page = session.page

    await delay(2000) // Rate limiting

    const loans: LoanStatus[] = []

    // Try to find the pipeline table
    if (portal.selectors.pipelineTable) {
      const tableExists = await page
        .locator(portal.selectors.pipelineTable)
        .first()
        .isVisible()
        .catch(() => false)

      if (tableExists) {
        // Extract rows — generic pattern, will need per-portal customization
        const rows = await page
          .locator(`${portal.selectors.pipelineTable} tbody tr, ${portal.selectors.pipelineTable} [role="row"]`)
          .all()

        for (const row of rows) {
          const cells = await row.locator('td, [role="cell"]').allTextContents()
          if (cells.length >= 3) {
            loans.push({
              loanNumber: cells[0]?.trim() || '',
              borrowerName: cells[1]?.trim() || '',
              propertyAddress: cells[2]?.trim() || '',
              loanAmount: parseFloat(cells[3]?.replace(/[^0-9.]/g, '') || '0'),
              status: parseStatus(cells[4] || ''),
              conditions: [],
              lastUpdated: new Date().toISOString(),
              portalId,
            })
          }
          await delay(100) // Micro-delay between row processing
        }
      }
    }

    return {
      portalId,
      portalName: portal.name,
      scrapedAt: new Date().toISOString(),
      success: true,
      loans,
    }
  } catch (err) {
    return {
      portalId,
      portalName: portal.name,
      scrapedAt: new Date().toISOString(),
      success: false,
      error: err instanceof Error ? err.message : String(err),
      loans: [],
    }
  } finally {
    if (browser) await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/**
 * Extract outstanding conditions for a specific loan.
 */
export async function getConditions(
  portalId: string,
  loanNumber: string
): Promise<Condition[]> {
  const { browser, page } = await loginToPortal(portalId)
  try {
    const portal = getPortalConfig(portalId)!

    // Navigate to loan
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(loanNumber)
      await page.keyboard.press('Enter')
      await delay(3000)
    }

    const conditions: Condition[] = []

    if (portal.selectors.conditionsSection) {
      const conditionEls = await page
        .locator(`${portal.selectors.conditionsSection} li, ${portal.selectors.conditionsSection} tr`)
        .all()

      for (const el of conditionEls) {
        const text = await el.textContent().catch(() => '')
        if (text?.trim()) {
          conditions.push({
            id: `${portalId}-${loanNumber}-${conditions.length}`,
            description: text.trim(),
            status: 'outstanding',
            category: 'prior_to_docs',
          })
        }
      }
    }

    return conditions
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Document Download
// ---------------------------------------------------------------------------

/**
 * Download a specific document from a portal.
 * Returns the raw file buffer or null if not found.
 */
export async function downloadDocument(
  portalId: string,
  loanNumber: string,
  docType: string
): Promise<{ filename: string; buffer: Buffer } | null> {
  const { browser, page } = await loginToPortal(portalId)
  try {
    // Navigate to loan
    const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(loanNumber)
      await page.keyboard.press('Enter')
      await delay(3000)
    }

    // Look for a documents section and find the matching doc type
    const docLink = await page
      .locator(`a:has-text("${docType}"), button:has-text("${docType}")`)
      .first()

    if (!(await docLink.isVisible().catch(() => false))) {
      return null
    }

    // Set up download listener before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      docLink.click(),
    ])

    const filename = download.suggestedFilename()
    const path = await download.path()
    if (!path) return null

    const fs = await import('fs')
    const buffer = fs.readFileSync(path)
    return { filename, buffer }
  } catch {
    return null
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseStatus(raw: string): LoanStatus['status'] {
  const lower = raw.toLowerCase().trim()
  if (lower.includes('clear to close') || lower.includes('ctc')) return 'clear_to_close'
  if (lower.includes('conditional') || lower.includes('cond')) return 'conditional_approval'
  if (lower.includes('funded') || lower.includes('closed')) return 'funded'
  if (lower.includes('suspended') || lower.includes('suspend')) return 'suspended'
  if (lower.includes('denied') || lower.includes('decline')) return 'denied'
  if (lower.includes('submitted') || lower.includes('submit')) return 'submitted'
  return 'processing'
}
