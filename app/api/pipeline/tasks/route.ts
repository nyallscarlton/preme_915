import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/pipeline/tasks — Get pending/upcoming tasks
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = request.nextUrl
  const status = searchParams.get("status") || "pending"
  const limit = parseInt(searchParams.get("limit") || "50")

  let query = supabase
    .from("zx_tasks")
    .select("*, zx_leads(id, first_name, last_name, phone, email, temperature, score)")
    .order("due_at", { ascending: true })
    .limit(limit)

  if (status === "pending") {
    query = query.in("status", ["pending", "overdue"])
  } else {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ tasks: data || [] })
}

// PATCH /api/pipeline/tasks — Update task status
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.status) {
    updates.status = body.status
    if (body.status === "completed") {
      updates.completed_at = new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from("zx_tasks")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ task: data })
}
