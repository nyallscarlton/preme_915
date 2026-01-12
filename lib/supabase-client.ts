import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Create a singleton Supabase client
let supabaseInstance: SupabaseClient | null = null

export function hasSupabaseConfig(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasConfig = !!(supabaseUrl && supabaseAnonKey)
  console.log("[v0] Checking Supabase config:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    hasConfig,
  })
  return hasConfig
}

export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[v0] Supabase not configured - missing environment variables")
    console.warn("[v0] NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "set" : "missing")
    console.warn("[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "set" : "missing")
    return null
  }

  if (!supabaseInstance) {
    console.log("[v0] Creating new Supabase client instance")
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey)
  }

  return supabaseInstance
}

// Export a lazy getter for backward compatibility
export const supabase = {
  get client() {
    return getSupabaseClient()
  },
}
