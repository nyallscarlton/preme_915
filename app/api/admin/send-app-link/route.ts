import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPremeSms } from "@/lib/preme-sms"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST — team action: "send this lead an application."
 * Creates an application shell (name/phone/email + guest token) so the link
 * opens prefilled, drops the lead on the board in 1003 Out, and texts the
 * link from the main Preme number via Retell.
 * Body: { name, phone, email? }
 */
export async function POST(request: NextRequest) {
  const session = createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single()
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const name = String(body.name || "").trim()
  const requestedBy = String(body.requestedBy || "").trim() || "our team"
  const phoneDigits = String(body.phone || "").replace(/\D/g, "")
  if (!name || phoneDigits.length < 10) {
    return NextResponse.json({ error: "Name and a valid phone number are required" }, { status: 400 })
  }
  const phone = phoneDigits.length === 10 ? `+1${phoneDigits}` : `+${phoneDigits}`
  const email = String(body.email || "").trim() || `${phoneDigits}@placeholder.preme`
  const firstName = name.split(" ")[0]

  const guestToken = crypto.randomUUID()
  const applicationNumber = `PREME-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().substring(0, 6).toUpperCase()}`

  const { data: application, error } = await admin
    .from("loan_applications")
    .insert([{
      applicant_name: name,
      applicant_first_name: firstName,
      applicant_phone: phone,
      applicant_email: email,
      application_number: applicationNumber,
      guest_token: guestToken,
      status: "sent",
      is_pre_qual: false,
      is_guest: true,
      sent_via: "team_sms",
      sent_at: new Date().toISOString(),
    }])
    .select("id, application_number")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const link = `https://www.premerealestate.com/sign?token=${encodeURIComponent(guestToken)}`
  const message =
    `Hey ${firstName}, this is Riley with Preme Home Loans — ${requestedBy} asked me to send over your application. ` +
    `Here's the link: ${link}\n\n` +
    `Takes about 5 minutes, you can sign right on your phone, and we'll get you moving right away. ` +
    `Reply here with any questions. Reply STOP to opt out.`

  const sms = await sendPremeSms({
    toPhone: phone,
    message,
    firstName,
    source: "admin_send_app_link",
    metadata: { application_id: application.id, sent_by: user.email || user.id },
  })

  return NextResponse.json({
    success: true,
    smsSent: !!sms.ok,
    link,
    applicationNumber: application.application_number,
    applicationId: application.id,
  })
}
