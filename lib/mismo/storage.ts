import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "preme-loan-files"
const SIGNED_URL_EXPIRES_SECONDS = 15 * 60 // 15 minutes

export type StorageUploadResult = {
  mismoUrl: string
  mismoPath: string
  fnmUrl: string
  fnmPath: string
  urlaUrl: string
  urlaPath: string
}

/**
 * Upload MISMO XML + Fannie 3.2 + URLA PDF to preme-loan-files (private),
 * return short-lived signed URLs.
 *   {loanId}/mismo-3.4-{ts}.xml
 *   {loanId}/fannie-3.2-{ts}.fnm
 *   {loanId}/urla-1003-{ts}.pdf
 */
export async function uploadToStorage(
  loanId: string,
  mismoXml: string,
  fnmText: string,
  urlaPdf: Uint8Array
): Promise<StorageUploadResult> {
  const sb = createAdminClient()
  const ts = new Date().toISOString().replace(/[:.]/g, "-")

  const mismoPath = `${loanId}/mismo-3.4-${ts}.xml`
  const fnmPath = `${loanId}/fannie-3.2-${ts}.fnm`
  const urlaPath = `${loanId}/urla-1003-${ts}.pdf`

  const [mismoUp, fnmUp, urlaUp] = await Promise.all([
    sb.storage.from(BUCKET).upload(mismoPath, mismoXml, { contentType: "application/xml", upsert: false }),
    sb.storage.from(BUCKET).upload(fnmPath, fnmText, { contentType: "text/plain", upsert: false }),
    sb.storage.from(BUCKET).upload(urlaPath, urlaPdf, { contentType: "application/pdf", upsert: false }),
  ])

  if (mismoUp.error) throw new Error(`MISMO upload failed: ${mismoUp.error.message}`)
  if (fnmUp.error) throw new Error(`FNM upload failed: ${fnmUp.error.message}`)
  if (urlaUp.error) throw new Error(`URLA upload failed: ${urlaUp.error.message}`)

  const [mismoSigned, fnmSigned, urlaSigned] = await Promise.all([
    sb.storage.from(BUCKET).createSignedUrl(mismoPath, SIGNED_URL_EXPIRES_SECONDS),
    sb.storage.from(BUCKET).createSignedUrl(fnmPath, SIGNED_URL_EXPIRES_SECONDS),
    sb.storage.from(BUCKET).createSignedUrl(urlaPath, SIGNED_URL_EXPIRES_SECONDS),
  ])

  if (mismoSigned.error || !mismoSigned.data) throw new Error(`MISMO signed URL failed: ${mismoSigned.error?.message}`)
  if (fnmSigned.error || !fnmSigned.data) throw new Error(`FNM signed URL failed: ${fnmSigned.error?.message}`)
  if (urlaSigned.error || !urlaSigned.data) throw new Error(`URLA signed URL failed: ${urlaSigned.error?.message}`)

  return {
    mismoUrl: mismoSigned.data.signedUrl,
    mismoPath,
    fnmUrl: fnmSigned.data.signedUrl,
    fnmPath,
    urlaUrl: urlaSigned.data.signedUrl,
    urlaPath,
  }
}

/**
 * Mint a fresh signed URL for a previously-stored object (used by the
 * admin "Download MISMO XML" button when the original URL expires).
 */
export async function signExistingFile(path: string): Promise<string> {
  const sb = createAdminClient()
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_EXPIRES_SECONDS)
  if (error || !data) throw new Error(`Signed URL failed: ${error?.message}`)
  return data.signedUrl
}

/**
 * Persist generator output pointers back onto the loan application.
 */
export async function writeLoanGenOutputs(
  loanId: string,
  result: StorageUploadResult
): Promise<void> {
  const sb = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await sb
    .from("loan_applications")
    .update({
      mismo_xml_url: result.mismoUrl,
      mismo_xml_path: result.mismoPath,
      mismo_generated_at: now,
      fnm_url: result.fnmUrl,
      fnm_path: result.fnmPath,
      fnm_generated_at: now,
      urla_pdf_url: result.urlaUrl,
      urla_pdf_path: result.urlaPath,
      urla_generated_at: now,
    })
    .eq("id", loanId)
  if (error) throw new Error(`writeLoanGenOutputs failed: ${error.message}`)
}
