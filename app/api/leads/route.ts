import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, createZentrxClient } from "@/lib/supabase/admin"
import { triggerLeadFollowUp, triggerEmailOnlyFollowUp } from "@/lib/lead-followup"
// preme-cadence: new 13-step independent system
import { enqueueCadence, triggerSingleCall } from "@/lib/preme-cadence"
import { ExecLog } from "@/lib/exec-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// POST - Public lead submission (no auth required)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.first_name?.trim() || !data.last_name?.trim() || !data.email?.trim()) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    // NEW: write to preme.leads (Preme-owned table). Previously this wrote
    // to zentryx.leads via createZentrxClient — that dependency is now broken.
    // createAdminClient() is already scoped to db.schema='preme'.
    const adminClient = createAdminClient()

    const leadData = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      loan_type: data.loan_type || null,
      loan_amount: data.loan_amount || null,
      message: data.message?.trim() || null,
      source: data.source || "website",
      utm_source: data.utm_source || null,
      utm_medium: data.utm_medium || null,
      utm_campaign: data.utm_campaign || null,
      status: "new",
    }

    const { data: lead, error } = await adminClient
      .from("leads")
      .insert([leadData])
      .select()
      .single()

    if (error) {
      console.error("[leads] preme.leads insert error:", error)
      return NextResponse.json({ error: "Failed to submit lead" }, { status: 500 })
    }

    // Fire-and-forget MC notification
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
        source: leadData.source,
        loan_type: leadData.loan_type,
        loan_amount: leadData.loan_amount,
        entity: "preme",
        status: "new",
      }),
    }).catch(() => {})

    // Trigger follow-up cadence: must await on Vercel serverless or function dies before completion
    if (lead.phone) {
      await triggerLeadFollowUp({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phone,
        email: lead.email,
        loan_type: lead.loan_type,
        source: lead.source,
        status: lead.status,
      })
    } else if (lead.email) {
      await triggerEmailOnlyFollowUp({
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: "",
        email: lead.email,
        loan_type: lead.loan_type,
        source: lead.source,
        status: lead.status,
      })
    }

    return NextResponse.json({ success: true, id: lead.id })
  } catch (error) {
    console.error("[leads] API error:", error)
    return NextResponse.json({ error: "Failed to process lead" }, { status: 500 })
  }
}

// GET - List leads (admin/lender only)
export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Use admin client to bypass RLS — auth check above is sufficient
    const adminClient = createZentrxClient()

    const { data: leads, error } = await adminClient
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, leads: leads || [] })
  } catch (error) {
    console.error("[leads] API error:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }
}

// PATCH - Bulk update leads (admin/lender only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { ids, status } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 })
    }

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 })
    }

    const validStatuses = ["new", "contacted", "qualified", "nurturing", "converted", "dead"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 })
    }

    const adminClient = createZentrxClient()

    const { data: updated, error } = await adminClient
      .from("leads")
      .update({ status, updated_at: new Date().toISOString() })
      .in("id", ids)
      .select()

    if (error) {
      console.error("[leads] Bulk update error:", error)
      return NextResponse.json({ error: "Failed to update leads" }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: updated?.length || 0 })
  } catch (error) {
    console.error("[leads] API error:", error)
    return NextResponse.json({ error: "Failed to update leads" }, { status: 500 })
  }
}
