/**
 * Lender Portal Browser Automation — Type Definitions
 * Preme Home Loans — Portal Monitoring
 */

export type LoanStatusValue =
  | 'processing'
  | 'submitted'
  | 'conditional_approval'
  | 'clear_to_close'
  | 'funded'
  | 'suspended'
  | 'denied'

export type ConditionStatus = 'outstanding' | 'received' | 'reviewed' | 'waived'

export type ConditionCategory = 'prior_to_docs' | 'prior_to_funding' | 'prior_to_closing'

export interface Condition {
  id: string
  description: string
  status: ConditionStatus
  category: ConditionCategory
  dueDate?: string // ISO date string
}

export interface LoanStatus {
  loanNumber: string
  borrowerName: string
  propertyAddress: string
  loanAmount: number
  status: LoanStatusValue
  lockExpiration?: string // ISO date string
  conditions: Condition[]
  lastUpdated: string // ISO date string
  portalId: string
}

export interface PortalScrapeResult {
  portalId: string
  portalName: string
  scrapedAt: string // ISO date string
  success: boolean
  error?: string
  loans: LoanStatus[]
}

export interface PortalConnectionStatus {
  portalId: string
  portalName: string
  status: 'connected' | 'disconnected' | 'error'
  lastSyncedAt?: string // ISO date string
  error?: string
  activeLoanCount: number
}
