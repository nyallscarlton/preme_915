#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function readEnvLocal(filePath) {
  const content = fs.readFileSync(filePath, "utf8").split(/\r?\n/)
  const env = {}
  for (const line of content) {
    if (!line || line.trim().startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    env[key] = val
  }
  return env
}

async function main() {
  const envPath = path.resolve(__dirname, "../env.local")
  const env = readEnvLocal(envPath)
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase env in env.local")
    process.exit(1)
  }

  const emailArg = process.argv[2]
  const passwordArg = process.argv[3]
  const email = emailArg || `preme.e2e.${Date.now()}@gmail.com`
  const password = passwordArg || "PremeTest123!"

  const nextUrl = "/apply"
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  const emailRedirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(nextUrl)}`

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  })

  if (error) {
    console.error("signup_error:", error.message)
    process.exit(2)
  }

  const out = { email, password, userId: data.user?.id || null }
  const outPath = path.resolve(__dirname, ".e2e-user.json")
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ created: true, ...out }, null, 2))
}

main().catch((e) => {
  console.error("unexpected_error:", e?.message || String(e))
  process.exit(3)
})


