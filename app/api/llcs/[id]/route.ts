import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function getOwnedLlc(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, llc: null, admin: null }

  const admin = createAdminClient()
  const { data: llc } = await admin
    .from("borrower_llcs")
    .select("*")
    .eq("id", id)
    .single()

  const owned = llc && (llc.user_id === user.id || (user.email && llc.email === user.email))
  return { user, llc: owned ? llc : null, admin }
}

// PATCH — update an LLC (owner only)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, llc, admin } = await getOwnedLlc(params.id)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!llc || !admin) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  for (const k of ["legal_name", "org_type", "state_of_formation", "formation_date", "address", "city", "state", "zip"]) {
    if (k in body) updates[k] = body[k] || null
  }
  if ("ein" in body) {
    updates.ein_encrypted = body.ein
      ? (await admin.rpc("encrypt_pii", { plaintext: String(body.ein) })).data ?? null
      : null
  }

  const { data, error } = await admin
    .from("borrower_llcs")
    .update(updates)
    .eq("id", params.id)
    .select("id, legal_name, org_type, state_of_formation, formation_date, address, city, state, zip")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ llc: data })
}

// DELETE — remove an LLC (owner only); its docs in storage are removed too
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { user, llc, admin } = await getOwnedLlc(params.id)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!llc || !admin) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: files } = await admin.storage.from("documents").list(`llcs/${params.id}`, { limit: 100 })
  if (files?.length) {
    await admin.storage.from("documents").remove(files.map((f) => `llcs/${params.id}/${f.name}`))
  }

  const { error } = await admin.from("borrower_llcs").delete().eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
