import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { triggerLeadFollowUp, triggerEmailOnlyFollowUp } from "@/lib/lead-followup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/leads/inbound — Receive qualified leads from Zentryx.
 * Validates webhook secret header, inserts into Preme leads table.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get("x-webhook-secret")
    const expectedSecret = process.env.ZENTRYX_INBOUND_SECRET || "zentryx-preme-2026"

    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 })
    }

    const body = await request.json()

    if (!body.first_name || !body.last_name || !body.email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const leadData = {
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email.toLowerCase(),
      phone: body.phone || null,
      loan_type: body.custom_fields?.loan_type || null,
      source: "zentryx",
      status: "qualified",
      qualification_data: body.qualification_data || null,
      call_summary: body.retell_summary || null,
    }

    const { data: lead, error } = await adminClient
      .from("leads")
      .insert([leadData])
      .select()
      .single()

    if (error) {
      console.error("[inbound] Insert error:", error)
      return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
    }

    // Notify MC about new inbound lead
    const mcUrl = process.env.MC_WEBHOOK_URL || "http://localhost:3000"
    fetch(`${mcUrl}/api/pipeline/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic YWRtaW46Mll1bmdueWFsbHMh",
      },
      body: JSON.stringify({
        name: `${leadData.first_name} ${leadData.last_name}`,
        email: leadData.email,
        phone: leadData.phone,
        source: "zentryx",
        loan_type: leadData.loan_type,
        entity: "preme",
        status: "qualified",
        notes: `Zentryx qualified lead. Temperature: ${body.temperature || "unknown"}. Score: ${body.score || "n/a"}`,
      }),
    }).catch(() => {})

    console.log("[inbound] Zentryx lead received:", lead.id, leadData.email)

    // Trigger follow-up cadence: full cadence if phone exists, email-only otherwise
    if (lead.phone) {
      triggerLeadFollowUp({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email,
        loan_type: lead.loan_type,
        source: lead.source,
        status: lead.status,
      }).catch((err) => console.error("[inbound] Follow-up trigger failed:", err))
    } else if (lead.email) {
      triggerEmailOnlyFollowUp({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: "",
        email: lead.email,
        loan_type: lead.loan_type,
        source: lead.source,
        status: lead.status,
      }).catch((err) => console.error("[inbound] Email-only follow-up trigger failed:", err))
    }

    return NextResponse.json({
      success: true,
      reference_id: lead.id,
      lead_id: lead.id,
    })
  } catch (error) {
    console.error("[inbound] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
