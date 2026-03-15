import { NextResponse } from 'next/server'
import { LENDER_PORTALS } from '@/lib/browser/portal-config'
import type { Condition, LoanStatus } from '@/lib/browser/types'
import { scrapeCache } from '../status/route'

interface ConditionWithLoan extends Condition {
  loanNumber: string
  borrowerName: string
  portalId: string
  portalName: string
}

/**
 * GET /api/portals/conditions
 * Returns all outstanding conditions across all active loans from all portals.
 */
export async function GET() {
  const allConditions: ConditionWithLoan[] = []

  for (const portal of LENDER_PORTALS) {
    const cached = scrapeCache.get(portal.id)
    if (!cached?.success) continue

    for (const loan of cached.loans) {
      for (const condition of loan.conditions) {
        if (condition.status === 'outstanding') {
          allConditions.push({
            ...condition,
            loanNumber: loan.loanNumber,
            borrowerName: loan.borrowerName,
            portalId: portal.id,
            portalName: portal.name,
          })
        }
      }
    }
  }

  // Sort: items with due dates first, then by due date ascending
  allConditions.sort((a, b) => {
    if (a.dueDate && !b.dueDate) return -1
    if (!a.dueDate && b.dueDate) return 1
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    return 0
  })

  return NextResponse.json({
    totalOutstanding: allConditions.length,
    conditions: allConditions,
  })
}
