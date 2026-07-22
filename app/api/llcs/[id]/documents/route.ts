import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BUCKET = "documents"

async function authorize(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null, ok: false }

  const admin = createAdminClient()
  const { data: llc } = await admin.from("borrower_llcs").select("user_id, email").eq("id", id).single()
  const owner = llc && (llc.user_id === user.id || (user.email && llc.email === user.email))

  // Admins can manage any LLC's docs
  let isAdmin = false
  if (!owner) {
    const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single()
    isAdmin = profile?.role === "admin"
  }
  return { user, admin, ok: !!owner || isAdmin }
}

// GET — list docs for an LLC
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, ok } = await authorize(params.id)
  if (!ok || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prefix = `llcs/${params.id}`
  const { data: files, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 100 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const documents = (files || [])
    .filter((f) => f.name)
    .map((f) => {
      const path = `${prefix}/${f.name}`
      return {
        name: f.name.replace(/^\d+-/, ""),
        path,
        url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
        created_at: f.created_at,
      }
    })
  return NextResponse.json({ documents })
}

// POST — upload a doc (FormData: file)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, ok } = await authorize(params.id)
  if (!ok || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 })

  const path = `llcs/${params.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    document: { name: file.name, path, url: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl },
  })
}

// DELETE — remove a doc (?path=)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { admin, ok } = await authorize(params.id)
  if (!ok || !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = new URL(request.url).searchParams.get("path")
  if (!path || !path.startsWith(`llcs/${params.id}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }
  const { error } = await admin.storage.from(BUCKET).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
