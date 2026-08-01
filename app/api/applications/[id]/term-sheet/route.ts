import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPremeSms } from "@/lib/preme-sms"
import { getBaseUrl } from "@/lib/config"
import { computeScenario, type TermSheetInputs } from "@/lib/term-sheet-math"
import { renderTermSheetPdf } from "@/lib/term-sheet-pdf"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function requireAdmin() {
  const session = createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single()
  return profile && ["admin", "lender"].includes(profile.role) ? { user, admin } : null
}

/**
 * POST — generate a term sheet from the live calculator and (optionally)
 * send it to the borrower via SMS + email with a stable download link.
 * Body: { inputs: TermSheetInputs (base), scenarios: [{label, ratePercent,
 *         brokerPoints, lenderPoints}], send?: boolean }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { user, admin } = auth

  const body = await request.json()
  const base: TermSheetInputs = body.inputs
  const scenarioLevers: Array<{ label: string; ratePercent: number; brokerPoints: number; lenderPoints: number }> =
    body.scenarios || []
  if (!base || scenarioLevers.length === 0) {
    return NextResponse.json({ error: "inputs and scenarios required" }, { status: 400 })
  }

  const { data: app } = await admin
    .from("loan_applications")
    .select("id, applicant_name, applicant_first_name, applicant_phone, applicant_email, application_number, guest_token, entity_legal_name, property_address, property_city, property_state")
    .eq("id", params.id)
    .single()
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const scenarios = scenarioLevers.map((lev) =>
    computeScenario({ ...base, ratePercent: lev.ratePercent, brokerPoints: lev.brokerPoints, lenderPoints: lev.lenderPoints }, lev.label)
  )

  const propertyAddress =
    [app.property_address, app.property_city, app.property_state].filter(Boolean).join(", ") || "Subject property"

  const pdfBytes = await renderTermSheetPdf({
    borrowerName: app.applicant_name || "Borrower",
    entityName: app.entity_legal_name,
    propertyAddress,
    applicationNumber: app.application_number,
    inputs: base,
    scenarios,
  })

  const pdfPath = `${app.id}/term-sheet-${Date.now()}.pdf`
  const { error: upErr } = await admin.storage
    .from("preme-loan-files")
    .upload(pdfPath, Buffer.from(pdfBytes), { contentType: "application/pdf" })
  if (upErr) return NextResponse.json({ error: `PDF upload failed: ${upErr.message}` }, { status: 500 })

  const { data: tsRow, error: insErr } = await admin
    .from("term_sheets")
    .insert([{
      application_id: app.id,
      inputs: base,
      scenarios,
      pdf_path: pdfPath,
      created_by: user.email || user.id,
    }])
    .select("id")
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  let smsSent = false
  let emailSent = false

  if (body.send) {
    let guestToken = app.guest_token
    if (!guestToken) {
      guestToken = crypto.randomUUID()
      await admin.from("loan_applications").update({ guest_token: guestToken }).eq("id", app.id)
    }
    const firstName = app.applicant_first_name || (app.applicant_name || "").split(" ")[0] || "there"
    const link = `${getBaseUrl()}/api/term-sheet/${tsRow.id}?token=${encodeURIComponent(guestToken)}`

    if (app.applicant_phone) {
      const sms = await sendPremeSms({
        toPhone: app.applicant_phone,
        message:
          `Hey ${firstName}, Riley with Preme Home Loans — just sent over your loan term sheet with your ` +
          `numbers fully laid out, including estimated cash to close: ${link}\n\n` +
          `Estimates only — reply here with any questions and we'll walk through it. Reply STOP to opt out.`,
        firstName,
        source: "term_sheet",
        metadata: { application_id: app.id, term_sheet_id: tsRow.id },
      })
      smsSent = sms.ok
    }

    if (app.applicant_email && !app.applicant_email.endsWith("@placeholder.preme")) {
      emailSent = await sendTermSheetEmail({ to: app.applicant_email, firstName, link, applicationNumber: app.application_number })
    }

    await admin.from("term_sheets").update({ sent_sms: smsSent, sent_email: emailSent }).eq("id", tsRow.id)
  }

  const { data: signed } = await admin.storage.from("preme-loan-files").createSignedUrl(pdfPath, 60 * 60)

  return NextResponse.json({
    success: true,
    termSheetId: tsRow.id,
    pdfUrl: signed?.signedUrl || null,
    smsSent,
    emailSent,
    scenarios,
  })
}

async function sendTermSheetEmail(p: { to: string; firstName: string; link: string; applicationNumber: string | null }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "Preme Home Loans <onboarding@resend.dev>").trim()
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <tr><td style="background:#0a0a0a;padding:28px 40px;text-align:center">
    <span style="color:#fff;font-size:24px;font-weight:700;letter-spacing:3px">PREME</span>
    <span style="color:#997100;font-size:13px;display:block;margin-top:4px;letter-spacing:1px">HOME LOANS</span>
  </td></tr>
  <tr><td style="padding:36px 40px">
    <h1 style="color:#1a1a1a;font-size:20px;margin:0 0 10px">Hey ${p.firstName}, here's your term sheet</h1>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px">
      Your numbers, fully laid out — rate options side by side, every cost itemized, and exactly what
      to expect for cash to close. If anything doesn't make sense, reply or text us and we'll walk
      through it together.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${p.link}" style="display:inline-block;background:#997100;color:#fff;padding:15px 36px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
        View My Term Sheet (PDF)
      </a>
    </td></tr></table>
    <p style="color:#888;font-size:12px;text-align:center;margin:20px 0 0;line-height:1.5">
      Estimates for a business-purpose loan — not a Loan Estimate, rate lock, or commitment to lend.<br/>Ref: ${p.applicationNumber || ""}
    </p>
  </td></tr>
  <tr><td style="background:#fafafa;padding:20px 40px;border-top:1px solid #eee">
    <p style="color:#999;font-size:12px;margin:0;text-align:center">Preme Home Loans | (470) 942-5787 | premerealestate.com</p>
  </td></tr>
</table></td></tr></table></body></html>`
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromEmail, to: p.to, subject: `Your loan term sheet, ${p.firstName} — numbers fully laid out`, html }),
    })
    return res.ok
  } catch {
    return false
  }
}
