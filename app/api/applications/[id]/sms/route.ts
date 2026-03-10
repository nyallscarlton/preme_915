import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

// POST /api/applications/[id]/sms — send SMS to applicant
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { message } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get application phone
  const { data: app } = await supabase
    .from("loan_applications")
    .select("applicant_phone, applicant_name, application_number")
    .eq("id", params.id)
    .single()

  if (!app?.applicant_phone) {
    return NextResponse.json({ error: "No phone number on file" }, { status: 400 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 })
  }

  // Send via Twilio
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: app.applicant_phone,
      Body: message,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `SMS failed: ${err}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
