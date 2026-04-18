#!/usr/bin/env tsx
/**
 * Pre-deploy gate.
 * Reads marathon.known_regressions from Supabase, runs each forbidden_pattern
 * against the diff between HEAD and origin/main (or against full working tree
 * if --full is passed). Exits 1 if any blocker-severity pattern matches.
 *
 * MUST be run before `vercel --prod`. Clark's CLAUDE.md requires it.
 */
import { createClient } from "@supabase/supabase-js"
import { execSync } from "node:child_process"

const MODE = process.argv.includes("--full") ? "full" : "diff"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error("[pre-deploy] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(2)
  }

  const sb = createClient(url, key, { db: { schema: "marathon" } })

  const { data: regressions, error } = await sb
    .from("known_regressions")
    .select("*")
    .order("severity", { ascending: true })

  if (error) {
    console.error("[pre-deploy] Failed to load regressions:", error)
    process.exit(2)
  }

  if (!regressions || regressions.length === 0) {
    console.error("[pre-deploy] No regressions loaded. Refusing to proceed — gate must have at least one rule.")
    process.exit(2)
  }

  console.log(`[pre-deploy] Loaded ${regressions.length} regression rules (mode: ${MODE})`)

  // Get content to scan
  let content: string
  if (MODE === "diff") {
    try {
      const rawDiff = execSync('git diff origin/main...HEAD -- "*.ts" "*.tsx"', { encoding: "utf8" })
      if (!rawDiff.trim()) {
        console.log("[pre-deploy] No diff against origin/main — nothing to check.")
        process.exit(0)
      }
      // Only scan added lines (lines starting with +, excluding +++ headers)
      content = rawDiff
        .split("\n")
        .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
        .map((line) => line.slice(1)) // strip the leading +
        .join("\n")
    } catch {
      console.error("[pre-deploy] git diff failed. Aborting.")
      process.exit(2)
    }
  } else {
    // Read files individually to avoid ENOBUFS
    const files = execSync('git ls-files "*.ts" "*.tsx"', { encoding: "utf8" }).trim().split("\n")
    const { readFileSync } = await import("node:fs")
    const chunks: string[] = []
    for (const f of files) {
      try { chunks.push(readFileSync(f, "utf8")) } catch { /* skip unreadable */ }
    }
    content = chunks.join("\n")
  }

  const blockers: Array<{ id: string; matches: string[] }> = []
  const warnings: Array<{ id: string; matches: string[] }> = []

  for (const reg of regressions) {
    let pattern: RegExp
    try {
      pattern = new RegExp(reg.forbidden_pattern, "gm")
    } catch (e) {
      console.error(`[pre-deploy] Invalid regex for ${reg.id}: ${e}`)
      process.exit(2)
    }

    const matches = content.match(pattern) ?? []
    if (matches.length > 0) {
      const entry = { id: reg.id, matches: matches.slice(0, 5) }
      if (reg.severity === "blocker") blockers.push(entry)
      else warnings.push(entry)
    }
  }

  if (warnings.length) {
    console.log("\n⚠️  Warnings (non-blocking):")
    for (const w of warnings) {
      console.log(`  - ${w.id}: ${w.matches.length} match(es)`)
      w.matches.forEach((m) => console.log(`      ${m.slice(0, 120)}`))
    }
  }

  if (blockers.length) {
    console.log("\n🚫 BLOCKED — regressions detected:")
    for (const b of blockers) {
      console.log(`  - ${b.id}: ${b.matches.length} match(es)`)
      b.matches.forEach((m) => console.log(`      ${m.slice(0, 120)}`))
    }
    console.log("\nDeploy blocked. Either fix the code or, if this is a false positive, update the forbidden_pattern in marathon.known_regressions.")
    process.exit(1)
  }

  console.log("\n✅ Pre-deploy check passed. No known regressions in diff.")
  process.exit(0)
}

main().catch((e) => {
  console.error("[pre-deploy] Unhandled error:", e)
  process.exit(2)
})
