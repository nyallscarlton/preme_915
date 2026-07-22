import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function requireUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Rows visible to a user: linked by user_id, or created pre-account with their email
function userFilter(query: any, user: { id: string; email?: string | null }) {
  return user.email
    ? query.or(`user_id.eq.${user.id},email.eq.${user.email}`)
    : query.eq("user_id", user.id)
}

// GET — list the caller's LLCs
export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await userFilter(
    admin.from("borrower_llcs").select("id, legal_name, org_type, state_of_formation, formation_date, address, city, state, zip, ein_encrypted, created_at"),
    user
  ).order("created_at", { ascending: false })

  if (error) {
    // Table not yet migrated — return empty so the UI degrades gracefully
    if (error.code === "PGRST205" || /borrower_llcs/.test(error.message)) {
      return NextResponse.json({ llcs: [], migrated: false })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    llcs: (data || []).map((l) => ({ ...l, has_ein: !!l.ein_encrypted, ein_encrypted: undefined })),
    migrated: true,
  })
}

// POST — create an LLC for the caller
export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.legal_name?.trim()) {
    return NextResponse.json({ error: "legal_name is required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const einEncrypted = body.ein
    ? (await admin.rpc("encrypt_pii", { plaintext: String(body.ein) })).data ?? null
    : null

  const { data, error } = await admin
    .from("borrower_llcs")
    .insert([{
      user_id: user.id,
      email: user.email,
      legal_name: body.legal_name.trim(),
      org_type: body.org_type || "LLC",
      state_of_formation: body.state_of_formation || null,
      formation_date: body.formation_date || null,
      ein_encrypted: einEncrypted,
      address: body.address || null,
      city: body.city || null,
      state: body.state || null,
      zip: body.zip || null,
    }])
    .select("id, legal_name, org_type, state_of_formation, formation_date, address, city, state, zip")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ llc: data })
}
