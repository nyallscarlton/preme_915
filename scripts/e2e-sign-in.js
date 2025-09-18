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

  const userJsonPath = path.resolve(__dirname, ".e2e-user.json")
  const userData = JSON.parse(fs.readFileSync(userJsonPath, "utf8"))
  const email = process.argv[2] || userData.email
  const password = process.argv[3] || userData.password

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Try to sign in with password
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error("signin_error:", error.message)
    process.exit(2)
  }

  // Confirm session and user
  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr) {
    console.error("getuser_error:", userErr.message)
    process.exit(3)
  }

  console.log(JSON.stringify({ ok: true, email_confirmed_at: userRes.user?.email_confirmed_at || null }, null, 2))
}

main().catch((e) => {
  console.error("unexpected_error:", e?.message || String(e))
  process.exit(4)
})


