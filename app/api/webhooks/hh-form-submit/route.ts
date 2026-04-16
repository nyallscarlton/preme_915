import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { enrollHHCadence, upgradeToFullCadence, logExecution } from "@/lib/hh-cadence"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || ""

async function slackPost(channel: string, text: string) {
  if (!SLACK_BOT_TOKEN) return
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  }).catch(() => {})
}

function motivationFromTimeline(t: string): "hot" | "warm" | "cold" {
  if (t === "asap") return "hot"
  if (t === "1_3_months") return "warm"
  return "cold"
}

function parseName(raw?: string): { first: string; last: string } {
  if (!raw) return { first: "", last: "" }
  const parts = raw.trim().split(/\s+/)
  return { first: parts[0] || "", last: parts.slice(1).join(" ") }
}

export async function POST(req: NextRequest) {
  const data: any = await req.json().catch(() => ({}))
  const {
    name,
    first_name: firstNameIn,
    last_name: lastNameIn,
    email,
    phone,
    property_address,
    property_city,
    property_state,
    property_zip,
    property_condition,
    timeline,
    asking_price,
    ref,
  } = data

  if (!phone || !property_address) {
    return NextResponse.json({ error: "phone and property_address are required" }, { status: 400 })
  }

  const { first, last } = parseName(name)
  const firstName = firstNameIn || first
  const lastName = lastNameIn || last

  const hh = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: "hurry_homes" } }
  )

  const motivation = timeline ? motivationFromTimeline(timeline) : "unknown"
  const parsedAsking = asking_price ? Number(String(asking_price).replace(/[^\d.]/g, "")) : null

  // Find existing: by ref param (from email link), then email, then phone
  let leadId: string | null = null
  let wasEmailOnly = false
  if (ref) {
    const { data: r } = await hh.from("leads").select("id, cadence_track").eq("id", ref).maybeSingle()
    if (r) { leadId = r.id; wasEmailOnly = r.cadence_track === "email_only" }
  }
  if (!leadId && email) {
    const { data: r } = await hh.from("leads").select("id, cadence_track").eq("email", email).maybeSingle()
    if (r) { leadId = r.id; wasEmailOnly = r.cadence_track === "email_only" }
  }
  if (!leadId) {
    const { data: r } = await hh.from("leads").select("id, cadence_track").eq("phone", phone).maybeSingle()
    if (r) { leadId = r.id; wasEmailOnly = r.cadence_track === "email_only" }
  }

  if (leadId) {
    await hh.from("leads").update({
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      email: email || undefined,
      phone,
      property_address,
      property_city: property_city || null,
      property_state: property_state || "GA",
      property_zip: property_zip || null,
      property_condition: property_condition || null,
      timeline: timeline || null,
      asking_price: parsedAsking,
      motivation_level: motivation,
      source: "form",
      updated_at: new Date().toISOString(),
      phone_captured_at: new Date().toISOString(),
    }).eq("id", leadId)

    if (wasEmailOnly) {
      await upgradeToFullCadence(leadId)
    }
  } else {
    const { data: inserted, error: insErr } = await hh.from("leads").insert({
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: name || null,
      email: email || null,
      phone,
      source: "form",
      property_address,
      property_city: property_city || null,
      property_state: property_state || "GA",
      property_zip: property_zip || null,
      property_condition: property_condition || null,
      timeline: timeline || null,
      asking_price: parsedAsking,
      motivation_level: motivation,
      cadence_track: "full",
      status: "new",
      phone_captured_at: new Date().toISOString(),
    }).select("id").single()
    if (insErr || !inserted) {
      return NextResponse.json({ error: insErr?.message || "insert failed" }, { status: 500 })
    }
    leadId = inserted.id as string
    await enrollHHCadence({
      leadId: leadId!,
      hasPhone: true,
      aiContext: {
        reply_text: `Filled out the sell form. Condition: ${property_condition || "not given"}. Timeline: ${timeline || "not given"}. Asking: ${asking_price || "not given"}.`,
        original_subject: "Form submission",
        property_address,
        first_name: firstName,
        form_url: "",
      },
    })
  }

  if (motivation === "hot") {
    await slackPost("#hurry-homes",
      `🔥 *HOT LEAD:* ${name || firstName} wants to sell ${property_address} ASAP.\n` +
      `• Phone: ${phone}\n• Condition: ${property_condition || "?"} | Asking: ${asking_price || "?"}\n` +
      `• Riley calling in 60 seconds.`)
  } else {
    await slackPost("#hurry-homes",
      `📋 *Form submitted:* ${name || firstName} — ${property_address}\n` +
      `• Timeline: ${timeline || "?"} | Condition: ${property_condition || "?"}\n` +
      `• Phone: ${phone} — full cadence started.`)
  }

  await logExecution("hh-form-submit", "hurry_homes", "completed", { lead_id: leadId, motivation, timeline })

  return NextResponse.json({ ok: true, lead_id: leadId, motivation })
}
