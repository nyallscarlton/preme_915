/**
 * Lender Portal Configuration
 *
 * Each portal defines login URLs, credential env var prefixes, and CSS/accessibility
 * selectors for key page elements. Selectors are placeholders — fill them in once
 * you have portal access and can inspect the actual DOM.
 *
 * Credential convention:
 *   {credentialEnvPrefix}_USERNAME  ->  login username / email
 *   {credentialEnvPrefix}_PASSWORD  ->  login password
 *
 * Example: UWM_USERNAME, UWM_PASSWORD
 */

export interface PortalSelectors {
  usernameField: string
  passwordField: string
  submitButton: string
  pipelineTable?: string
  loanStatusField?: string
  conditionsSection?: string
}

export interface LenderPortal {
  id: string
  name: string
  loginUrl: string
  credentialEnvPrefix: string
  selectors: PortalSelectors
}

/**
 * Registry of configured lender portals.
 * Selectors use placeholder values — update them after inspecting each portal's DOM.
 */
export const LENDER_PORTALS: LenderPortal[] = [
  {
    id: 'uwm',
    name: 'UWM (United Wholesale Mortgage)',
    loginUrl: 'https://www.uwm.com/login',
    credentialEnvPrefix: 'UWM',
    selectors: {
      usernameField: '[name="username"]',
      passwordField: '[name="password"]',
      submitButton: '[type="submit"]',
      pipelineTable: 'table.pipeline-table',
      loanStatusField: '.loan-status',
      conditionsSection: '.conditions-list',
    },
  },
  {
    id: 'rocket_pro',
    name: 'Rocket Pro TPO',
    loginUrl: 'https://www.rocketprotpo.com/login',
    credentialEnvPrefix: 'ROCKET_PRO',
    selectors: {
      usernameField: '[name="email"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.pipeline-grid',
      loanStatusField: '.loan-status-badge',
      conditionsSection: '.conditions-panel',
    },
  },
  {
    id: 'kiavi',
    name: 'Kiavi',
    loginUrl: 'https://app.kiavi.com/login',
    credentialEnvPrefix: 'KIAVI',
    selectors: {
      usernameField: '[name="email"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.loans-table',
      loanStatusField: '.status-indicator',
      conditionsSection: '.conditions-section',
    },
  },
  {
    id: 'lima_one',
    name: 'Lima One Capital',
    loginUrl: 'https://portal.limaone.com/login',
    credentialEnvPrefix: 'LIMA_ONE',
    selectors: {
      usernameField: '[name="username"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.loan-pipeline',
      loanStatusField: '.loan-status',
      conditionsSection: '.conditions-list',
    },
  },
  {
    id: 'angel_oak',
    name: 'Angel Oak Mortgage Solutions',
    loginUrl: 'https://portal.angeloakms.com/login',
    credentialEnvPrefix: 'ANGEL_OAK',
    selectors: {
      usernameField: '[name="username"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.pipeline-table',
      loanStatusField: '.status-field',
      conditionsSection: '.conditions-area',
    },
  },
  {
    id: 'carrington',
    name: 'Carrington Wholesale',
    loginUrl: 'https://wholesale.carringtonms.com/login',
    credentialEnvPrefix: 'CARRINGTON',
    selectors: {
      usernameField: '[name="username"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.pipeline-view',
      loanStatusField: '.loan-status',
      conditionsSection: '.conditions-panel',
    },
  },
  {
    id: 'newfi',
    name: 'NewFi Wholesale',
    loginUrl: 'https://portal.newfi.com/login',
    credentialEnvPrefix: 'NEWFI',
    selectors: {
      usernameField: '[name="email"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.loans-grid',
      loanStatusField: '.status-badge',
      conditionsSection: '.conditions-section',
    },
  },
  {
    id: 'corevest',
    name: 'CoreVest Finance',
    loginUrl: 'https://portal.corevest.com/login',
    credentialEnvPrefix: 'COREVEST',
    selectors: {
      usernameField: '[name="username"]',
      passwordField: '[name="password"]',
      submitButton: 'button[type="submit"]',
      pipelineTable: '.deal-pipeline',
      loanStatusField: '.deal-status',
      conditionsSection: '.conditions-list',
    },
  },
  {
    id: 'logan_finance',
    name: 'Logan Finance',
    loginUrl: 'https://www.loganconnect.com/login',
    credentialEnvPrefix: 'LOGAN',
    // Login requires selecting "Commercial Broker" (value="CB") from the MUI
    // channel dropdown (.MuiSelect-select) before filling email/password.
    selectors: {
      usernameField: '#email',
      passwordField: '#password',
      submitButton: 'button[type="submit"]',
      pipelineTable: undefined,  // Navigate to "Loan Pipeline" in sidebar
      loanStatusField: undefined,
      conditionsSection: undefined,
    },
  },
]

/**
 * Look up a portal config by ID.
 */
export function getPortalConfig(portalId: string): LenderPortal | undefined {
  return LENDER_PORTALS.find((p) => p.id === portalId)
}

/**
 * Get credentials for a portal from environment variables.
 * Returns null if either username or password is missing.
 */
export function getPortalCredentials(
  portal: LenderPortal
): { username: string; password: string } | null {
  const username = process.env[`${portal.credentialEnvPrefix}_USERNAME`]
  const password = process.env[`${portal.credentialEnvPrefix}_PASSWORD`]
  if (!username || !password) return null
  return { username, password }
}

/**
 * Returns all portals that have credentials configured.
 */
export function getConfiguredPortals(): LenderPortal[] {
  return LENDER_PORTALS.filter((p) => getPortalCredentials(p) !== null)
}
