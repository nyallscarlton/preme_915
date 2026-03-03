import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
      console.error("[leads] Insert error:", error)
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

    const { data: leads, error } = await supabase
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
