/**
 * Centralized config helpers for Preme Home Loans portal.
 *
 * NEXT_PUBLIC_BASE_URL is the canonical site URL.
 * Production: https://www.premerealestate.com
 * Fallback:   https://preme915.vercel.app
 */

export function getBaseUrl(): string {
  // .trim() strips trailing-newline corruption in the Vercel env value —
  // without it every link built from this had a line break baked in
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://preme915.vercel.app"
  ).trim()
}
