import type { NextRequest } from "next/server"

/**
 * Persist an electronic signature captured at submission: store the drawn
 * signature PNG in the documents bucket and stamp name/time/IP on the
 * application row (ESIGN/UETA audit trail). The URLA renderer picks these
 * up and prints the signature block on the 1003 PDF.
 */
export async function persistEsign(
  adminClient: any,
  applicationId: string,
  esign: { esignName?: string; esignImage?: string | null; esignConsent?: boolean } | null | undefined,
  request: NextRequest
): Promise<void> {
  try {
    if (!esign || !esign.esignConsent || !esign.esignName?.trim()) return

    let signaturePath: string | null = null
    if (esign.esignImage?.startsWith("data:image/png;base64,")) {
      const png = Buffer.from(esign.esignImage.split(",")[1], "base64")
      // 200KB cap — a signature stroke is a few KB; anything bigger is not one
      if (png.length > 0 && png.length < 200_000) {
        signaturePath = `applications/${applicationId}/esign/signature-${Date.now()}.png`
        const { error } = await adminClient.storage
          .from("documents")
          .upload(signaturePath, png, { contentType: "image/png" })
        if (error) {
          console.error("[esign] signature upload error:", error.message)
          signaturePath = null
        }
      }
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null

    await adminClient
      .from("loan_applications")
      .update({
        esign_name: esign.esignName.trim(),
        esign_signed_at: new Date().toISOString(),
        esign_ip: ip,
        esign_signature_path: signaturePath,
      })
      .eq("id", applicationId)
  } catch (err) {
    console.error("[esign] persist error:", err)
  }
}
