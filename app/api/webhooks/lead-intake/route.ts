/**
 * POST /api/webhooks/lead-intake
 *
 * Public webhook for landing page lead form submissions.
 *
 * Receives the same payload format that Zentryx /api/leads accepts so the
 * landing page form can be redirected here without changing its body.
 *
 * Pipeline:
 *   1. Validate + normalize the payload
 *   2. Insert into preme.leads
 *   3. Fire ONE Retell call inline (speed-to-lead)
 *   4. Enqueue the remaining 12 cadence steps
 *   5. Log everything to marathon.execution_log
 *   6. Return 200 with lead_id (or 4xx/5xx on failure)
 *
 * CORS: this endpoint accepts cross-origin POSTs from go.premerealestate.com
 * (and other Marathon Empire landing page hosts) so the form can call it
 * directly from the browser.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enqueueCadence, triggerSingleCall, shouldSkipLead } from "@/lib/preme-cadence"
import { ExecLog } from "@/lib/exec-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ALLOWED_ORIGINS = [
  "https://go.premerealestate.com",
  "https://www.premerealestate.com",
  "https://premerealestate.com",
  "https://app.premerealestate.com",
  "https://app.zyntrxmarketing.com",
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  })
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request.headers.get("origin"))
  const log = new ExecLog("preme-intake", "webhook", "preme", "preme-intake")

  try {
    const body = await request.json()

    // Accept BOTH the old Preme contact form shape AND the Zentryx landing form shape
    const first_name = (body.first_name || "").trim()
    const last_name = (body.last_name || "").trim()
    const email = (body.email || "").trim().toLowerCase()
    const phoneRaw = (body.phone || "").trim()
    // Zentryx wraps loan_type inside custom_fields; Preme contact form sends it flat
    const loan_type = body.loan_type || body.custom_fields?.loan_type || null
    const loan_amount = body.loan_amount || null
    const message = (body.message || "").trim() || null

    // Source: prefer the Zentryx landing slug if present, otherwise whatever the
    // caller passed (e.g. "contact" from the old Preme contact form)
    const source = body.source || (body.landing_page_slug ? `landing:${body.landing_page_slug}` : "lead-intake")

    const utm_source = body.utm_source || null
    const utm_medium = body.utm_medium || null
    const utm_campaign = body.utm_campaign || null

    // ── Validation ────────────────────────────────────────────────────
    if (!first_name || !last_name || !email) {
      await log.fail("missing required fields: first_name, last_name, email")
      return NextResponse.json({ error: "first_name, last_name, and email are required" }, { status: 400, headers: cors })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await log.fail(`invalid email: ${email}`)
      return NextResponse.json({ error: "Invalid email address" }, { status: 400, headers: cors })
    }

    // Phone normalization + cheap fake-number sanity check
    const phoneDigits = phoneRaw.replace(/\D/g, "")
    const tenDigit = phoneDigits.startsWith("1") ? phoneDigits.slice(1) : phoneDigits
    if (tenDigit.length !== 10) {
      await log.fail(`invalid phone — must be 10 digits: ${phoneRaw}`)
      return NextResponse.json({ error: "Invalid phone number — must be 10 digits" }, { status: 400, headers: cors })
    }
    const areaCode = tenDigit.slice(0, 3)
    if (
      areaCode.startsWith("0") || areaCode.startsWith("1") ||
      tenDigit.startsWith("555") ||
      /^(\d)\1{9}$/.test(tenDigit) ||
      tenDigit === "1234567890" || tenDigit === "9876543210"
    ) {
      await log.fail(`fake-looking phone rejected: ${tenDigit}`)
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400, headers: cors })
    }
    const phone = tenDigit

    // ── Duplicate guard (same email in last 24h) ──────────────────────
    const adminClient = createAdminClient()
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await adminClient
      .from("leads")
      .select("id")
      .eq("email", email)
      .gte("created_at", yesterday)
      .limit(1)
      .maybeSingle()

    if (existing) {
      await log.complete({
        result: "duplicate",
        existing_lead_id: existing.id,
        email,
      })
      return NextResponse.json({ success: true, lead_id: existing.id, duplicate: true }, { status: 200, headers: cors })
    }

    // ── Insert into preme.leads ───────────────────────────────────────
    const { data: lead, error: insertErr } = await adminClient
      .from("leads")
      .insert([{
        first_name,
        last_name,
        email,
        phone,
        loan_type,
        loan_amount,
        message,
        source,
        utm_source,
        utm_medium,
        utm_campaign,
        status: "new",
      }])
      .select("id, first_name, last_name, phone, email")
      .single()

    if (insertErr || !lead) {
      await log.fail(`preme.leads insert failed: ${insertErr?.message || "unknown"}`)
      return NextResponse.json({ error: "Failed to record lead" }, { status: 500, headers: cors })
    }

    // ── Skip-list / opt-out check ─────────────────────────────────────
    const skip = shouldSkipLead({ phone, status: "new" })
    if (skip.skip) {
      await log.complete({
        result: "skipped",
        reason: skip.reason,
        lead_id: lead.id,
      })
      return NextResponse.json({ success: true, lead_id: lead.id, skipped: skip.reason }, { status: 200, headers: cors })
    }

    // ── Step 1: fire ONE Retell call inline (speed-to-lead) ───────────
    const callResult = await triggerSingleCall({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      loan_type,
      source,
    })

    if (callResult.ok) {
      await adminClient
        .from("leads")
        .update({ retell_call_id: callResult.call_id, status: "contacting" })
        .eq("id", lead.id)
    }

    // ── Steps 2-13: enqueue the remaining cadence ─────────────────────
    const queueResult = await enqueueCadence({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
    })

    await log.complete({
      result: "enrolled",
      event_type: "lead_received",
      lead_id: lead.id,
      lead_name: `${first_name} ${last_name}`,
      lead_phone: phone,
      source,
      call_placed: callResult.ok,
      call_id: callResult.call_id || null,
      from_number: callResult.from_number || null,
      cadence_rows_created: queueResult.rows_created,
    })

    return NextResponse.json({
      success: true,
      lead_id: lead.id,
      call_placed: callResult.ok,
      cadence_steps: queueResult.rows_created,
    }, { status: 200, headers: cors })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await log.fail(`lead-intake handler crashed: ${msg}`)
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: cors })
  }
}
