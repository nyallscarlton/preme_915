import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPremeSms } from "@/lib/preme-sms"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET — Fetch conversation history for a lead
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = createAdminClient()

    const { data: messages, error } = await admin
      .from("lead_messages")
      .select("*")
      .eq("lead_id", params.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[messages] Fetch error:", error)
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, messages: messages || [] })
  } catch (err) {
    console.error("[messages] API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    )
  }
}

// POST — Send outbound SMS
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (!profile || !["lender", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { body: messageBody } = await request.json()
    if (!messageBody || typeof messageBody !== "string" || !messageBody.trim()) {
      return NextResponse.json(
        { error: "Message body is required" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Get lead phone
    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("phone, first_name, last_name")
      .eq("id", params.id)
      .single()

    if (leadErr || !lead?.phone) {
      return NextResponse.json(
        { error: "Lead not found or has no phone number" },
        { status: 404 }
      )
    }

    // Format to E.164
    const digits = lead.phone.replace(/\D/g, "")
    const toNumber = digits.startsWith("1") ? `+${digits}` : `+1${digits}`

    // Send via Retell (canonical Preme SMS path)
    const smsResult = await sendPremeSms({
      toPhone: toNumber,
      message: messageBody.trim(),
      firstName: lead.first_name || undefined,
      leadId: params.id,
      source: "admin_conversation",
    })

    if (!smsResult.ok) {
      console.error("[messages] SMS error:", smsResult.error)
      return NextResponse.json(
        { error: smsResult.error || "Failed to send SMS" },
        { status: 502 }
      )
    }

    // Insert into DB
    const { data: message, error: insertErr } = await admin
      .from("lead_messages")
      .insert({
        lead_id: params.id,
        direction: "outbound",
        body: messageBody.trim(),
        from_number: smsResult.from,
        to_number: toNumber,
        twilio_sid: smsResult.chatId || null,
        status: "sent",
      })
      .select()
      .single()

    if (insertErr) {
      console.error("[messages] Insert error:", insertErr)
      return NextResponse.json({
        success: true,
        message: {
          id: smsResult.chatId,
          lead_id: params.id,
          direction: "outbound",
          body: messageBody.trim(),
          from_number: smsResult.from,
          to_number: toNumber,
          twilio_sid: smsResult.chatId,
          status: "sent",
          created_at: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({ success: true, message })
  } catch (err) {
    console.error("[messages] API error:", err)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
