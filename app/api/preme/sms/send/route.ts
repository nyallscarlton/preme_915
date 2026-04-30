/**
 * POST /api/preme/sms/send
 *
 * Internal-auth endpoint for objective-driven Preme SMS sends. Designed to be
 * the canonical webhook target for GHL workflow steps and any other internal
 * caller that wants to send an SMS by objective + payload (Doc 02.13 §2.3).
 *
 * Auth: requires either of these headers
 *   - Authorization: Bearer ${CRON_SECRET}
 *   - x-internal-auth: ${CRON_SECRET}
 * (GHL workflow webhooks send the latter; existing Vercel crons + scripts
 * use the former.)
 *
 * Body shape (JSON):
 *   {
 *     "contact_id":  string,                 // GHL contact id OR Supabase lead id
 *     "objective":   Objective,              // one of the 13 canonical slugs
 *     "payload":     <objective payload>,    // shape per lib/preme-sms-objectives.ts
 *     "to_phone":    string (E.164),
 *     "first_name":  string,                 // optional, defaults to "there"
 *     "lead_id":     string,                 // optional supabase lead id
 *     "source":      string,                 // optional, defaults to "ghl-workflow"
 *     "metadata":    Record<string,string>,  // optional extras for retell metadata
 *     "dry_run":     boolean                 // optional, returns rendered preview without sending
 *   }
 *
 * Returns:
 *   200 { ok: true, chat_id, from }   on send success
 *   200 { ok: true, dry_run: true, rendered, dynamic_variables, from } on dry_run
 *   400 { ok: false, error }          on validation failure
 *   401 { ok: false, error }          on auth failure
 *   500 { ok: false, error }          on Retell or unexpected failure
 *
 * Built 2026-04-22 (P1 prereq) — see clark-queue/done/2026-04-22-1725-preme-sms-infra-audit.md
 * for the audit that surfaced the canonical-path gap.
 */

import { NextRequest, NextResponse } from "next/server"
import { contactHasTag, getContact } from "@/lib/ghl-client"
import { sendPremeSmsByObjective } from "@/lib/preme-sms"
import { OBJECTIVES, type Objective } from "@/lib/preme-sms-objectives"

export const dynamic = "force-dynamic"

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = request.headers.get("authorization")
  if (bearer === `Bearer ${secret}`) return true
  const internal = request.headers.get("x-internal-auth")
  if (internal === secret) return true
  return false
}

interface SendBody {
  contact_id?: string
  objective?: string
  payload?: unknown
  to_phone?: string
  first_name?: string
  lead_id?: string
  source?: string
  /** GHL custom field — lead interaction history. Injected as {{timeline_notes}} dynamic variable. */
  timeline_notes?: string
  /** Cadence position — P1, P2, or P3. Injected as {{phase}} dynamic variable. */
  phase?: string
  metadata?: Record<string, string | undefined>
  dry_run?: boolean
}

function isValidObjective(s: string): s is Objective {
  return (OBJECTIVES as readonly string[]).includes(s)
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  if (phone.startsWith("+")) return phone
  return `+${digits}`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  if (!body.contact_id || typeof body.contact_id !== "string") {
    return NextResponse.json(
      { ok: false, error: "contact_id (string) required" },
      { status: 400 },
    )
  }
  // to_phone is optional — if absent, resolve from contact_id via GHL
  if (!body.to_phone || typeof body.to_phone !== "string") {
    const contactRes = await getContact(body.contact_id)
    if (!contactRes.ok || !contactRes.data?.contact?.phone) {
      return NextResponse.json(
        { ok: false, error: "to_phone required (or contact must have a phone on file in GHL)" },
        { status: 400 },
      )
    }
    body.to_phone = toE164(contactRes.data.contact.phone)
    if (!body.first_name && contactRes.data.contact.firstName) {
      body.first_name = contactRes.data.contact.firstName
    }
  } else {
    body.to_phone = toE164(body.to_phone)
  }
  if (!body.objective || typeof body.objective !== "string" || !isValidObjective(body.objective)) {
    return NextResponse.json(
      {
        ok: false,
        error: "objective must be one of canonical 13",
        valid_objectives: [...OBJECTIVES],
      },
      { status: 400 },
    )
  }
  if (body.payload === undefined || body.payload === null) {
    return NextResponse.json({ ok: false, error: "payload required" }, { status: 400 })
  }

  // Doc 02.14 §2.3 — DNC enforcement. opt_out tag hard-kills any send,
  // regardless of objective (TCPA / 10DLC compliance).
  if (!body.dry_run) {
    const dncCheck = await contactHasTag(body.contact_id, "opt_out")
    if (dncCheck.ok && dncCheck.data?.has) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "send blocked — contact carries opt_out tag (DNC). All Preme outbound is hard-killed regardless of objective.",
        },
        { status: 403 },
      )
    }
    // dncCheck.ok=false (lookup failure) is NOT treated as block — surface but proceed,
    // because failing-closed on read errors would create a different outage class.
  }

  // Doc 02.14 §4.5 — gate loan_app_send on pre_qual_approved tag.
  if (body.objective === "loan_app_send") {
    const tagCheck = await contactHasTag(body.contact_id, "pre_qual_approved")
    if (!tagCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `loan_app_send gate check failed (could not look up contact): ${tagCheck.error || "unknown"}`,
        },
        { status: 502 },
      )
    }
    if (!tagCheck.data?.has) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "loan_app_send blocked — contact lacks pre_qual_approved tag. Solomon must approve the pre-qual first (Doc 02.14 §4.5).",
        },
        { status: 403 },
      )
    }
  }

  try {
    const result = await sendPremeSmsByObjective({
      toPhone: body.to_phone,
      objective: body.objective,
      payload: body.payload,
      firstName: body.first_name,
      contactId: body.contact_id,
      leadId: body.lead_id,
      source: body.source || "ghl-workflow",
      timelineNotes: body.timeline_notes,
      phase: body.phase,
      metadata: body.metadata,
      dryRun: body.dry_run === true,
    })

    if ("dryRun" in result) {
      return NextResponse.json({
        ok: true,
        dry_run: true,
        rendered: result.rendered,
        from: result.from,
        dynamic_variables: result.dynamicVariables,
      })
    }

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || "send_failed", from: result.from },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      chat_id: result.chatId,
      from: result.from,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

/** GET: simple health probe (no auth) — confirms the route is mounted. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/preme/sms/send",
    method: "POST",
    objectives_count: OBJECTIVES.length,
    note: "POST with x-internal-auth or Bearer CRON_SECRET to send. See lib/preme-sms-objectives.ts for objective + payload shapes.",
  })
}
