import { fetchLoanData } from "./fetchLoanData"
import { renderMISMO } from "./render-mismo"
import { renderFannie } from "./render-fannie"
import { renderURLA } from "./render-urla"
import { validateXSD } from "./validators/xsd-validate"
import { uploadToStorage, writeLoanGenOutputs } from "./storage"
import { ExecLog } from "@/lib/exec-log"

export type GenerateResult = {
  mismoUrl: string
  mismoPath: string
  fnmUrl: string
  fnmPath: string
  urlaUrl: string
  urlaPath: string
  generatedAt: string
}

/**
 * End-to-end MISMO 3.4 + Fannie 3.2 generation.
 *
 *   fetch → render → validate (XSD) → upload → writeback → audit
 *
 * Returns short-lived signed URLs (15 min). For durable download use the
 * admin route that re-signs from the stored path.
 *
 * Logs every run to marathon.execution_log; on failure posts to #alerts.
 */
export async function generateMISMO(loanId: string): Promise<GenerateResult> {
  const log = new ExecLog("mismo-generator", "webhook", "preme", "clark", { loan_id: loanId })
  try {
    const data = await fetchLoanData(loanId)
    const mismoXml = renderMISMO(data)
    await validateXSD(mismoXml)
    const fnmText = renderFannie(data)
    const urlaPdf = await renderURLA(data)
    const upload = await uploadToStorage(loanId, mismoXml, fnmText, urlaPdf)
    await writeLoanGenOutputs(loanId, upload)

    const generatedAt = new Date().toISOString()
    const result: GenerateResult = { ...upload, generatedAt }
    await log.complete({
      loan_id: loanId,
      mismo_path: upload.mismoPath,
      fnm_path: upload.fnmPath,
      urla_path: upload.urlaPath,
    })
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await log.fail(`loan=${loanId}: ${msg}`)
    throw err
  }
}

/**
 * Re-sign an existing stored file when its URL expired.  Used by the admin
 * "Download MISMO XML" / "Download FNM" buttons.
 */
export { signExistingFile } from "./storage"
