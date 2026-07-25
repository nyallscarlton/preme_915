import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPremeSms } from "@/lib/preme-sms"
import { getBaseUrl } from "@/lib/config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLOT_LABELS: Record<string, string> = {
  identification: "Photo ID (driver's license or passport)",
  income_verification: "Income docs (tax returns, W-2s, or pay stubs)",
  bank_statement: "Bank statements (last 2 months, all accounts)",
  llc_docs: "LLC documents (EIN letter, operating agreement, articles)",
  purchase_contract: "Purchase contract (or current mortgage statement)",
  lease_rent_roll: "Lease agreement / rent roll",
  insurance: "Insurance quote or policy",
  other: "Other documents",
}

/**
 * POST — request specific documents from the borrower via SMS + email.
 * Body: { items: string[], custom?: string, method?: "both"|"sms"|"email" }
 * Saves the request on the row (drives the /upload page highlighting) and
 * sends Riley's nudge with the borrower's upload link.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single()
  if (!profile || !["admin", "lender"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const items: string[] = (body.items || []).filter((i: string) => i in SLOT_LABELS)
  const custom: string = String(body.custom || "").trim()
  const method: string = body.method || "both"
  if (items.length === 0 && !custom) {
    return NextResponse.json({ error: "Pick at least one document or add a custom request" }, { status: 400 })
  }

  const { data: app } = await admin
    .from("loan_applications")
    .select("id, applicant_first_name, applicant_name, applicant_phone, applicant_email, application_number, guest_token")
    .eq("id", params.id)
    .single()
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  let guestToken = app.guest_token
  if (!guestToken) {
    guestToken = crypto.randomUUID()
    await admin.from("loan_applications").update({ guest_token: guestToken }).eq("id", app.id)
  }

  // Persist the ask — the borrower /upload page highlights exactly these
  await admin
    .from("loan_applications")
    .update({
      doc_request: {
        items,
        custom: custom || null,
        requested_at: new Date().toISOString(),
        requested_by: user.email || user.id,
      },
    })
    .eq("id", app.id)

  const firstName = app.applicant_first_name || (app.applicant_name || "").split(" ")[0] || "there"
  const uploadLink = `${getBaseUrl()}/upload?token=${encodeURIComponent(guestToken)}`
  const labels = items.map((i) => SLOT_LABELS[i])
  if (custom) labels.push(custom)

  let smsSent = false
  let emailSent = false

  if ((method === "both" || method === "sms") && app.applicant_phone) {
    const smsBody =
      `Hey ${firstName}, Riley with Preme Home Loans — to keep your loan moving we just need:\n` +
      labels.map((l) => `• ${l}`).join("\n") +
      `\n\nUpload here in a couple taps (photos are fine): ${uploadLink}\n\nReply with any questions. Reply STOP to opt out.`
    const sms = await sendPremeSms({
      toPhone: app.applicant_phone,
      message: smsBody,
      firstName,
      source: "doc_request",
      metadata: { application_id: app.id, requested_by: user.email || user.id },
    })
    smsSent = sms.ok
  }

  if ((method === "both" || method === "email") && app.applicant_email && !app.applicant_email.endsWith("@placeholder.preme")) {
    emailSent = await sendDocRequestEmail({
      to: app.applicant_email,
      firstName,
      applicationNumber: app.application_number,
      labels,
      uploadLink,
    })
    if (emailSent) {
      await admin.from("email_events").insert({
        event_type: "email.sent",
        recipient_email: app.applicant_email,
        application_number: app.application_number ?? null,
        subject: `Quick ask, ${firstName} — a few documents for your loan file`,
        event_timestamp: new Date().toISOString(),
      })
    }
  }

  return NextResponse.json({ success: true, smsSent, emailSent, uploadLink, requested: labels })
}

async function sendDocRequestEmail(p: {
  to: string
  firstName: string
  applicationNumber: string | null
  labels: string[]
  uploadLink: string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "Preme Home Loans <onboarding@resend.dev>").trim()

  const itemsHtml = p.labels
    .map(
      (l) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;font-size:14px">
        <span style="color:#997100;font-weight:700;margin-right:8px">•</span>${l}</td></tr>`
    )
    .join("")

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <tr><td style="background:#0a0a0a;padding:28px 40px;text-align:center">
    <span style="color:#fff;font-size:24px;font-weight:700;letter-spacing:3px">PREME</span>
    <span style="color:#997100;font-size:13px;display:block;margin-top:4px;letter-spacing:1px">HOME LOANS</span>
  </td></tr>
  <tr><td style="padding:36px 40px">
    <h1 style="color:#1a1a1a;font-size:20px;margin:0 0 8px">Hey ${p.firstName},</h1>
    <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 20px">
      Quick ask to keep your loan moving — we just need the following for your file:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${itemsHtml}</table>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${p.uploadLink}" style="display:inline-block;background:#997100;color:#fff;padding:15px 36px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600">
        Upload My Documents
      </a>
    </td></tr></table>
    <p style="color:#888;font-size:13px;text-align:center;margin:18px 0 0">
      Takes a couple of minutes — photos from your phone are fine.<br/>Ref: ${p.applicationNumber || ""}
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
      body: JSON.stringify({
        from: fromEmail,
        to: p.to,
        subject: `Quick ask, ${p.firstName} — a few documents for your loan file`,
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
