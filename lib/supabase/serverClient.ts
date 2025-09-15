import { createClient } from "@supabase/supabase-js"

let _supabaseServer: ReturnType<typeof createClient> | null = null

export const supabaseServer = () => {
  if (_supabaseServer) {
    return _supabaseServer
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Missing Supabase environment variables:
    - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "Set" : "Missing"}
    - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "Set" : "Missing"}
    
    Please add these to your Vercel project environment variables.`)
  }

  _supabaseServer = createClient(supabaseUrl, supabaseAnonKey)
  return _supabaseServer
}
