#!/usr/bin/env npx tsx
/**
 * End-to-end MISMO generator test runner.
 *
 *   1. Seed the 3 fixtures (idempotent).
 *   2. For each fixture: fetch → render → validateXSD (if MISMO_ALLOW_SKIP_XSD != 1) → snapshot.
 *   3. Print per-fixture result + final pass/fail summary.
 *
 * Run:  npm run test:mismo
 * or    npx tsx tests/mismo/run-tests.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import path from "node:path"
loadEnvLocal()

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
import { renderMISMO, renderFannie, fetchLoanData, validateXSD, MISMOValidationError } from "../../lib/mismo"
import { FIXTURES } from "./fixtures"

type Result = {
  label: string
  id: string
  xmlBytes: number
  fnmBytes: number
  xsdOk: boolean | null // null = skipped
  snapshotOk: boolean
  errors: string[]
}

async function main() {
  const results: Result[] = []
  const snapshotsDir = path.resolve(__dirname, "snapshots")
  if (!existsSync(snapshotsDir)) mkdirSync(snapshotsDir, { recursive: true })
  const update = process.argv.includes("--update")

  for (const f of FIXTURES) {
    const errors: string[] = []
    let xml = ""
    let fnm = ""
    let xsdOk: boolean | null = null
    let snapshotOk = true

    try {
      const data = await fetchLoanData(f.id)
      xml = renderMISMO(data)
      fnm = renderFannie(data)

      if (process.env.MISMO_ALLOW_SKIP_XSD !== "1") {
        try {
          await validateXSD(xml)
          xsdOk = true
        } catch (err) {
          xsdOk = false
          if (err instanceof MISMOValidationError) errors.push(...err.violations)
          else errors.push(String(err))
        }
      }

      // Snapshot compare — strip volatile fields (generated_at, timestamps)
      const normalized = normalize(xml)
      const snapPath = path.join(snapshotsDir, `${f.id}.mismo.xml`)
      if (update || !existsSync(snapPath)) {
        writeFileSync(snapPath, normalized, "utf8")
      } else {
        const existing = readFileSync(snapPath, "utf8")
        if (existing !== normalized) {
          snapshotOk = false
          errors.push(
            `snapshot mismatch. Re-run with --update to accept. Sample diff:\n${diffSample(existing, normalized)}`
          )
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }

    results.push({
      label: f.label,
      id: f.id,
      xmlBytes: xml.length,
      fnmBytes: fnm.length,
      xsdOk,
      snapshotOk,
      errors,
    })
  }

  // Summary
  console.log("\nMISMO test results\n" + "=".repeat(60))
  let pass = 0
  for (const r of results) {
    const ok = r.errors.length === 0
    if (ok) pass++
    const xsdTag = r.xsdOk === null ? "[xsd skipped]" : r.xsdOk ? "[xsd ✓]" : "[xsd ✗]"
    const snapTag = r.snapshotOk ? "[snap ✓]" : "[snap ✗]"
    console.log(
      `${ok ? "✓" : "✗"}  ${r.label.padEnd(38)}  ${xsdTag} ${snapTag}  xml=${r.xmlBytes}B fnm=${r.fnmBytes}B`
    )
    for (const e of r.errors) console.log(`     ${e}`)
  }
  console.log("=".repeat(60))
  console.log(`${pass}/${results.length} passed`)
  process.exit(pass === results.length ? 0 : 1)
}

function normalize(xml: string): string {
  return xml.replace(/<CreatedDatetime>[^<]+<\/CreatedDatetime>/g, "<CreatedDatetime>NORMALIZED</CreatedDatetime>")
}

function diffSample(a: string, b: string): string {
  const al = a.split("\n")
  const bl = b.split("\n")
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] !== bl[i]) return `line ${i + 1}: ${JSON.stringify(al[i])} vs ${JSON.stringify(bl[i])}`
  }
  return "no line-level diff (possibly trailing whitespace)"
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
