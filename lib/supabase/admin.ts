import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Server-side admin client using service_role key
// Bypasses RLS — use only in API routes for operations that need elevated privileges
// Next.js patches global fetch with a data cache — Supabase GETs were being
// served from stale cached responses inside route handlers. no-store always.
const noStoreFetch: typeof fetch = (url, opts) => fetch(url, { ...opts, cache: "no-store" })

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" }, global: { fetch: noStoreFetch } }
  )
}

// Admin client for preme pipeline schema (leads, calls, sequences, etc.)
export function createPipelineClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "preme" }, global: { fetch: noStoreFetch } }
  )
}

// Backward-compatible alias — remove after verifying all imports updated
export const createZentrxClient = createPipelineClient
