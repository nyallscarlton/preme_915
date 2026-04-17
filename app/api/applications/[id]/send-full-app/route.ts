/**
 * POST /api/applications/[id]/send-full-app
 *
 * Admin-triggered: emails the borrower the magic link to complete the full 1003.
 * Works for any loan_applications row — pre-qual, sent/opened, even re-sends
 * for submitted apps that need a re-review. Updates sent_at / sent_via so the
 * existing cadence + tracking picks up the touch.
 *
 * Body: { delivery_method: "email" | "sms" | "both" }  (default "email")
 */
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBaseUrl } from "@/lib/config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth: admin or lender only
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single()
    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const deliveryMethod: "email" | "sms" | "both" = body.delivery_method ?? "email"

    const admin = createAdminClient()
    const { data: app, error } = await admin
      .from("loan_applications")
      .select("id, guest_token, applicant_email, applicant_name, applicant_first_name, applicant_phone, application_number, status")
      .eq("id", params.id)
      .single()
    if (error || !app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

    // Ensure a guest token exists
    let guestToken = app.guest_token
    if (!guestToken) {
      guestToken = crypto.randomUUID()
      await admin.from("loan_applications").update({ guest_token: guestToken }).eq("id", app.id)
    }

    const firstName = app.applicant_first_name || app.applicant_name?.split(" ")[0] || "there"
    const base = getBaseUrl()
    const link = `${base}/apply?guest=1&token=${encodeURIComponent(guestToken)}`

    let emailSent = false
    let smsSent = false

    if (deliveryMethod === "email" || deliveryMethod === "both") {
      if (app.applicant_email && !app.applicant_email.endsWith("@placeholder.preme")) {
        emailSent = await sendEmail({
          to: app.applicant_email,
          firstName,
          applicationNumber: app.application_number,
          link,
        })
      }
    }

    if (deliveryMethod === "sms" || deliveryMethod === "both") {
      if (app.applicant_phone) {
        smsSent = await sendSms({ to: app.applicant_phone, firstName, link })
      }
    }

    // Same tracking columns as the original send-app flow
    await admin
      .from("loan_applications")
      .update({
        sent_at: new Date().toISOString(),
        sent_via: deliveryMethod,
        pre_qual_to_full_sent_at: new Date().toISOString(),
        status: app.status === "pre_qualified" ? "sent" : app.status,
      })
      .eq("id", app.id)

    return NextResponse.json({ success: true, emailSent, smsSent, link })
  } catch (err) {
    console.error("[send-full-app] error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 })
  }
}

async function sendEmail(p: { to: string; firstName: string; applicationNumber: string | null; link: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const fromEmail = process.env.RESEND_FROM_EMAIL || "Preme Home Loans <onboarding@resend.dev>"
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#0a0a0a;padding:28px 40px;text-align:center">
        <span style="color:#fff;font-size:24px;font-weight:700;letter-spacing:3px">PR<span style="position:relative">E<span style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:16px;height:4px;background:#997100;display:block"></span></span>ME</span>
        <span style="color:#997100;font-size:14px;display:block;margin-top:4px;letter-spacing:1px">HOME LOANS</span>
      </td></tr>
      <tr><td style="padding:40px">
        <h1 style="color:#1a1a1a;font-size:22px;margin:0 0 16px">Hey ${escapeHtml(p.firstName)},</h1>
        <h2 style="color:#997100;font-size:18px;margin:0 0 16px">Ready for your full application?</h2>
        <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 28px">
          You're pre-qualified — now complete the full 1003 so we can lock in your rate and route your file to the lender. We've pre-filled everything you've already given us, so it should only take a few minutes.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
          <a href="${p.link}" style="display:inline-block;background:#997100;color:#fff;padding:16px 40px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600">Complete My Application</a>
        </td></tr></table>
        ${p.applicationNumber ? `<p style="color:#888;font-size:13px;text-align:center;margin:20px 0 0">Ref: ${escapeHtml(p.applicationNumber)}</p>` : ""}
      </td></tr>
      <tr><td style="background:#fafafa;padding:24px 40px;border-top:1px solid #eee">
        <p style="color:#999;font-size:12px;margin:0;text-align:center">
          Preme Home Loans | (470) 942-5787 | premerealestate.com
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromEmail,
        to: p.to,
        subject: "Complete your loan application",
        html,
        tags: p.applicationNumber ? [{ name: "application_number", value: p.applicationNumber }] : [],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function sendSms(p: { to: string; firstName: string; link: string }): Promise<boolean> {
  // Preme SMS rule (memory): Retell chat.createSMSChat from +14709425787 ONLY.
  // Fall back to a soft-fail if Retell isn't configured in this env.
  const retellKey = process.env.RETELL_API_KEY
  const retellFrom = process.env.RETELL_SMS_NUMBER || "+14709425787"
  if (!retellKey) return false
  try {
    const text = `Hey ${p.firstName}, this is Riley at Preme. Complete your full application here: ${p.link}  (Reply STOP to opt out)`
    const res = await fetch("https://api.retellai.com/create-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${retellKey}` },
      body: JSON.stringify({
        from_number: retellFrom,
        to_number: p.to,
        content: text,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}
