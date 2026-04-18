import { createZentrxClient } from "@/lib/supabase/admin"
import OpenAI from "openai"

let _openai: OpenAI | null = null
function openaiClient(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type Interaction = {
  channel: "sms" | "voice" | "form" | "email"
  direction: "inbound" | "outbound"
  content: string | null
  summary?: string | null
  metadata?: Record<string, unknown>
}

export type ContactProfile = {
  id: string
  phone: string
  first_name: string | null
  last_name: string | null
  email: string | null
  lead_id: string | null
  preferences: Record<string, unknown>
  summary: string | null
  interaction_count: number
  last_interaction_at: string | null
}

// ─── Core Operations ────────────────────────────────────────────────────────

/** Normalize phone to E.164 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`
}

/** Get or create a contact profile by phone number */
export async function getOrCreateProfile(phone: string, defaults?: {
  first_name?: string
  last_name?: string
  email?: string
  lead_id?: string
}): Promise<ContactProfile> {
  const supabase = createZentrxClient()
  const normalized = normalizePhone(phone)

  const { data: existing } = await supabase
    .from("zx_contact_profiles")
    .select("*")
    .eq("phone", normalized)
    .maybeSingle()

  if (existing) return existing as ContactProfile

  const { data: created, error } = await supabase
    .from("zx_contact_profiles")
    .insert({
      phone: normalized,
      first_name: defaults?.first_name ?? null,
      last_name: defaults?.last_name ?? null,
      email: defaults?.email ?? null,
      lead_id: defaults?.lead_id ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create profile: ${error.message}`)
  return created as ContactProfile
}

/** Store an interaction in the contact timeline */
export async function storeInteraction(phone: string, interaction: Interaction): Promise<void> {
  const supabase = createZentrxClient()
  const normalized = normalizePhone(phone)

  // Ensure profile exists
  await getOrCreateProfile(phone)

  // Insert interaction
  await supabase.from("contact_interactions").insert({
    phone: normalized,
    channel: interaction.channel,
    direction: interaction.direction,
    content: interaction.content,
    summary: interaction.summary ?? null,
    metadata: interaction.metadata ?? {},
  })

  // Update profile counters
  await supabase
    .from("zx_contact_profiles")
    .update({
      last_interaction_at: new Date().toISOString(),
      interaction_count: (await getInteractionCount(normalized)),
    })
    .eq("phone", normalized)
}

async function getInteractionCount(phone: string): Promise<number> {
  const supabase = createZentrxClient()
  const { count } = await supabase
    .from("contact_interactions")
    .select("*", { count: "exact", head: true })
    .eq("phone", phone)
  return (count ?? 0) + 1
}

/** Get recent interactions for a phone number */
export async function getRecentInteractions(phone: string, limit = 20): Promise<any[]> {
  const supabase = createZentrxClient()
  const normalized = normalizePhone(phone)

  const { data } = await supabase
    .from("contact_interactions")
    .select("*")
    .eq("phone", normalized)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).reverse() // chronological order
}

/** Pull SMS messages from Retell chat API for a phone number */
async function getRetellSmsMessages(phone: string): Promise<{ role: string; content: string; time: number }[]> {
  try {
    const Retell = (await import("retell-sdk")).default
    const client = new Retell({ apiKey: process.env.RETELL_API_KEY! })

    const normalized = normalizePhone(phone)
    const digits = normalized.replace(/\D/g, "").slice(-10)

    const chatList = await client.chat.list({ limit: 15, sort_order: "descending" }) as any
    const chats = chatList.items || chatList || []

    // Find chats involving this phone number
    const matching = chats.filter((c: any) =>
      c.to_number?.includes(digits) || c.from_number?.includes(digits)
    )

    const allMessages: { role: string; content: string; time: number }[] = []

    // Get messages from the most recent 3 chats
    for (const chat of matching.slice(0, 3)) {
      try {
        const full = await client.chat.retrieve(chat.chat_id)
        const msgs = (full as any).message_with_tool_calls || []
        for (const m of msgs) {
          if (m.content) {
            allMessages.push({
              role: m.role,
              content: m.content,
              time: m.created_timestamp || chat.start_timestamp || 0,
            })
          }
        }
      } catch {
        // Skip failed retrievals
      }
    }

    // Sort by time
    allMessages.sort((a, b) => a.time - b.time)
    return allMessages
  } catch (err) {
    console.error("[memory] Failed to fetch Retell SMS messages:", err)
    return []
  }
}

/** Build a conversation context string for injecting into AI prompts.
 *
 * Works like human memory:
 * - Recent interactions (last 5): full detail — like remembering yesterday
 * - Older interactions: compressed summary — like remembering last month
 * - Key facts: always present — like knowing a regular customer's name and order
 * - SMS messages from Retell: pulled directly from the chat API
 */
export async function buildConversationContext(phone: string): Promise<string> {
  const profile = await getOrCreateProfile(phone)
  const allInteractions = await getRecentInteractions(phone, 30)

  // Also pull SMS messages directly from Retell (these may not be in our DB yet)
  const smsMessages = await getRetellSmsMessages(phone)

  if (allInteractions.length === 0 && smsMessages.length === 0) {
    return "No prior interactions with this contact."
  }

  const lines: string[] = []

  // Section 1: WHO IS THIS PERSON (key facts, always present)
  if (profile.first_name) {
    lines.push(`CONTACT: ${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`)
  }
  if (profile.summary) {
    lines.push(`BACKGROUND: ${profile.summary}`)
  }

  // Section 2: RECENT (last 5 interactions — full detail)
  const recent = allInteractions.slice(-5)
  const older = allInteractions.slice(0, -5)

  if (older.length > 0) {
    // Section 3: OLDER HISTORY (compressed — just the key points)
    lines.push(`\nEARLIER HISTORY (${older.length} prior interactions):`)
    for (const i of older) {
      const time = new Date(i.created_at).toLocaleString("en-US", {
        month: "short", day: "numeric",
      })
      const channel = i.channel === "sms" ? "Text" : i.channel === "voice" ? "Call" : i.channel === "email" ? "Email" : "Form"
      const dir = i.direction === "inbound" ? "from them" : "from Riley"

      // For older interactions, just show summary or first 80 chars
      if (i.channel === "voice" && i.summary) {
        const short = i.summary.length > 80 ? i.summary.slice(0, 80) + "..." : i.summary
        lines.push(`  [${time}] ${channel} (${dir}): ${short}`)
      } else if (i.content) {
        const short = i.content.length > 80 ? i.content.slice(0, 80) + "..." : i.content
        lines.push(`  [${time}] ${channel} (${dir}): ${short}`)
      }
    }
  }

  // Recent interactions — full detail, this is what matters most
  if (recent.length > 0) {
    lines.push(`\nRECENT (last ${recent.length} interactions — pay close attention):`)
    for (const i of recent) {
      const time = new Date(i.created_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
      })
      const channel = i.channel === "sms" ? "TEXT" : i.channel === "voice" ? "CALL" : i.channel === "email" ? "EMAIL" : "FORM"
      const dir = i.direction === "inbound" ? "THEM →" : "RILEY →"

      if (i.channel === "voice" && i.summary) {
        lines.push(`[${time}] ${channel} ${dir} ${i.summary}`)
      } else if (i.content) {
        const content = i.content.length > 300 ? i.content.slice(0, 300) + "..." : i.content
        lines.push(`[${time}] ${channel} ${dir} ${content}`)
      }
    }
  }

  // SMS messages from Retell — these are the most current text conversations
  if (smsMessages.length > 0) {
    lines.push(`\nTEXT MESSAGE THREAD (from Retell SMS — this is the active text conversation):`)
    // Show last 10 messages from SMS
    const recentSms = smsMessages.slice(-10)
    for (const m of recentSms) {
      const time = m.time ? new Date(m.time).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
      }) : "?"
      const who = m.role === "user" ? "THEM" : "RILEY"
      const content = m.content.length > 200 ? m.content.slice(0, 200) + "..." : m.content
      lines.push(`[${time}] ${who}: ${content}`)
    }
  }

  return lines.join("\n")
}

/** Update the rolling summary on a profile using AI */
export async function updateProfileSummary(phone: string): Promise<void> {
  const normalized = normalizePhone(phone)
  const interactions = await getRecentInteractions(phone, 30)

  if (interactions.length < 2) return

  const timeline = interactions.map(i => {
    const channel = i.channel === "sms" ? "Text" : "Call"
    const dir = i.direction === "inbound" ? "Them" : "Riley"
    return `[${channel}/${dir}]: ${i.summary || i.content || "no content"}`
  }).join("\n")

  try {
    const response = await openaiClient().chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Summarize this contact's conversation history in 2-3 sentences. Focus on: what they're looking for (loan type, property, timeline), their qualification level, any objections or concerns, and where the conversation left off. Be concise and factual."
        },
        { role: "user", content: timeline }
      ],
      max_tokens: 200,
    })

    const summary = response.choices[0]?.message?.content?.trim()
    if (summary) {
      const supabase = createZentrxClient()
      await supabase
        .from("zx_contact_profiles")
        .update({ summary })
        .eq("phone", normalized)
    }
  } catch (err) {
    console.error("[memory] Failed to update summary:", err)
  }
}

/** Generate an AI SMS reply with full conversation context */
export async function generateSmsReply(phone: string, inboundMessage: string): Promise<string> {
  const context = await buildConversationContext(phone)
  const profile = await getOrCreateProfile(phone)
  const firstName = profile.first_name || "there"

  const response = await openaiClient().chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.9,
    messages: [
      {
        role: "system",
        content: `You are Riley, a sharp and personable real estate financing specialist at Preme Home Loans. You're texting with ${firstName}.

## YOUR PERSONALITY
- Direct, warm, confident. Urban, relaxed energy.
- Short texts — 1-3 sentences MAX per message. This is texting, not email.
- Use casual language. Contractions, "gonna", "yeah" instead of "yes".
- Light humor when appropriate. Match their energy.
- Never say you're an AI. You're a real person.

## SANDLER METHODOLOGY (adapted for text)
- Build rapport before qualifying
- Uncover pain: "What's got you looking into this?"
- Let them sell themselves — ask "why" questions
- Never chase. If not interested: "No worries, hit us up when you're ready"
- One question per text. Never stack questions.

## WHAT TO LEARN (naturally, over the conversation)
- Property type, rough value
- Timeline to close
- LLC or personal name
- Credit ballpark
- Experience level
- What's motivating them NOW

## LOAN KNOWLEDGE
- DSCR: qualifies on rental income, no W-2s. 7-14 day close.
- Fix & flip: short-term bridge based on ARV. Fast close.
- Bridge: asset-based, close in a week or two.
- Business credit: entity-based lines, no personal guarantee options.

## QUALIFYING → HANDOFF
When they seem qualified (has a deal, 650+ credit, <60 day timeline), offer:
"Want me to have our loan officer reach out? They'll get you actual numbers on your deal."

## RULES
- NEVER promise specific rates or guaranteed approval
- NEVER ask for SSN or exact credit score
- Keep it conversational — this is texting
- If they ask about rates: "Depends on the deal — property, LTV, credit all factor in. That's what our LO will break down for you."
- Reference past conversations naturally: "Last time we talked about..." or "You mentioned..."

## CONVERSATION HISTORY
${context}`
      },
      { role: "user", content: inboundMessage }
    ],
    max_tokens: 150,
  })

  return response.choices[0]?.message?.content?.trim() || "Hey, got your message! Let me look into that and get back to you."
}

/** Generate an AI SMS reply for water damage vertical */
export async function generateWaterDamageSmsReply(phone: string, inboundMessage: string): Promise<string> {
  const context = await buildConversationContext(phone)
  const profile = await getOrCreateProfile(phone)
  const firstName = profile.first_name || "there"

  const response = await openaiClient().chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You are Sarah, an emergency water damage intake dispatcher. You're texting with ${firstName}.

## YOUR PERSONALITY
- Calm, professional, empathetic. Like a 911 dispatcher over text.
- Short texts — 1-3 sentences MAX per message. This is texting, not email.
- Direct and efficient. Every message should move toward getting them help.
- Never say you're an AI. You're a real person.

## YOUR GOAL
Get them connected with a local restoration crew as fast as possible. If they text after a call, they likely have follow-up questions or need to reschedule.

## WHAT YOU KNOW
- 24/7 emergency water damage restoration
- Free on-site damage assessments
- Works with all major insurance carriers
- Typical response time: 30 minutes
- Mold risk starts within 24-48 hours of water damage

## COMMON SCENARIOS
- **Follow-up after call:** "Hey ${firstName}, just checking in — did the restoration crew reach you? Let me know if you need anything."
- **Scheduling questions:** Help them coordinate timing, reassure them about the process.
- **Insurance questions:** Reassure that the restoration company handles insurance claims directly.
- **Pricing questions:** Explain that a free on-site assessment is needed to give accurate pricing. Don't quote numbers.
- **Not ready yet:** "No pressure at all. Just know that with water damage, time matters — mold can start in 24-48 hours. We're here 24/7 whenever you're ready."

## RULES
- NEVER quote specific prices
- NEVER guarantee insurance coverage
- NEVER provide DIY advice
- NEVER diagnose mold or health hazards
- Keep it warm but urgent — the situation itself creates urgency
- One question per text. Don't stack questions.
- If they want to schedule or need immediate help, offer to call them or have a crew dispatched.

## CONVERSATION HISTORY
${context}`
      },
      { role: "user", content: inboundMessage }
    ],
    max_tokens: 150,
  })

  return response.choices[0]?.message?.content?.trim() || "Hey, got your message! Let me look into that for you."
}
