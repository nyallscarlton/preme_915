import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/serverClient"

export async function GET() {
  try {
    const supabase = supabaseServer()

    // Try reading current user via auth - serverless context may not have cookies; this is a basic connectivity test
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, email, is_admin").limit(1)

    const { data: applications, error: appsError } = await supabase.from("applications").select("id").limit(1)

    return NextResponse.json({
      ok: true,
      db: "connected",
      profilesSample: profiles ?? [],
      applicationsSample: applications ?? [],
      errors: {
        profilesError: profilesError?.message || null,
        appsError: appsError?.message || null,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}


