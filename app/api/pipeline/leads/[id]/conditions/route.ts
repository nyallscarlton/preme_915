import { NextRequest, NextResponse } from "next/server"
import {
  getConditions,
  addCondition,
  updateConditionStatus,
  deleteCondition,
  matchDscrLenders,
  findApplicationForLead,
  CONDITION_TEMPLATES,
} from "@/lib/conditions"

// GET /api/pipeline/leads/[id]/conditions — conditions + lender matches
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Find the loan application linked to this lead
  const application = await findApplicationForLead(params.id)

  if (!application) {
    return NextResponse.json({
      conditions: [],
      lenderMatch: null,
      progress: { total: 0, received: 0, approved: 0, pending: 0 },
      templates: CONDITION_TEMPLATES,
      application: null,
    })
  }

  const [conditions, lenderMatch] = await Promise.all([
    getConditions(application.id),
    matchDscrLenders(application.id),
  ])

  const total = conditions.length
  const submitted = conditions.filter((c) => c.status === "submitted" || c.status === "approved").length
  const approved = conditions.filter((c) => c.status === "approved").length

  return NextResponse.json({
    conditions,
    lenderMatch,
    progress: { total, received: submitted, approved, pending: total - submitted },
    templates: CONDITION_TEMPLATES,
    application,
  })
}

// POST /api/pipeline/leads/[id]/conditions — add/update/delete/send
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Find linked application
  const application = await findApplicationForLead(params.id)
  if (!application) {
    return NextResponse.json({ error: "No loan application found for this lead" }, { status: 404 })
  }

  if (body.action === "add") {
    const condition = await addCondition(application.id, body.label, body.description)
    return NextResponse.json({ condition })
  }

  if (body.action === "add_batch") {
    const conditions = []
    for (const label of body.labels as string[]) {
      const c = await addCondition(application.id, label)
      conditions.push(c)
    }
    return NextResponse.json({ conditions })
  }

  if (body.action === "update_status") {
    await updateConditionStatus(body.condition_id, body.status, body.notes)
    return NextResponse.json({ success: true })
  }

  if (body.action === "delete") {
    await deleteCondition(body.condition_id)
    return NextResponse.json({ success: true })
  }

  if (body.action === "send_request_email") {
    const conditions = await getConditions(application.id)
    const pending = conditions.filter((c) => c.status === "outstanding")

    if (pending.length === 0) {
      return NextResponse.json({ error: "No outstanding conditions to send" }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    const portalUrl = `${baseUrl}/portal/${application.guest_token}`

    // Send via Resend if available
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      const htmlItems = pending.map((c) => `<li style="padding:4px 0">${c.title}</li>`).join("")
      const textItems = pending.map((c) => `• ${c.title}`).join("\n")

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "Preme Home Loans <noreply@premehl.com>",
          to: [application.applicant_email],
          subject: "Action Required: Documents Needed — Preme Home Loans",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#1a1a1a">Hi ${application.applicant_name.split(" ")[0]},</h2>
              <p>To move forward with your loan (${application.application_number}), we need the following:</p>
              <ul style="background:#f7f7f7;padding:16px 16px 16px 32px;border-radius:8px;list-style:disc">
                ${htmlItems}
              </ul>
              <p>Upload your documents through your secure portal:</p>
              <div style="text-align:center;margin:24px 0">
                <a href="${portalUrl}" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                  Upload Documents
                </a>
              </div>
              <p style="color:#666;font-size:13px">Questions? Call us at (470) 942-5787.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
              <p style="color:#999;font-size:12px">Preme Home Loans — Fast Funding for Real Estate Investors</p>
            </div>
          `,
          text: `Hi ${application.applicant_name.split(" ")[0]},\n\nTo move forward with your loan, we need:\n\n${textItems}\n\nUpload here: ${portalUrl}\n\nPreme Home Loans\n(470) 942-5787`,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `Email failed: ${err}` }, { status: 500 })
      }

      return NextResponse.json({ success: true, portal_url: portalUrl })
    }

    // No email service — return portal URL for manual sharing
    return NextResponse.json({
      success: true,
      portal_url: portalUrl,
      manual: true,
      message: "No email service configured. Share this portal link via SMS.",
    })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
