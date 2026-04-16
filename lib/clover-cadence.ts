import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const CLOVER = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "clover" } }
)

const MARATHON = () => createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "marathon" } }
)

const RESEND_FROM = process.env.CLOVER_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "Clover AI <onboarding@resend.dev>"

export interface CloverQueueRow {
  id: string
  lead_id: string
  step_number: number
  step_type: "call" | "sms" | "email" | "ai_email"
  status: string
  scheduled_for: string
  template_slug: string | null
  message_override: string | null
}

function demoUrlFor(industry: string): string {
  const map: Record<string, string> = {
    dental: "https://cloveraiagency.com/demo/dental",
    hvac: "https://cloveraiagency.com/demo/hvac",
    real_estate: "https://cloveraiagency.com/demo/wholesaler",
    medical: "https://cloveraiagency.com/demo/medical",
    legal: "https://cloveraiagency.com/demo/legal",
  }
  return map[industry] || "https://cloveraiagency.com/demo"
}

function fillClover(body: string, extras: Record<string, string>) {
  return body
    .replace(/\[first_name\]/g, extras.first_name || "there")
    .replace(/\[company_name\]/g, extras.company_name || "your business")
    .replace(/\[industry\]/g, extras.industry || "your industry")
    .replace(/\[demo_url\]/g, extras.demo_url || "https://cloveraiagency.com/demo")
}

async function sendEmail(to: string, subject: string, body: string) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured")
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text: body }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`)
  }
}

async function generateCloverAIReply(context: {
  first_name: string
  company_name: string
  industry: string
  reply_text: string
  demo_url: string
}): Promise<{ subject: string; body: string }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured")
  const system = `You are Nyalls, founder of Clover AI — an agency that builds AI voice agents for small businesses. Your agents answer phones, book appointments, handle after-hours calls, and qualify leads automatically.

You are replying to a business owner who responded to your cold email. Write a SHORT, warm, conversational email reply.

RULES:
- Keep it 3-5 sentences max
- Reference what they actually said
- Instead of explaining what you do, SHOW them — send them to a demo
- Include this demo link naturally: ${context.demo_url}
- Frame it as "I built a quick demo of what this sounds like for a ${context.industry} business — give it a call, takes 60 seconds"
- Mention that after they try the demo, you'll build a FREE custom version for their business
- Sign off casually as "— Nyalls"
- Do NOT sound like AI or corporate
- Do NOT use bullet points
- Write like you're a founder who's genuinely excited about their product
- Output exactly this format:
  Subject: <short reply subject>
  <blank line>
  <email body>`
  const userMsg = `Prospect: ${context.first_name || "there"} from ${context.company_name || "their business"} (${context.industry}).
They replied to your cold email with:

"${context.reply_text}"

Write a reply email.`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, system, messages: [{ role: "user", content: userMsg }] }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }
  const json: any = await res.json()
  const raw: string = json.content?.[0]?.text || ""
  const subjMatch = raw.match(/^Subject:\s*(.+?)(?:\r?\n)/i)
  const subject = subjMatch ? subjMatch[1].trim() : `Re: ${context.company_name || "your message"}`
  const body = raw.replace(/^Subject:.+?\r?\n\r?\n?/i, "").trim()
  return { subject, body }
}

export async function executeCloverStep(row: CloverQueueRow): Promise<{ ok: boolean; error?: string }> {
  const c = CLOVER()
  const { data: lead, error: leadErr } = await c.from("leads").select("*").eq("id", row.lead_id).single()
  if (leadErr || !lead) return { ok: false, error: `lead not found: ${leadErr?.message}` }

  const demoUrl = demoUrlFor(lead.industry || "other")

  try {
    if (row.step_type === "ai_email") {
      if (!lead.email) return { ok: false, error: "no email" }
      const ctx = row.message_override ? JSON.parse(row.message_override) : {}
      const ai = await generateCloverAIReply({
        first_name: ctx.first_name || lead.first_name || "",
        company_name: ctx.company_name || lead.company_name || "",
        industry: ctx.industry || lead.industry || "small business",
        reply_text: ctx.reply_text || "",
        demo_url: ctx.demo_url || demoUrl,
      })
      const subject = ctx.original_subject ? `Re: ${ctx.original_subject.replace(/^Re:\s*/i, "")}` : ai.subject
      await sendEmail(lead.email, subject, ai.body)
      await c.from("leads").update({ status: "demo_sent", funnel_stage: "demo" }).eq("id", lead.id)
      return { ok: true }
    }
    if (row.step_type === "email") {
      if (!lead.email) return { ok: false, error: "no email" }
      if (!row.template_slug) return { ok: false, error: "no template_slug" }
      const { data: tpl } = await c.from("cadence_templates").select("subject, body").eq("slug", row.template_slug).single()
      if (!tpl) return { ok: false, error: `template not found: ${row.template_slug}` }
      const extras = {
        first_name: lead.first_name || "",
        company_name: lead.company_name || "",
        industry: lead.industry || "",
        demo_url: demoUrl,
      }
      await sendEmail(lead.email, fillClover(tpl.subject || "Following up", extras), fillClover(tpl.body, extras))
      return { ok: true }
    }
    return { ok: false, error: `unsupported step_type: ${row.step_type}` }
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) }
  }
}

export async function enrollCloverCadence(opts: {
  leadId: string
  aiContext: {
    reply_text: string
    original_subject: string
    first_name: string
    company_name: string
    industry: string
    demo_url: string
  }
}) {
  const c = CLOVER()
  const now = Date.now()
  await c.from("lead_cadence_queue").insert([
    {
      lead_id: opts.leadId, step_number: 1, step_type: "ai_email", status: "pending",
      scheduled_for: new Date(now + 5 * 60_000).toISOString(),
      message_override: JSON.stringify(opts.aiContext),
    },
    {
      lead_id: opts.leadId, step_number: 2, step_type: "email", status: "pending",
      scheduled_for: new Date(now + 48 * 3600_000).toISOString(),
      template_slug: "clover-followup-48hr",
    },
    {
      lead_id: opts.leadId, step_number: 3, step_type: "email", status: "pending",
      scheduled_for: new Date(now + 5 * 24 * 3600_000).toISOString(),
      template_slug: "clover-followup-5day",
    },
  ])
}

export async function logExecution(scriptName: string, entity: string, status: string, details: any) {
  try {
    await MARATHON().from("execution_log").insert({
      script_name: scriptName, entity, status, details,
    })
  } catch {}
}
