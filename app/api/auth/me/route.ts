import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// GET - Return current authenticated user from session cookies (no client-side locks)
export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ user: null })
    }

    // Fetch profile for role + name
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, first_name, last_name, phone")
      .eq("user_id", authUser.id)
      .single()

    return NextResponse.json({
      user: {
        id: authUser.id,
        email: authUser.email,
        role: profile?.role || authUser.user_metadata?.role || "applicant",
        firstName: profile?.first_name || authUser.user_metadata?.first_name || null,
        lastName: profile?.last_name || authUser.user_metadata?.last_name || null,
        phone: profile?.phone || null,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
