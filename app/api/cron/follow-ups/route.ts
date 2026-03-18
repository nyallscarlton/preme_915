/**
 * Preme Home Loans — Abandoned Application Follow-Up Cron Endpoint
 *
 * GET /api/cron/follow-ups
 *
 * Protected by CRON_SECRET env var. Call from Vercel Cron or an
 * external scheduler with header: Authorization: Bearer <CRON_SECRET>
 *
 * Vercel Cron: runs every 30 minutes.
 */

import { NextResponse } from "next/server"
import { checkAndSendFollowUps } from "@/lib/follow-up"

// Vercel cron configuration — every 30 minutes
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(request: Request) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const result = await checkAndSendFollowUps()
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[cron/follow-ups] Unhandled error:", err)
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    )
  }
}
