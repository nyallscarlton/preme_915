/**
 * Condition Notification Cron — runs every 30 min
 *
 * Checks for borrower-owed pending conditions that haven't been notified yet.
 * Single condition → SMS only. Multiple → SMS summary + email with details.
 * Also handles milestone updates when conditions are cleared.
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendPremeSms } from "@/lib/preme-sms"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "preme" } }
)

export async function GET() {
  try {
    // Find pending borrower conditions not yet notified
    const { data: pending, error } = await supabase
      .from("loan_conditions")
      .select("id, loan_id, title, description, condition_type, status, notified_at, created_at")
      .or("action_owner.eq.Borrower,requested_from.ilike.%borrower%")
      .in("status", ["Open", "Requested", "pending"])
      .is("notified_at", null)

    if (error) {
      console.error("[condition-notify] Query error:", error)
      return NextResponse.json({ ok: false, error: error.message })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, message: "No pending conditions" })
    }

    // Group by loan_id
    const byLoan: Record<string, typeof pending> = {}
    for (const c of pending) {
      const key = c.loan_id || "unknown"
      if (!byLoan[key]) byLoan[key] = []
      byLoan[key].push(c)
    }

    let totalNotified = 0

    for (const [loanId, conditions] of Object.entries(byLoan)) {
      // Get lead info for this loan
      const { data: app } = await supabase
        .from("loan_applications")
        .select("lead_id, applicant_name, applicant_phone, applicant_email")
        .eq("id", loanId)
        .single()

      if (!app?.applicant_phone) continue

      const firstName = (app.applicant_name || "").split(" ")[0] || "there"
      const phone = app.applicant_phone

      if (conditions.length === 1) {
        // Single condition → SMS only
        const c = conditions[0]
        await sendPremeSms({
          toPhone: phone,
          message: `Hey ${firstName}, your lender needs one more thing to keep your loan moving: ${c.title || c.description}. Reply if you need help.`,
          firstName,
          source: "condition_notify_single",
        })
      } else {
        // Multiple → SMS summary
        await sendPremeSms({
          toPhone: phone,
          message: `Hey ${firstName}, your lender needs ${conditions.length} items to keep your loan moving. Check your email for the full list — I sent details on each one.`,
          firstName,
          source: "condition_notify_multi",
        })

        // Email with details (via Resend if available, otherwise skip)
        try {
          const { Resend } = await import("resend")
          const resend = new Resend(process.env.RESEND_API_KEY)
          if (app.applicant_email && process.env.RESEND_API_KEY) {
            const conditionList = conditions.map((c, i) =>
              `${i + 1}. ${c.title || c.condition_type}: ${c.description}`
            ).join("\n")

            await resend.emails.send({
              from: "Preme Home Loans <loans@premerealestate.com>",
              to: app.applicant_email,
              subject: `${firstName}, ${conditions.length} items needed for your loan`,
              text: `Hey ${firstName},\n\nYour lender needs the following to keep your loan moving:\n\n${conditionList}\n\nYou're almost there! Reply to this email or text us if you need help with any of these.\n\nBest,\nPreme Home Loans Team`,
            })
          }
        } catch (emailErr) {
          console.error("[condition-notify] Email failed:", emailErr)
        }
      }

      // Mark all as notified
      const ids = conditions.map(c => c.id)
      await supabase
        .from("loan_conditions")
        .update({ notified_at: new Date().toISOString() })
        .in("id", ids)

      totalNotified += conditions.length
    }

    // Check for recently cleared conditions → milestone updates
    const { data: recentlyCleared } = await supabase
      .from("loan_conditions")
      .select("loan_id, title, cleared_date")
      .in("status", ["Closed", "cleared"])
      .not("cleared_date", "is", null)
      .gte("cleared_date", new Date(Date.now() - 30 * 60 * 1000).toISOString())

    // Group cleared by loan and check if all done
    if (recentlyCleared && recentlyCleared.length > 0) {
      const clearedByLoan: Record<string, typeof recentlyCleared> = {}
      for (const c of recentlyCleared) {
        const key = c.loan_id || "unknown"
        if (!clearedByLoan[key]) clearedByLoan[key] = []
        clearedByLoan[key].push(c)
      }

      for (const [loanId, cleared] of Object.entries(clearedByLoan)) {
        // Check remaining pending
        const { count: remaining } = await supabase
          .from("loan_conditions")
          .select("id", { count: "exact", head: true })
          .eq("loan_id", loanId)
          .in("status", ["Open", "Requested", "pending"])

        const { data: app } = await supabase
          .from("loan_applications")
          .select("lead_id, applicant_name, applicant_phone")
          .eq("id", loanId)
          .single()

        if (!app?.applicant_phone) continue
        const firstName = (app.applicant_name || "").split(" ")[0] || "there"

        if (remaining === 0) {
          // ALL cleared → clear to close
          await supabase
            .from("loan_applications")
            .update({ status: "clear_to_close", updated_at: new Date().toISOString() })
            .eq("id", loanId)

          await sendPremeSms({
            toPhone: app.applicant_phone,
            message: `Great news ${firstName} — your loan is clear to close! You'll hear from the title company soon to schedule closing.`,
            firstName,
            source: "condition_all_cleared",
          })
        }
      }
    }

    return NextResponse.json({ ok: true, notified: totalNotified })
  } catch (err) {
    console.error("[condition-notify] Error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
