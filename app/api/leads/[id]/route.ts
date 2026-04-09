import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET - Fetch single lead with interactions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Fetch the lead
    const { data: lead, error: leadError } = await adminClient
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Try to fetch related interactions (table may not exist yet)
    let interactions: any[] = []
    try {
      const { data: interactionData } = await adminClient
        .from("contact_interactions")
        .select("*")
        .or(`email.eq.${lead.email},phone.eq.${lead.phone}`)
        .order("created_at", { ascending: false })
        .limit(50)

      interactions = interactionData || []
    } catch {
      // Table may not exist — that's fine
    }

    return NextResponse.json({ success: true, lead, interactions })
  } catch (error) {
    console.error("[leads/id] API error:", error)
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 })
  }
}

// PATCH - Update lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const adminClient = createAdminClient()

    // Build update payload — only allow safe fields
    const allowedFields = [
      "first_name", "last_name", "email", "phone",
      "loan_type", "loan_amount", "message", "source",
      "status", "qualification_data", "call_transcript",
      "call_recording_url", "call_summary",
    ]

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ["new", "contacted", "qualified", "nurturing", "converted", "dead"]
      if (!validStatuses.includes(updateData.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        )
      }
    }

    const { data: lead, error } = await adminClient
      .from("leads")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("[leads/id] Update error:", error)
      return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead })
  } catch (error) {
    console.error("[leads/id] API error:", error)
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }
}

// DELETE - Remove lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from("leads")
      .delete()
      .eq("id", params.id)

    if (error) {
      console.error("[leads/id] Delete error:", error)
      return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[leads/id] API error:", error)
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
  }
}
