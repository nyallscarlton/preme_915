import { getBaseUrl } from "@/lib/config"

// No 0/O/1/l/I — codes get read off phone screens
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"

function generateCode(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

/**
 * Every borrower gets ONE short link — premerealestate.com/s/<code> — that
 * always routes to the right step for their stage (intake before approval,
 * 1003 signing after). Returns the full URL; creates the code on first use.
 */
export async function ensureShortLink(adminClient: any, applicationId: string): Promise<string> {
  const { data: app } = await adminClient
    .from("loan_applications")
    .select("short_code")
    .eq("id", applicationId)
    .single()

  let code = app?.short_code
  if (!code) {
    // Retry on the (astronomically unlikely) unique-index collision
    for (let i = 0; i < 3 && !code; i++) {
      const candidate = generateCode()
      const { error } = await adminClient
        .from("loan_applications")
        .update({ short_code: candidate })
        .eq("id", applicationId)
      if (!error) code = candidate
    }
  }
  return code ? `${getBaseUrl()}/s/${code}` : `${getBaseUrl()}/apply`
}
