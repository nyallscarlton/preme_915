import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Server-side admin client using service_role key
// Bypasses RLS — use only in API routes for operations that need elevated privileges
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
