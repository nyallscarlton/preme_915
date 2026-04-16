import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { enrollHHCadence, logExecution } from "@/lib/hh-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ""

async function slackPost(channel: string, text: string) {
  if (!SLACK_BOT_TOKEN) return
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const payload: any = await req.json().catch(() => ({}))

  const email: string | undefined = payload.lead?.email || payload.email
  const firstName: string = payload.lead?.first_name || payload.first_name || ""
  const lastName: string = payload.lead?.last_name || payload.last_name || ""
  const phone: string | null = payload.lead?.phone || payload.phone || null
  const propertyAddress: string =
    payload.lead?.custom_variables?.property_address ||
    payload.lead?.property_address || payload.property_address || ""
  const replyText: string = payload.reply?.text || payload.reply_text || payload.text || ""
  const originalSubject: string = payload.reply?.subject || payload.original_subject || payload.subject || ""
  const campaignId: string = payload.campaign_id || payload.lead?.campaign_id || ""

  if (!email) {
    return NextResponse.json({ error: "no email in payload" }, { status: 400 })
  }

  const hh = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "hurry_homes" } }
  )

  // Dedup by email
  const { data: existing } = await hh.from("leads").select("id, phone").eq("email", email).maybeSingle()
  if (existing?.id) {
    await hh.from("leads").update({
      reply_text: replyText,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id)
    await logExecution("hh-instantly-reply", "hurry_homes", "skipped_duplicate", { email, lead_id: existing.id })
    return NextResponse.json({ ok: true, lead_id: existing.id, deduped: true })
  }

  const hasPhone = !!(phone && phone.length > 6)
  const cadenceTrack = hasPhone ? "full" : "email_only"

  const { data: inserted, error: insErr } = await hh.from("leads").insert({
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: `${firstName} ${lastName}`.trim() || null,
    email,
    phone,
    source: "cold_email",
    source_detail: `instantly campaign ${campaignId}`,
    instantly_campaign_id: campaignId,
    property_address: propertyAddress || null,
    cadence_track: cadenceTrack,
    reply_text: replyText,
    status: "new",
  }).select("id").single()

  if (insErr || !inserted) {
    await logExecution("hh-instantly-reply", "hurry_homes", "failed", { error: insErr?.message })
    return NextResponse.json({ error: insErr?.message || "insert failed" }, { status: 500 })
  }

  const leadId = inserted.id

  try {
    await enrollHHCadence({
      leadId,
      hasPhone,
      aiContext: {
        reply_text: replyText,
        original_subject: originalSubject,
        property_address: propertyAddress,
        first_name: firstName,
        form_url: `https://www.premerealestate.com/sell?ref=${leadId}`,
      },
    })
  } catch (err: any) {
    await logExecution("hh-instantly-reply", "hurry_homes", "enroll_failed", { lead_id: leadId, error: err.message })
  }

  const replyPreview = replyText.slice(0, 120) + (replyText.length > 120 ? "…" : "")
  await slackPost("#hurry-homes",
    `🏠 *New HH Lead:* ${firstName} ${lastName} (${email})\n` +
    `• Source: Cold email reply\n` +
    `• Property: ${propertyAddress || "not provided"}\n` +
    `• Phone: ${phone || "not provided — email-only cadence"}\n` +
    `• Reply: "${replyPreview}"\n` +
    `• Cadence: ${cadenceTrack} — AI email fires in 5 min`)

  await logExecution("hh-instantly-reply", "hurry_homes", "completed", { lead_id: leadId, cadence_track: cadenceTrack, has_phone: hasPhone })

  return NextResponse.json({ ok: true, lead_id: leadId, cadence_track: cadenceTrack })
}
