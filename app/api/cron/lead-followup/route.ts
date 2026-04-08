/**
 * Preme Home Loans -- Lead Follow-Up Cron Executor
 *
 * GET /api/cron/lead-followup
 *
 * Runs every 2 minutes via Vercel Cron. Picks up pending actions from
 * the lead_followup_queue table and executes them.
 *
 * Action types:
 *   call        — Outbound call via Retell
 *   sms         — Missed call SMS
 *   welcome_sms — Welcome text (Path 1 application cadence)
 *   email       — Post-cadence pre-qual email (Path 2)
 *   day1_email  — Day 1 nurture email (both paths)
 *   day3_email  — Day 3 final touch email (both paths)
 *
 * Before executing each action, checks if a previous call was answered
 * (duration > 30s) -- if so, cancels all remaining follow-ups for that lead.
 *
 * Protected by CRON_SECRET env var or Vercel's x-vercel-cron-signature header.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { triggerOutboundCall } from "@/lib/retell"
import { sendSms, buildWelcomeSms, buildMissedCallSms, buildSecondMissedCallSms } from "@/lib/sms"
import {
  sendPostCadenceEmail,
  sendDay1FollowUpEmail,
  sendDay3FollowUpEmail,
} from "@/lib/follow-up"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Training phones -- never contact
const EXCLUDED_PHONES = new Set(["+14706225965", "+19453088322"])

// Statuses that mean "stop following up"
// NOTE: "qualified" is intentionally NOT terminal — qualified leads still need
// follow-up texts and emails. Only truly dead/converted leads should stop.
const TERMINAL_STATUSES = new Set(["converted", "dead"])

export async function GET(request: Request) {
  // Auth: accept Vercel cron header or Bearer token
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    const vercelCron = request.headers.get("x-vercel-cron-signature")
    if (authHeader !== `Bearer ${cronSecret}` && !vercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  let executed = 0
  let cancelled = 0
  let failed = 0

  try {
    // Fetch all due pending actions
    const { data: actions, error: fetchError } = await supabase
      .from("lead_followup_queue")
      .select("*, leads!inner(id, first_name, last_name, phone, email, loan_type, source, status, retell_call_id)")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error("[cron/lead-followup] Query error:", fetchError.message)
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
    }

    if (!actions || actions.length === 0) {
      return NextResponse.json({ ok: true, executed: 0, cancelled: 0, failed: 0, message: "No pending actions" })
    }

    for (const action of actions) {
      const lead = action.leads as {
        id: string
        first_name: string
        last_name: string
        phone: string
        email: string
        loan_type: string | null
        source: string | null
        status: string | null
        retell_call_id: string | null
      }

      // Skip if lead is in a terminal status
      if (lead.status && TERMINAL_STATUSES.has(lead.status)) {
        await cancelAction(supabase, action.id, "lead_terminal_status")
        await cancelRemainingForLead(supabase, lead.id)
        cancelled++
        continue
      }

      // Skip excluded phones (but allow email-only actions through for phoneless leads)
      const digits = (lead.phone || "").replace(/\D/g, "")
      const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`
      const isEmailAction = ["email", "day1_email", "day3_email"].includes(action.action_type)
      if (EXCLUDED_PHONES.has(e164) || (!digits && !isEmailAction)) {
        await cancelAction(supabase, action.id, "excluded_or_invalid_phone")
        cancelled++
        continue
      }

      // Check if a previous call for this lead was answered (duration > 30s)
      const wasAnswered = await checkIfCallAnswered(supabase, lead.id)
      if (wasAnswered) {
        await cancelAction(supabase, action.id, "previous_call_answered")
        await cancelRemainingForLead(supabase, lead.id)
        cancelled++
        continue
      }

      // Execute the action
      try {
        let result: Record<string, unknown> = {}

        switch (action.action_type) {
          case "call": {
            const callResult = await triggerOutboundCall({
              id: lead.id,
              first_name: lead.first_name,
              last_name: lead.last_name,
              phone: lead.phone,
              loan_type: lead.loan_type || undefined,
              source: "follow_up",
            })

            if ("call_id" in callResult) {
              result = { call_id: callResult.call_id }
              await supabase
                .from("leads")
                .update({ retell_call_id: callResult.call_id })
                .eq("id", lead.id)
            } else {
              result = { error: callResult.error, code: callResult.code }
            }
            break
          }

          case "welcome_sms": {
            const message = buildWelcomeSms(lead.first_name, lead.loan_type)
            const smsResult = await sendSms(lead.phone, message)
            result = { success: smsResult.success, sid: smsResult.sid, error: smsResult.error }
            break
          }

          case "sms": {
            // Steps 2-3 in Path 1, steps 2/4 in Path 2
            // Use second missed call SMS for later steps (step >= 5 in Path 1, step >= 4 in Path 2)
            const message =
              action.step <= 3
                ? buildMissedCallSms(lead.first_name, lead.loan_type)
                : buildSecondMissedCallSms(lead.first_name, lead.loan_type)

            const smsResult = await sendSms(lead.phone, message)
            result = { success: smsResult.success, sid: smsResult.sid, error: smsResult.error }
            break
          }

          case "email": {
            // Post-cadence email (Path 2, +120 min)
            const emailResult = await sendPostCadenceEmail({
              email: lead.email,
              firstName: lead.first_name || "there",
              loanPurpose: lead.loan_type,
            })
            result = { success: emailResult }
            break
          }

          case "day1_email": {
            const emailResult = await sendDay1FollowUpEmail({
              email: lead.email,
              firstName: lead.first_name || "there",
              loanPurpose: lead.loan_type,
            })
            result = { success: emailResult }
            break
          }

          case "day3_email": {
            const emailResult = await sendDay3FollowUpEmail({
              email: lead.email,
              firstName: lead.first_name || "there",
              loanPurpose: lead.loan_type,
            })
            result = { success: emailResult }
            break
          }
        }

        // Mark action as completed
        await supabase
          .from("lead_followup_queue")
          .update({
            status: "completed",
            result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", action.id)

        executed++
        console.log(
          `[cron/lead-followup] Executed step ${action.step} (${action.action_type}) for lead ${lead.id}`,
        )
      } catch (execErr) {
        console.error(
          `[cron/lead-followup] Step ${action.step} failed for lead ${lead.id}:`,
          execErr,
        )
        await supabase
          .from("lead_followup_queue")
          .update({
            status: "failed",
            result: { error: String(execErr) },
            completed_at: new Date().toISOString(),
          })
          .eq("id", action.id)

        failed++
      }
    }

    console.log(
      `[cron/lead-followup] Run complete: ${executed} executed, ${cancelled} cancelled, ${failed} failed`,
    )

    return NextResponse.json({
      ok: true,
      executed,
      cancelled,
      failed,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[cron/lead-followup] Unhandled error:", err)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cancelAction(
  supabase: ReturnType<typeof createAdminClient>,
  actionId: string,
  reason: string,
) {
  await supabase
    .from("lead_followup_queue")
    .update({
      status: "cancelled",
      result: { reason },
      completed_at: new Date().toISOString(),
    })
    .eq("id", actionId)
}

async function cancelRemainingForLead(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
) {
  await supabase
    .from("lead_followup_queue")
    .update({
      status: "cancelled",
      result: { reason: "cadence_stopped" },
      completed_at: new Date().toISOString(),
    })
    .eq("lead_id", leadId)
    .eq("status", "pending")
}

/**
 * Check if any previous call for this lead was meaningfully answered.
 * The Retell webhook sets lead status to "qualified" when a meaningful
 * conversation happens (30+ sec call).
 */
async function checkIfCallAnswered(
  supabase: ReturnType<typeof createAdminClient>,
  leadId: string,
): Promise<boolean> {
  const { data: lead } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .single()

  return lead?.status === "qualified" || lead?.status === "converted"
}
