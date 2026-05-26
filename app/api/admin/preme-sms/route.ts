import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendPremeSmsByObjective } from "@/lib/preme-sms"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  const role = profile?.role || user.user_metadata?.role || "applicant"
  if (role !== "admin" && role !== "lender") return null
  return user
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: { contact_id?: string; to_phone?: string; first_name?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  if (!body.to_phone || !body.message?.trim()) {
    return NextResponse.json({ ok: false, error: "to_phone and message required" }, { status: 400 })
  }

  const result = await sendPremeSmsByObjective({
    toPhone: body.to_phone,
    objective: "custom_ad_hoc",
    payload: { message: body.message.trim() },
    firstName: body.first_name,
    contactId: body.contact_id,
    source: `admin-manual:${user.email}`,
  })

  if ("dryRun" in result) {
    return NextResponse.json({ ok: false, error: "unexpected dryRun" }, { status: 500 })
  }
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, chat_id: result.chatId, from: result.from })
}
