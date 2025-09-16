import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const runtime = "nodejs"

export async function GET() {
  const envVars = {
    baseUrlSet: Boolean(process.env.NEXT_PUBLIC_BASE_URL),
    baseUrlValue: process.env.NEXT_PUBLIC_BASE_URL || "Not set",
    supabaseUrlSet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseUrlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || "Not set",
    anonKeySet: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    anonKeyValue: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Set (hidden for security)" : "Not set",
  }

  return NextResponse.json(envVars)
}
