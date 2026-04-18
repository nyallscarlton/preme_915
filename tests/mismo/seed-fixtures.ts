#!/usr/bin/env npx tsx
/**
 * Seed the 3 MISMO fixture loan_applications (idempotent).
 *
 * Run:  npx tsx tests/mismo/seed-fixtures.ts [--clean]
 *   --clean  delete existing fixture rows first (cascades to children)
 */
import { readFileSync } from "node:fs"
import path from "node:path"
loadEnvLocal()
import { createAdminClient } from "../../lib/supabase/admin"

function loadEnvLocal() {
  try {
    const p = path.resolve(__dirname, "../../.env.local")
    const text = readFileSync(p, "utf8")
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/.exec(line)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
    }
  } catch {
    /* .env.local optional */
  }
}
import { FIXTURES, FIXTURE_IDS } from "./fixtures"

async function main() {
  const clean = process.argv.includes("--clean")
  const sb = createAdminClient()

  if (clean) {
    console.log("Cleaning existing fixtures...")
    const { error } = await sb.from("loan_applications").delete().in("id", Object.values(FIXTURE_IDS))
    if (error) throw new Error(`clean failed: ${error.message}`)
  }

  // Ensure SSN + EIN plaintext get encrypted via preme.encrypt_pii RPC
  for (const f of FIXTURES) {
    const appRow = { id: f.id, application_number: f.application_number, ...f.application }

    // Encrypt SSN for primary applicant
    const ssn = await encryptIfSet(sb, "123-45-6789")
    if (ssn) (appRow as any).applicant_ssn_encrypted = ssn

    // Encrypt EIN for entity-vested fixtures
    if ((appRow as any).vesting_type === "Entity") {
      const ein = await encryptIfSet(sb, "98-7654321")
      if (ein) (appRow as any).entity_ein_encrypted = ein
    }

    const { error: upErr } = await sb.from("loan_applications").upsert(appRow, { onConflict: "id" })
    if (upErr) throw new Error(`upsert ${f.label}: ${upErr.message}`)

    // Children: delete + reinsert so counts are deterministic
    await sb.from("loan_borrowers").delete().eq("loan_application_id", f.id)
    await sb.from("loan_declarations").delete().eq("loan_application_id", f.id)
    await sb.from("loan_liabilities").delete().eq("loan_application_id", f.id)
    await sb.from("loan_assets").delete().eq("loan_application_id", f.id)
    await sb.from("loan_reo_properties").delete().eq("loan_application_id", f.id)

    for (const b of f.borrowers) {
      const bssn = await encryptIfSet(sb, "987-65-4321")
      await sb
        .from("loan_borrowers")
        .insert({ loan_application_id: f.id, ...b, ...(bssn ? { ssn_encrypted: bssn } : {}) })
    }
    for (const d of f.declarations) {
      await sb.from("loan_declarations").insert({ loan_application_id: f.id, ...d })
    }
    for (const l of f.liabilities) {
      await sb.from("loan_liabilities").insert({ loan_application_id: f.id, ...l })
    }
    for (const a of f.assets) {
      await sb.from("loan_assets").insert({ loan_application_id: f.id, ...a })
    }
    for (const r of f.reo_properties) {
      await sb.from("loan_reo_properties").insert({ loan_application_id: f.id, ...r })
    }

    console.log(`  [ok] ${f.label} (${f.id})`)
  }
}

async function encryptIfSet(sb: ReturnType<typeof createAdminClient>, plain: string): Promise<string | null> {
  const { data, error } = await sb.rpc("encrypt_pii", { plaintext: plain })
  if (error) {
    console.warn(`encrypt_pii failed: ${error.message}`)
    return null
  }
  return (data as string) ?? null
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
