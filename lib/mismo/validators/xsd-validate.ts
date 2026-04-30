import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { writeFile, access, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { MISMOValidationError } from "../types"

const execFileAsync = promisify(execFile)

/**
 * XSD validation via system `xmllint`. We avoid libxmljs2 because of native-
 * binding churn on newer Node versions (25+ on M4 in particular).
 *
 * Schema file must be placed at lib/mismo/validators/schema/MISMO_3.4.0_B324.xsd.
 * MISMO license forbids redistribution, so the file is .gitignored; fetch with
 * `scripts/fetch-mismo-xsd.sh`.
 *
 * If the schema is missing and MISMO_ALLOW_SKIP_XSD=1 is set, we log a warning
 * and skip validation (useful for local dev and CI before XSD is provisioned).
 */
export async function validateXSD(xml: string, opts?: { schemaPath?: string }): Promise<void> {
  const schemaPath =
    opts?.schemaPath ??
    process.env.MISMO_XSD_PATH ??
    path.resolve(process.cwd(), "lib/mismo/validators/schema/MISMO_3.4.0_B324.xsd")

  const haveSchema = await fileExists(schemaPath)
  if (!haveSchema) {
    if (process.env.MISMO_ALLOW_SKIP_XSD === "1") {
      console.warn(`[mismo] XSD not found at ${schemaPath}; skipping validation (MISMO_ALLOW_SKIP_XSD=1)`)
      return
    }
    throw new MISMOValidationError([
      `MISMO 3.4 XSD not found at ${schemaPath}. Run scripts/fetch-mismo-xsd.sh or set MISMO_XSD_PATH.`,
    ])
  }

  const dir = await mkdtemp(path.join(tmpdir(), "mismo-"))
  const xmlPath = path.join(dir, "candidate.xml")
  await writeFile(xmlPath, xml, "utf8")

  try {
    await execFileAsync("xmllint", ["--noout", "--schema", schemaPath, xmlPath], {
      maxBuffer: 20 * 1024 * 1024,
    })
  } catch (err) {
    const stderr = (err as NodeJS.ErrnoException & { stderr?: string; stdout?: string }).stderr ?? ""
    const violations = parseXmllintErrors(stderr, xmlPath)
    if (violations.length === 0) {
      violations.push(stderr.trim() || "xmllint returned a non-zero exit code with no stderr output")
    }
    throw new MISMOValidationError(violations)
  }
}

function parseXmllintErrors(stderr: string, xmlPath: string): string[] {
  return stderr
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith("fails to validate") && !l.includes(`${xmlPath} does not`))
    .map((l) => l.replace(xmlPath, "xml"))
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}
