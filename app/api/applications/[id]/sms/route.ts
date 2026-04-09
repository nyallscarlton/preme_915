import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPremeSms } from "@/lib/preme-sms"

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

  const result = await sendPremeSms({
    toPhone: app.applicant_phone,
    message: message.trim(),
    firstName: app.applicant_name?.split(" ")[0] || undefined,
    source: "application_sms",
    metadata: { application_number: app.application_number },
  })

  if (!result.ok) {
    return NextResponse.json({ error: `SMS failed: ${result.error}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
