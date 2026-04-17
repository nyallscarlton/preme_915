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

  const steps: Array<{ n: string; title: string; body: string }> = [
    {
      n: "1",
      title: "Finish your application (5–8 min)",
      body: "A few final details — your DOB, SSN, property address, rental income, and the usual 1003 disclosures. Everything you've already given us is pre-filled.",
    },
    {
      n: "2",
      title: "We pull your credit + run the full lender check",
      body: "Soft-pull first to confirm your match, then a hard pull once you authorize the lock.",
    },
    {
      n: "3",
      title: "You get a written rate quote",
      body: "We present the best rate from your matched lender(s). You choose, we lock it in.",
    },
    {
      n: "4",
      title: "Appraisal + doc collection",
      body: "We order the appraisal (borrower-paid), and collect entity docs, insurance binder, and lease if applicable.",
    },
    {
      n: "5",
      title: "Close in 21–30 days",
      body: "Final numbers, CD, and wire. You sign, we fund. Simple.",
    },
  ]

  const stepsHtml = steps
    .map(
      (s) => `
      <tr><td style="padding:14px 0;border-top:1px solid #eee">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="44" valign="top">
            <div style="width:32px;height:32px;border-radius:16px;background:#997100;color:#fff;text-align:center;line-height:32px;font-weight:700;font-size:14px">${s.n}</div>
          </td>
          <td valign="top" style="padding-left:10px">
            <div style="color:#1a1a1a;font-size:15px;font-weight:600;margin-bottom:2px">${s.title}</div>
            <div style="color:#555;font-size:13px;line-height:1.5">${s.body}</div>
          </td>
        </tr></table>
      </td></tr>`
    )
    .join("")

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Brand header -->
      <tr><td style="background:#0a0a0a;padding:28px 40px;text-align:center">
        <span style="color:#fff;font-size:24px;font-weight:700;letter-spacing:3px">PR<span style="position:relative">E<span style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:16px;height:4px;background:#997100;display:block"></span></span>ME</span>
        <span style="color:#997100;font-size:14px;display:block;margin-top:4px;letter-spacing:1px">HOME LOANS</span>
      </td></tr>

      <!-- Hero / Congrats -->
      <tr><td style="padding:40px 40px 24px">
        <div style="font-size:14px;color:#997100;letter-spacing:1.5px;font-weight:600;margin-bottom:12px">🎉 PRE-QUALIFIED</div>
        <h1 style="color:#1a1a1a;font-size:26px;margin:0 0 12px;font-weight:700;line-height:1.25">
          Congrats, ${escapeHtml(p.firstName)} — you're pre-qualified with Preme's lenders.
        </h1>
        <p style="color:#444;font-size:16px;line-height:1.7;margin:0 0 24px">
          Based on what you told us, you fit our DSCR lender guidelines. Now we just need a few final details to fully underwrite your file and get you a real rate quote.
        </p>

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px">
          <a href="${p.link}" style="display:inline-block;background:#997100;color:#fff;padding:16px 40px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px">
            Finish My Application →
          </a>
          <div style="color:#888;font-size:12px;margin-top:8px">Takes 5–8 minutes • Everything's pre-filled</div>
        </td></tr></table>
      </td></tr>

      <!-- Steps roadmap -->
      <tr><td style="padding:0 40px 20px">
        <h2 style="color:#1a1a1a;font-size:16px;margin:0 0 8px;font-weight:700">Here's what happens next</h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${stepsHtml}
        </table>
      </td></tr>

      <!-- What we'll ask for -->
      <tr><td style="padding:16px 40px 32px">
        <div style="background:#fafafa;border-radius:8px;padding:20px;border-left:4px solid #997100">
          <h3 style="color:#1a1a1a;font-size:14px;margin:0 0 10px;font-weight:700;letter-spacing:0.3px">WHAT YOU'LL NEED HANDY</h3>
          <ul style="color:#555;font-size:13px;line-height:1.7;margin:0;padding-left:18px">
            <li>Your SSN + date of birth</li>
            <li>Property address + current lease (if tenant-occupied)</li>
            <li>If vesting in an LLC: legal name, EIN, formation state</li>
            <li>Basic info on any other rentals you own</li>
          </ul>
        </div>
      </td></tr>

      ${p.applicationNumber ? `<tr><td style="padding:0 40px 24px;text-align:center"><p style="color:#888;font-size:12px;margin:0">Ref: <span style="font-family:SFMono-Regular,Menlo,monospace;color:#997100">${escapeHtml(p.applicationNumber)}</span></p></td></tr>` : ""}

      <!-- Footer -->
      <tr><td style="background:#fafafa;padding:24px 40px;border-top:1px solid #eee">
        <p style="color:#999;font-size:12px;margin:0 0 6px;text-align:center">
          Questions? Reply to this email or call <strong style="color:#555">(470) 942-5787</strong>.
        </p>
        <p style="color:#bbb;font-size:11px;margin:0;text-align:center">
          Preme Home Loans &middot; premerealestate.com
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
        subject: `🎉 You're pre-qualified, ${p.firstName} — finish your application`,
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
  const retellKey = process.env.RETELL_API_KEY
  const retellFrom = process.env.RETELL_SMS_NUMBER || "+14709425787"
  if (!retellKey) return false
  try {
    const text =
      `🎉 ${p.firstName}, great news — you're PRE-QUALIFIED with Preme's lenders! ` +
      `I just need a few final details to finish your file and get you a real rate quote. ` +
      `Everything's pre-filled, takes about 5 min: ${p.link}\n\n` +
      `— Riley @ Preme Home Loans. Reply STOP to opt out, or call (470) 942-5787 with questions.`

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
