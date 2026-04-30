#!/usr/bin/env npx tsx
/**
 * End-to-end single-fixture upload — proves the full generate→validate→upload→writeback
 * pipeline works. Writes real files to Supabase Storage. Use sparingly.
 *
 *   npx tsx tests/mismo/e2e-upload.ts
 */
import { readFileSync } from "node:fs"
import path from "node:path"
loadEnvLocal()

import { generateMISMO } from "../../lib/mismo"
import { createAdminClient } from "../../lib/supabase/admin"
import { FIXTURE_IDS } from "./fixtures"

function loadEnvLocal() {
  try {
    const p = path.resolve(__dirname, "../../.env.local")
    const text = readFileSync(p, "utf8")
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
    }
  } catch {}
}

async function main() {
  const fixtureId = FIXTURE_IDS.A
  console.log(`Generating MISMO for fixture ${fixtureId}...`)
  const result = await generateMISMO(fixtureId)
  console.log("✓ Generated and uploaded")
  console.log(`  MISMO: ${result.mismoPath}`)
  console.log(`  FNM:   ${result.fnmPath}`)
  console.log(`  URLA:  ${result.urlaPath}`)
  console.log(`\n  XML URL:  ${result.mismoUrl}`)
  console.log(`  PDF URL:  ${result.urlaUrl}`)

  // Read back and verify
  const sb = createAdminClient()
  const { data, error } = await sb
    .from("loan_applications")
    .select("mismo_xml_url,mismo_xml_path,mismo_generated_at,fnm_url,fnm_path,fnm_generated_at")
    .eq("id", fixtureId)
    .single()
  if (error) throw new Error(`readback failed: ${error.message}`)
  console.log("\nDB writeback verified:")
  console.log(`  mismo_generated_at: ${data.mismo_generated_at}`)
  console.log(`  mismo_xml_path:     ${data.mismo_xml_path}`)
  console.log(`  fnm_path:           ${data.fnm_path}`)

  // Fetch the stored XML and print size
  const { data: file, error: dlErr } = await sb.storage.from("preme-loan-files").download(data.mismo_xml_path!)
  if (dlErr) throw new Error(`download failed: ${dlErr.message}`)
  const bytes = file.size
  console.log(`\nStored XML size: ${bytes} bytes`)
}

main().catch((err) => {
  console.error("E2E FAILED:", err)
  process.exit(1)
})
