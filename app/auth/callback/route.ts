import { NextResponse, type NextRequest } from "next/server"
import { supabaseServer } from "@/lib/supabase/serverClient"

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const next = url.searchParams.get("next") || "/dashboard"

  const supabase = supabaseServer()
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const loc = `/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`
      return NextResponse.redirect(new URL(loc, url.origin))
    }

    if (!user.email_confirmed_at) {
      await supabase.auth.signOut()
      const loc = `/auth/check-email?email=${encodeURIComponent(user.email ?? "")}${
        next ? `&next=${encodeURIComponent(next)}` : ""
      }`
      return NextResponse.redirect(new URL(loc, url.origin))
    }

    return NextResponse.redirect(new URL(next, url.origin))
  } catch {
    const loc = `/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`
    return NextResponse.redirect(new URL(loc, url.origin))
  }
}


