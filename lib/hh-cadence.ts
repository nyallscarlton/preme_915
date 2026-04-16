/**
 * Hurry Homes cadence engine.
 * Dual-track:
 *   - email_only: steps 1–5 (step 1 is ai_email with 5min delay, 2–5 are templates)
 *   - full: steps 10–20 (calls + SMS)
 *
 * Invoked from /api/cron/hh-cadence-runner every 2 minutes.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const HH = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "hurry_homes" } }
)

const MARATHON = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "marathon" } }
)

export interface HHQueueRow {
  id: string
  lead_id: string
  step_number: number
  step_type: "call" | "sms" | "email" | "ai_email"
  cadence_track: "email_only" | "full"
  status: string
  scheduled_for: string
  template_slug: string | null
  message_override: string | null
}

export interface HHLead {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  property_address: string | null
  property_city: string | null
  cadence_track: string
}

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "Marathon Empire <onboarding@resend.dev>"
const FORM_BASE = "https://www.premerealestate.com/sell"

function fillTemplate(body: string, lead: HHLead, extras: Record<string, string> = {}) {
  return body
    .replace(/\[first_name\]/g, lead.first_name || "there")
    .replace(/\[last_name\]/g, lead.last_name || "")
    .replace(/\[property_address\]/g, lead.property_address || "your property")
    .replace(/\[area\]/g, lead.property_city || "your area")
    .replace(/\[agent_name\]/g, "Nyalls")
    .replace(/\[agent\]/g, "Nyalls")
    .replace(/\[FORM_URL\]/g, `${FORM_BASE}?ref=${lead.id}`)
    .replace(/\[form_url\]/g, `${FORM_BASE}?ref=${lead.id}`)
    .replace(/\{\{(\w+)\}\}/g, (_m, key) => extras[key] ?? (lead as any)[key] ?? "")
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured")
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      text: body,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function generateAIEmailReply(context: {
  first_name: string
  property_address: string
  reply_text: string
  form_url: string
}): Promise<{ subject: string; body: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured")
  }
  const system = `You are a real estate acquisitions specialist at Marathon Empire Holdings. You buy properties for cash, as-is, and can close in as little as 14 days.

You are replying to someone who responded to your cold email about their property. Write a SHORT, warm, conversational email reply. This should read like a real person wrote it — not a template, not a sales pitch.

RULES:
- Keep it 3-5 sentences max. Short paragraphs.
- Reference what they actually said in their reply
- Be warm and low-pressure
- Naturally mention that you can have a cash offer range in 5-10 minutes
- Include this link naturally in the flow (don't just drop it randomly): ${context.form_url}
- Frame the link as "if you want to speed things up" or "drop your info here" — make it feel optional, not required
- Sign off with "— Nyalls" only
- Do NOT use bullet points or formal formatting
- Do NOT sound like AI or a template
- Do NOT use phrases like "I'd be happy to" or "I understand"
- Write like you're texting a friend who asked about selling their house
- Output exactly this format:
  Subject: <short reply subject>
  <blank line>
  <email body>`

  const userMsg = `The seller's name is ${context.first_name || "there"}.
Their property is at ${context.property_address || "their property"}.
They replied to your cold email with:

"${context.reply_text}"

Write a reply email. Subject line should be a natural reply to their message.`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }
  const json: any = await res.json()
  const raw: string = json.content?.[0]?.text || ""
  const subjMatch = raw.match(/^Subject:\s*(.+?)(?:\r?\n)/i)
  const subject = subjMatch ? subjMatch[1].trim() : "Re: your property"
  const body = raw.replace(/^Subject:.+?\r?\n\r?\n?/i, "").trim()

  // Log cost to marathon.agent_costs
  if (json.usage) {
    const u = json.usage
    const p = { input: 3, output: 15, cached: 0.30 }
    const inputCost = (u.input_tokens / 1_000_000) * p.input
    const cachedCost = ((u.cache_read_input_tokens || 0) / 1_000_000) * p.cached
    const outputCost = (u.output_tokens / 1_000_000) * p.output
    const total = inputCost + cachedCost + outputCost
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/agent_costs`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Profile": "marathon",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_name: "hh_ai_reply",
        model: "claude-sonnet-4-6",
        trigger_type: "cadence",
        input_tokens: u.input_tokens,
        cached_input_tokens: u.cache_read_input_tokens || 0,
        output_tokens: u.output_tokens,
        input_cost_usd: inputCost + cachedCost,
        output_cost_usd: outputCost,
        session_fee_usd: 0,
        total_cost_usd: total,
      }),
    }).catch(() => {})
  }

  return { subject, body }
}

export async function executeHHStep(row: HHQueueRow): Promise<{ ok: boolean; error?: string }> {
  const hh = HH()

  // Load lead
  const { data: lead, error: leadErr } = await hh
    .from("leads")
    .select("id, first_name, last_name, email, phone, property_address, property_city, cadence_track")
    .eq("id", row.lead_id)
    .single()
  if (leadErr || !lead) return { ok: false, error: `lead not found: ${leadErr?.message}` }

  try {
    switch (row.step_type) {
      case "ai_email": {
        if (!lead.email) return { ok: false, error: "no email on lead" }
        const ctx = row.message_override ? JSON.parse(row.message_override) : {}
        const ai = await generateAIEmailReply({
          first_name: ctx.first_name || lead.first_name || "",
          property_address: ctx.property_address || lead.property_address || "",
          reply_text: ctx.reply_text || "",
          form_url: ctx.form_url || `${FORM_BASE}?ref=${lead.id}`,
        })
        const replySubject = ctx.original_subject
          ? `Re: ${ctx.original_subject.replace(/^Re:\s*/i, "")}`
          : ai.subject
        await sendEmail(lead.email, replySubject, ai.body)
        await hh.from("leads").update({ status: "contacting", contacted_at: new Date().toISOString() }).eq("id", lead.id)
        break
      }
      case "email": {
        if (!lead.email) return { ok: false, error: "no email on lead" }
        if (!row.template_slug) return { ok: false, error: "no template_slug" }
        const { data: tpl } = await hh.from("cadence_templates").select("subject, body").eq("slug", row.template_slug).single()
        if (!tpl) return { ok: false, error: `template not found: ${row.template_slug}` }
        await sendEmail(lead.email, fillTemplate(tpl.subject || "Following up", lead as HHLead), fillTemplate(tpl.body, lead as HHLead))
        break
      }
      case "sms": {
        if (!lead.phone) return { ok: false, error: "no phone on lead" }
        if (!row.template_slug) return { ok: false, error: "no template_slug" }
        const { data: tpl } = await hh.from("cadence_templates").select("body").eq("slug", row.template_slug).single()
        if (!tpl) return { ok: false, error: `template not found: ${row.template_slug}` }
        const text = fillTemplate(tpl.body, lead as HHLead)
        // Reuse preme's retell SMS wiring — HH has no A2P of its own yet
        const smsRes = await fetch("https://api.retellai.com/create-chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: process.env.RETELL_SMS_AGENT_ID || "default",
            chat_analysis: { type: "sms" },
            metadata: { lead_id: lead.id, channel: "hh", step: row.step_number },
            starter_message: text,
          }),
        })
        if (!smsRes.ok) return { ok: false, error: `retell sms ${smsRes.status}` }
        break
      }
      case "call": {
        if (!lead.phone) return { ok: false, error: "no phone on lead" }
        // Riley-style outbound call. If HH-Riley agent isn't wired, log as skipped.
        const agent = process.env.HH_RILEY_AGENT_ID
        if (!agent) {
          return { ok: false, error: "HH_RILEY_AGENT_ID not set — skipping call (stub)" }
        }
        const callRes = await fetch("https://api.retellai.com/v2/create-phone-call", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from_number: process.env.HH_FROM_NUMBER,
            to_number: lead.phone,
            override_agent_id: agent,
            metadata: { lead_id: lead.id, channel: "hh", step: row.step_number },
          }),
        })
        if (!callRes.ok) return { ok: false, error: `retell call ${callRes.status}` }
        break
      }
      default:
        return { ok: false, error: `unknown step_type: ${row.step_type}` }
    }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) }
  }
}

/**
 * Enroll a fresh HH lead in the dual-track cadence.
 * - Always queues ai_email at T+5min (step 1)
 * - Queues template emails at T+4h, T+24h, T+72h, T+144h (steps 2-5)
 * - If hasPhone: also queues full-cadence calls + SMS (steps 10-20)
 */
export async function enrollHHCadence(opts: {
  leadId: string
  hasPhone: boolean
  aiContext: {
    reply_text: string
    original_subject: string
    property_address: string
    first_name: string
    form_url: string
  }
}) {
  const hh = HH()
  const now = Date.now()
  const track = opts.hasPhone ? "full" : "email_only"

  const rows: any[] = [
    // Step 1 — AI email (both tracks)
    {
      lead_id: opts.leadId,
      step_number: 1,
      step_type: "ai_email",
      cadence_track: track,
      status: "pending",
      scheduled_for: new Date(now + 5 * 60_000).toISOString(),
      message_override: JSON.stringify(opts.aiContext),
    },
    // Steps 2-5 template emails
    { lead_id: opts.leadId, step_number: 2, step_type: "email", cadence_track: track, status: "pending", scheduled_for: new Date(now + 4 * 3600_000).toISOString(), template_slug: "hh-email-value-prop" },
    { lead_id: opts.leadId, step_number: 3, step_type: "email", cadence_track: track, status: "pending", scheduled_for: new Date(now + 24 * 3600_000).toISOString(), template_slug: "hh-email-social-proof" },
    { lead_id: opts.leadId, step_number: 4, step_type: "email", cadence_track: track, status: "pending", scheduled_for: new Date(now + 72 * 3600_000).toISOString(), template_slug: "hh-email-soft-checkin" },
    { lead_id: opts.leadId, step_number: 5, step_type: "email", cadence_track: track, status: "pending", scheduled_for: new Date(now + 144 * 3600_000).toISOString(), template_slug: "hh-email-final" },
  ]

  if (opts.hasPhone) {
    rows.push(
      { lead_id: opts.leadId, step_number: 10, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 5 * 60_000).toISOString(), template_slug: "hh-full-call-1" },
      { lead_id: opts.leadId, step_number: 11, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 6 * 60_000).toISOString(), template_slug: "hh-full-sms-intro" },
      { lead_id: opts.leadId, step_number: 12, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 10 * 60_000).toISOString(), template_slug: "hh-full-call-2" },
      { lead_id: opts.leadId, step_number: 13, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 12 * 60_000).toISOString(), template_slug: "hh-full-sms-missed" },
      { lead_id: opts.leadId, step_number: 14, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 65 * 60_000).toISOString(), template_slug: "hh-full-call-3" },
      { lead_id: opts.leadId, step_number: 15, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 24 * 3600_000).toISOString(), template_slug: "hh-full-call-4" },
      { lead_id: opts.leadId, step_number: 16, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 32 * 3600_000).toISOString(), template_slug: "hh-full-sms-value" },
      { lead_id: opts.leadId, step_number: 17, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 72 * 3600_000).toISOString(), template_slug: "hh-full-call-5" },
      { lead_id: opts.leadId, step_number: 18, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 80 * 3600_000).toISOString(), template_slug: "hh-full-sms-urgency" },
      { lead_id: opts.leadId, step_number: 19, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 120 * 3600_000).toISOString(), template_slug: "hh-full-sms-checkin" },
      { lead_id: opts.leadId, step_number: 20, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 152 * 3600_000).toISOString(), template_slug: "hh-full-sms-final" },
    )
  }

  const { error } = await hh.from("lead_cadence_queue").insert(rows)
  if (error) throw new Error(`enroll failed: ${error.message}`)
}

/**
 * Upgrade an email_only lead to full cadence after phone capture.
 */
export async function upgradeToFullCadence(leadId: string) {
  const hh = HH()
  // Cancel remaining email-only template steps (keep the ai_email step 1 if still pending)
  await hh.from("lead_cadence_queue").update({ status: "cancelled", error_message: "upgraded_to_full" })
    .eq("lead_id", leadId).eq("cadence_track", "email_only").eq("status", "pending").gt("step_number", 1)

  // Queue the full-cadence steps (same pattern as enrollHHCadence full branch)
  const now = Date.now()
  const fullSteps: any[] = [
    { lead_id: leadId, step_number: 10, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now).toISOString(), template_slug: "hh-full-call-1" },
    { lead_id: leadId, step_number: 11, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 1 * 60_000).toISOString(), template_slug: "hh-full-sms-intro" },
    { lead_id: leadId, step_number: 12, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 5 * 60_000).toISOString(), template_slug: "hh-full-call-2" },
    { lead_id: leadId, step_number: 13, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 7 * 60_000).toISOString(), template_slug: "hh-full-sms-missed" },
    { lead_id: leadId, step_number: 14, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 60 * 60_000).toISOString(), template_slug: "hh-full-call-3" },
    { lead_id: leadId, step_number: 15, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 24 * 3600_000).toISOString(), template_slug: "hh-full-call-4" },
    { lead_id: leadId, step_number: 16, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 32 * 3600_000).toISOString(), template_slug: "hh-full-sms-value" },
    { lead_id: leadId, step_number: 17, step_type: "call", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 72 * 3600_000).toISOString(), template_slug: "hh-full-call-5" },
    { lead_id: leadId, step_number: 18, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 80 * 3600_000).toISOString(), template_slug: "hh-full-sms-urgency" },
    { lead_id: leadId, step_number: 19, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 120 * 3600_000).toISOString(), template_slug: "hh-full-sms-checkin" },
    { lead_id: leadId, step_number: 20, step_type: "sms", cadence_track: "full", status: "pending", scheduled_for: new Date(now + 152 * 3600_000).toISOString(), template_slug: "hh-full-sms-final" },
  ]
  await hh.from("lead_cadence_queue").insert(fullSteps)
  await hh.from("leads").update({ cadence_track: "full", phone_captured_at: new Date().toISOString() }).eq("id", leadId)
}

export async function logExecution(scriptName: string, entity: string, status: string, details: any) {
  try {
    await MARATHON().from("execution_log").insert({
      script_name: scriptName,
      entity,
      status,
      details,
    })
  } catch {
    // best-effort only
  }
}
