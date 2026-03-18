import { NextRequest, NextResponse } from "next/server"
import {
  getConditions,
  addCondition,
  updateConditionStatus,
  deleteCondition,
  matchDscrLenders,
  getDocumentsForApplication,
  CONDITION_TEMPLATES,
} from "@/lib/conditions"
import { createAdminClient } from "@/lib/supabase/admin"
import { extractConditionsFromFile } from "@/lib/extract-conditions"
import { getBaseUrl } from "@/lib/config"

export const dynamic = "force-dynamic"

// GET /api/applications/[id]/conditions — conditions + documents + lender matches
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const applicationId = params.id

  const [conditions, lenderMatch, documents] = await Promise.all([
    getConditions(applicationId),
    matchDscrLenders(applicationId),
    getDocumentsForApplication(applicationId),
  ])

  const total = conditions.length
  const received = conditions.filter((c) => c.status === "submitted" || c.status === "approved").length
  const cleared = conditions.filter((c) => c.status === "approved").length

  return NextResponse.json({
    conditions,
    documents,
    lenderMatch,
    progress: { total, received, cleared, pending: total - received },
    templates: CONDITION_TEMPLATES,
  })
}

// POST /api/applications/[id]/conditions — add/update/delete/upload/send
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const contentType = request.headers.get("content-type") || ""
  const applicationId = params.id

  // Handle file upload (multipart form)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const action = formData.get("action") as string | null
    const conditionId = formData.get("condition_id") as string | null
    const file = formData.get("file") as File | null
    const uploadedBy = (formData.get("uploaded_by") as string) || "admin"

    if (!file) {
      return NextResponse.json({ error: "File required" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // ── AI Extract: read PDF/image and extract conditions ──
    if (action === "extract") {
      try {
        const extracted = await extractConditionsFromFile(buffer, file.type, file.name)

        // Add each extracted condition to the application
        const added = []
        for (const ec of extracted) {
          const c = await addCondition(applicationId, ec.title, ec.description || undefined)
          // If the extracted status isn't outstanding, update it
          if (ec.status !== "outstanding") {
            await updateConditionStatus(c.id, ec.status, `Imported from ${file.name}`)
          }
          added.push({ ...c, status: ec.status })
        }

        return NextResponse.json({
          success: true,
          extracted: added.length,
          conditions: added,
          source: file.name,
        })
      } catch (err) {
        return NextResponse.json({
          error: `Extraction failed: ${(err as Error).message}`,
        }, { status: 500 })
      }
    }

    // ── Regular file upload (attach document to condition) ──
    const supabase = createAdminClient()
    const ext = file.name.split(".").pop() || "pdf"
    const storagePath = `${applicationId}/${conditionId || "general"}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("conditions")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from("conditions").getPublicUrl(storagePath)

    // Insert document record
    await supabase.from("loan_documents").insert({
      application_id: applicationId,
      file_name: file.name,
      storage_path: storagePath,
      document_type: conditionId ? undefined : "general",
      status: "submitted",
      uploaded_by: uploadedBy,
    })

    // If linked to a condition, update its status to submitted
    if (conditionId) {
      await updateConditionStatus(conditionId, "submitted", `File uploaded: ${file.name}`)
    }

    return NextResponse.json({ success: true, file_url: urlData.publicUrl, file_name: file.name })
  }

  // Handle JSON actions
  const body = await request.json()

  if (body.action === "add") {
    const condition = await addCondition(applicationId, body.label, body.description)
    return NextResponse.json({ condition })
  }

  if (body.action === "add_batch") {
    const conditions = []
    for (const label of body.labels as string[]) {
      const c = await addCondition(applicationId, label)
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
    const conditions = await getConditions(applicationId)
    const pending = conditions.filter((c) => c.status === "outstanding")

    if (pending.length === 0) {
      return NextResponse.json({ error: "No outstanding conditions to send" }, { status: 400 })
    }

    const lenderData = await matchDscrLenders(applicationId)
    const app = lenderData.application
    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : getBaseUrl())
    const portalUrl = `${baseUrl}/portal/${app.guest_token}`

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
          to: [app.applicant_email],
          subject: "Action Required: Documents Needed — Preme Home Loans",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#1a1a1a">Hi ${app.applicant_name.split(" ")[0]},</h2>
              <p>To move forward with your loan (${app.application_number}), we need the following:</p>
              <ul style="background:#f7f7f7;padding:16px 16px 16px 32px;border-radius:8px;list-style:disc">
                ${htmlItems}
              </ul>
              <p>Upload your documents through your secure portal:</p>
              <div style="text-align:center;margin:24px 0">
                <a href="${portalUrl}" style="background:#997100;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                  Upload Documents
                </a>
              </div>
              <p style="color:#666;font-size:13px">Questions? Call us at (470) 942-5787.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
              <p style="color:#999;font-size:12px">Preme Home Loans — Fast Funding for Real Estate Investors</p>
            </div>
          `,
          text: `Hi ${app.applicant_name.split(" ")[0]},\n\nTo move forward with your loan, we need:\n\n${textItems}\n\nUpload here: ${portalUrl}\n\nPreme Home Loans\n(470) 942-5787`,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `Email failed: ${err}` }, { status: 500 })
      }

      return NextResponse.json({ success: true, portal_url: portalUrl })
    }

    return NextResponse.json({
      success: true,
      portal_url: portalUrl,
      manual: true,
      message: "No email service configured. Share this portal link manually.",
    })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
