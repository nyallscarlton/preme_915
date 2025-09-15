import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hriipovloelnqrlwtswy.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaWlwb3Zsb2VsbnFybHd0c3d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0NjIwNzUsImV4cCI6MjA3MTAzODA3NX0.t2ym8L4t-m5NuIcorSomRqfpjvFEpyXxAvoqmvvuO5c"

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
