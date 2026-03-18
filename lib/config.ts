/**
 * Centralized config helpers for Preme Home Loans portal.
 *
 * NEXT_PUBLIC_BASE_URL is the canonical site URL.
 * Production: https://www.premerealestate.com
 * Fallback:   https://preme915.vercel.app
 */

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://preme915.vercel.app"
  )
}
