import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BUCKET = "documents"

/**
 * Authenticate the request. Returns either a user ID (for authenticated users)
 * or validates a guest_token against the application. Returns null on failure.
 */
async function authenticateRequest(
  request: NextRequest,
  applicationId: string
): Promise<{ authorized: boolean; isGuest: boolean }> {
  // Try authenticated user first
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    return { authorized: true, isGuest: false }
  }

  // Fall back to guest_token authentication
  const guestToken =
    request.headers.get("x-guest-token") ||
    new URL(request.url).searchParams.get("guest_token")

  if (!guestToken || !applicationId) {
    return { authorized: false, isGuest: true }
  }

  const adminClient = createAdminClient()
  const { data: app, error } = await adminClient
    .from("loan_applications")
    .select("id")
    .eq("id", applicationId)
    .eq("guest_token", guestToken)
    .single()

  if (error || !app) {
    return { authorized: false, isGuest: true }
  }

  return { authorized: true, isGuest: true }
}

/**
 * POST — Upload a document.
 * Accepts FormData with: file, applicationId, category, and optionally guest_token.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const applicationId = formData.get("applicationId") as string | null
    const category = formData.get("category") as string | null
    const guestToken = formData.get("guest_token") as string | null

    if (!file || !applicationId || !category) {
      return NextResponse.json(
        { error: "Missing required fields: file, applicationId, category" },
        { status: 400 }
      )
    }

    // Build a mock request with the guest token header for auth
    const authRequest = guestToken
      ? new NextRequest(request.url, {
          headers: new Headers({ "x-guest-token": guestToken }),
        })
      : request

    const { authorized } = await authenticateRequest(authRequest, applicationId)
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Upload using admin client (bypasses RLS on storage)
    const adminClient = createAdminClient()
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const path = `applications/${applicationId}/${category}/${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("[documents] Upload error:", uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(path)

    return NextResponse.json({
      success: true,
      document: {
        name: file.name,
        path,
        url: urlData.publicUrl,
        category,
        created_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[documents] POST error:", error)
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
  }
}

/**
 * GET — List documents for an application.
 * Query params: applicationId, guest_token (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const applicationId = searchParams.get("applicationId")

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 })
    }

    const { authorized } = await authenticateRequest(request, applicationId)
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const prefix = `applications/${applicationId}`

    // List category folders
    const { data: folders, error: folderError } = await adminClient.storage
      .from(BUCKET)
      .list(prefix, { limit: 100 })

    if (folderError) {
      console.error("[documents] List folders error:", folderError)
      return NextResponse.json({ error: folderError.message }, { status: 500 })
    }

    const documents: Array<{
      name: string
      path: string
      url: string
      category: string
      created_at: string
    }> = []

    for (const folder of folders || []) {
      const categoryPath = `${prefix}/${folder.name}`
      const { data: files } = await adminClient.storage
        .from(BUCKET)
        .list(categoryPath, { limit: 100 })

      if (!files) continue

      for (const file of files) {
        if (!file.name) continue
        const filePath = `${categoryPath}/${file.name}`
        const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(filePath)

        documents.push({
          name: file.name.replace(/^\d+-/, ""),
          path: filePath,
          url: urlData.publicUrl,
          category: folder.name,
          created_at: file.created_at || new Date().toISOString(),
        })
      }
    }

    return NextResponse.json({ success: true, documents })
  } catch (error) {
    console.error("[documents] GET error:", error)
    return NextResponse.json({ error: "Failed to list documents" }, { status: 500 })
  }
}

/**
 * DELETE — Delete a document.
 * Query params: path, applicationId, guest_token (optional)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get("path")
    const applicationId = searchParams.get("applicationId")

    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 })
    }

    // Extract applicationId from path if not provided
    const effectiveAppId =
      applicationId || path.match(/^applications\/([^/]+)\//)?.[1]

    if (!effectiveAppId) {
      return NextResponse.json({ error: "Cannot determine applicationId" }, { status: 400 })
    }

    const { authorized } = await authenticateRequest(request, effectiveAppId)
    if (!authorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.storage.from(BUCKET).remove([path])

    if (error) {
      console.error("[documents] Delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[documents] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 })
  }
}
