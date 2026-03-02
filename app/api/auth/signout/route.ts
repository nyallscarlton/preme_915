import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// POST - Sign out: revoke session and clear auth cookies
export async function POST() {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch {
    // Even if server sign-out fails, clear cookies below
  }

  // Build response that clears all supabase auth cookies
  const response = NextResponse.json({ success: true })

  // Clear any supabase auth cookies by setting them to empty with past expiry
  const cookieNames = [
    "sb-hriipovloelnqrlwtswy-auth-token",
    "sb-hriipovloelnqrlwtswy-auth-token.0",
    "sb-hriipovloelnqrlwtswy-auth-token.1",
    "sb-hriipovloelnqrlwtswy-auth-token.2",
  ]

  for (const name of cookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" })
  }

  return response
}
