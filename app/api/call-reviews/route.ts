/**
 * Preme Home Loans — Call Reviews API
 *
 * GET /api/call-reviews — List all reviews
 * GET /api/call-reviews?call_id=xxx — Get specific review
 *
 * Reads from zx_contact_interactions where channel='call_review'.
 * Used by Mission Control Voice Lab to display coaching scorecards.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const callId = searchParams.get("call_id")
  const limit = parseInt(searchParams.get("limit") || "20")
  const offset = parseInt(searchParams.get("offset") || "0")

  const supabase = createAdminClient()

  try {
    if (callId) {
      const { data, error } = await supabase
        .from("zx_contact_interactions")
        .select("*")
        .eq("channel", "voice")
        .filter("metadata->>type", "eq", "call_review")
        .filter("metadata->>call_id", "eq", callId)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

      return NextResponse.json(formatReview(data))
    }

    // List all reviews
    const { data, error, count } = await supabase
      .from("zx_contact_interactions")
      .select("*", { count: "exact" })
      .eq("channel", "voice")
        .filter("metadata->>type", "eq", "call_review")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    const reviews = (data || []).map(formatReview)
    const avgScore = reviews.length > 0
      ? Math.round(reviews.reduce((sum, r) => sum + (r.score_total || 0), 0) / reviews.length)
      : 0

    return NextResponse.json({
      reviews,
      total: count || 0,
      avg_score: avgScore,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error("[call-reviews] API error:", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}

function formatReview(row: any) {
  const meta = row.metadata || {}
  return {
    call_id: meta.call_id,
    agent_id: meta.agent_id,
    caller_phone: row.phone,
    caller_name: meta.caller_name,
    direction: row.direction,
    duration_seconds: meta.duration_seconds,
    recording_url: meta.recording_url,
    transcript: meta.transcript,
    disconnect_reason: meta.disconnect_reason,
    lead_temperature: meta.lead_temperature,
    lead_score: meta.lead_score,
    loan_type: meta.loan_type,
    caller_intent: meta.caller_intent,
    call_summary: meta.call_summary,
    call_at: meta.call_at,
    scores: meta.scores,
    score_total: meta.score_total,
    severity: meta.severity,
    top_fixes: meta.top_fixes,
    coaching_notes: row.content,
    what_went_well: meta.what_went_well,
    prompt_patch: meta.prompt_patch,
    prompt_patch_applied: meta.prompt_patch_applied,
    reviewed_at: row.created_at,
  }
}
