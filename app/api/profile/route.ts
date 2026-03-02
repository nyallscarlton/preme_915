import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Use the anon key for admin operations since service role key is not a valid JWT
// This route verifies the user's session first, then creates their own profile
export async function POST(request: Request) {
  const cookieStore = cookies()

  // Verify the caller is authenticated
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component context
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json()

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (existing) {
    return NextResponse.json({ profile: existing })
  }

  // Create profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      email: user.email,
      first_name: body.firstName || user.user_metadata?.first_name || null,
      last_name: body.lastName || user.user_metadata?.last_name || null,
      role: body.role || user.user_metadata?.role || "applicant",
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
