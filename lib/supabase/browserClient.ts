import { createClient } from "@supabase/supabase-js"

export const supabaseBrowser = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Missing Supabase environment variables:
    - NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? "Set" : "Missing"}
    - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? "Set" : "Missing"}
    
    Please add these to your Vercel project environment variables.`)
  }

  return createClient(supabaseUrl, supabaseAnonKey)
})()
