import twilio from "twilio"

let _client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (_client) return _client
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required")
  _client = twilio(sid, token)
  return _client
}

export async function sendSms(to: string, body: string): Promise<string> {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!messagingServiceSid && !from) {
    throw new Error("TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER required")
  }

  const message = await getClient().messages.create({
    to,
    body,
    ...(messagingServiceSid
      ? { messagingServiceSid }
      : { from }),
  })
  return message.sid
}

/** Validate that an inbound webhook is actually from Twilio */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) return false
  return twilio.validateRequest(token, signature, url, params)
}
