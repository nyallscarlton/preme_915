/**
 * Resend Webhook Endpoint
 *
 * Receives email tracking events (delivered, opened, clicked, bounced)
 * and logs them to Supabase for lead journey tracking.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Resend webhook event types we care about
type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained"

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    tags?: Record<string, string>
    click?: { link: string }
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: ResendWebhookPayload = await request.json()

    const { type, data, created_at } = payload
    const recipientEmail = data.to?.[0] || ""
    const applicationNumber = data.tags?.application_number || extractAppNumber(data.subject)

    // Log to Supabase
    await supabase.from("email_events").insert({
      event_type: type,
      email_id: data.email_id,
      recipient_email: recipientEmail,
      application_number: applicationNumber,
      subject: data.subject,
      link_clicked: data.click?.link || null,
      event_timestamp: created_at,
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[resend-webhook] Error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

function extractAppNumber(subject: string): string | null {
  const match = subject?.match(/PREME-[A-Z0-9]+/)
  return match?.[0] || null
}
