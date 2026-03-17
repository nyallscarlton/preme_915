/**
 * Preme Home Loans — Automatic Post-Call Sales Coach
 *
 * After every call_analyzed event, this module:
 * 1. Pulls the full transcript from Retell
 * 2. Sends it to Claude Opus for a 10-category sales rubric review
 * 3. Stores the scorecard in Supabase (call_reviews table)
 * 4. If CRITICAL issues found, patches Riley's system prompt automatically
 * 5. Sends a Telegram summary with score + top fixes
 *
 * Falls back to GPT-4.1 if Anthropic credits are unavailable.
 */

const RUBRIC = `You are an elite sales coach specializing in mortgage lending phone calls. You're reviewing a call made by "Riley," an AI voice agent for Preme Home Loans (investor mortgage lending — DSCR, Fix & Flip, Bridge, Commercial).

Score each category 1-10 and provide specific coaching notes with exact quotes from the transcript.

## SCORING RUBRIC

### 1. OPENING (1-10)
- Did the agent identify themselves clearly?
- For INBOUND: Did the agent let the caller explain why they called?
- Did the agent get the caller's NAME within the first 30 seconds?
- Was there any confusion or repeated introductions?
- RED FLAG: Template variables spoken literally (e.g., "{{first_name}}")

### 2. RAPPORT & WARMTH (1-10)
- Did the agent build connection before jumping into questions?
- Did the agent use the caller's name naturally?
- Did the agent acknowledge what the caller shared before asking next question?
- Was tone warm and conversational, or robotic?

### 3. NEEDS DISCOVERY (1-10)
- Did the agent uncover WHY, not just WHAT?
- Open-ended questions that let the caller talk?
- Questions woven into conversation or fired like a checklist?
- Did the agent detect owner-occupied vs. investor correctly?

### 4. QUALIFICATION DEPTH (1-10)
- Property type, value, timeline, entity, credit score, experience gathered?
- Any critical missing info?

### 5. PROGRAM KNOWLEDGE (1-10)
- Demonstrated knowledge of loan programs?
- Matched right program to situation?
- Avoided pitching investor products to owner-occupants?
- Compliance guardrails maintained?

### 6. CREDIT SCORE HANDLING (1-10)
- Addressed appropriately? Realistic expectations set? Encouraging without being dishonest?

### 7. OBJECTION HANDLING (1-10)
- Concerns addressed? Acknowledged before responding? N/A if no objections.

### 8. THE CLOSE (1-10)
- Clear next step? Tools used appropriately? Caller guided to concrete action?

### 9. CALL CONTROL & PACING (1-10)
- Control without being pushy? Appropriate length? Clean wrap-up?

### 10. NATURALNESS & HUMAN FEEL (1-10) — HIGH PRIORITY
- Does the agent sound like a real person having a conversation, or like a bot reading a script?
- Are responses varied and natural, or do they follow rigid patterns?
- Does the agent use natural filler/transitions ("Yeah, so...", "I hear you", "That makes sense") vs robotic connectors ("Certainly!", "Great question!")?
- Does the agent avoid overly formal or corporate language that no human would say?
- Would the caller suspect they're talking to AI? What gave it away?
- RED FLAGS: Repeating the caller's info back robotically ("So, to confirm, you said..."), using identical phrases repeatedly, overly enthusiastic reactions, unnaturally perfect grammar

### 11. OVERALL EFFECTIVENESS (1-10)
- Would this call result in a funded loan?

## OUTPUT FORMAT (STRICT JSON)

Return ONLY valid JSON with this structure:
{
  "scores": {
    "opening": <1-10>,
    "rapport": <1-10>,
    "discovery": <1-10>,
    "qualification": <1-10>,
    "program_knowledge": <1-10>,
    "credit_handling": <1-10>,
    "objection_handling": <1-10>,
    "close": <1-10>,
    "call_control": <1-10>,
    "naturalness": <1-10>,
    "effectiveness": <1-10>
  },
  "total": <sum of all 11 categories>,
  "severity": "<CRITICAL|HIGH|MODERATE|LOW>",
  "top_fixes": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "coaching_notes": "<Full coaching analysis as markdown text. For each category include the score and 2-3 sentences of coaching with exact quotes.>",
  "what_went_well": "<1-2 things the agent did right>",
  "prompt_patch": "<If CRITICAL or HIGH severity, specific text to add/change in the system prompt. null if no patch needed.>"
}`

interface ReviewResult {
  scores: {
    opening: number
    rapport: number
    discovery: number
    qualification: number
    program_knowledge: number
    credit_handling: number
    objection_handling: number
    close: number
    call_control: number
    naturalness: number
    effectiveness: number
  }
  total: number
  severity: string
  top_fixes: string[]
  coaching_notes: string
  what_went_well: string
  prompt_patch: string | null
}

/**
 * Review a call transcript and return a structured scorecard.
 * Tries Anthropic (Opus) first, falls back to OpenAI (GPT-4.1).
 */
export async function reviewCall(params: {
  transcript: string
  direction: string
  duration_seconds: number
  disconnect_reason: string
  analysis: Record<string, unknown>
}): Promise<ReviewResult | null> {
  const userMessage = `CALL METADATA:
- Direction: ${params.direction}
- Duration: ${params.duration_seconds}s
- Disconnect reason: ${params.disconnect_reason}
- Post-call analysis: ${JSON.stringify(params.analysis, null, 2)}

FULL TRANSCRIPT:
${params.transcript}`

  // Try Anthropic (Opus) first
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 2000,
          messages: [
            { role: "user", content: `${RUBRIC}\n\n---\n\n${userMessage}` },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text || ""
        return parseReviewJSON(text)
      }
      console.error("[call-reviewer] Anthropic failed:", res.status, await res.text().catch(() => ""))
    } catch (err) {
      console.error("[call-reviewer] Anthropic error:", err)
    }
  }

  // Fallback to OpenAI (GPT-4.1)
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          max_tokens: 2000,
          messages: [
            { role: "system", content: RUBRIC },
            { role: "user", content: userMessage },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || ""
        return parseReviewJSON(text)
      }
      console.error("[call-reviewer] OpenAI failed:", res.status)
    } catch (err) {
      console.error("[call-reviewer] OpenAI error:", err)
    }
  }

  console.error("[call-reviewer] No LLM available for review")
  return null
}

function parseReviewJSON(text: string): ReviewResult | null {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0]) as ReviewResult
  } catch {
    console.error("[call-reviewer] Failed to parse review JSON")
    return null
  }
}

/**
 * Store the review in Supabase via zx_contact_interactions table.
 * Uses channel='call_review' with full scorecard in metadata JSONB.
 */
export async function storeReview(params: {
  callId: string
  agentId: string
  direction: string
  callerPhone: string
  callerName: string
  durationSeconds: number
  recordingUrl: string | null
  transcript: string
  disconnectReason: string
  leadTemperature: string | null
  leadScore: number | null
  loanType: string | null
  callerIntent: string | null
  callSummary: string | null
  callAt: string | null
  review: ReviewResult
}): Promise<boolean> {
  try {
    const { createClient } = await import("@supabase/supabase-js")
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return false

    const supabase = createClient(url, key)

    const { error } = await supabase.from("zx_contact_interactions").insert({
      phone: params.callerPhone || "unknown",
      channel: "voice",
      direction: params.direction,
      content: params.review.coaching_notes,
      summary: `Score: ${params.review.total}/110 (${params.review.severity}) | ${params.review.top_fixes[0] || "No fixes"}`,
      metadata: {
        type: "call_review",
        call_id: params.callId,
        agent_id: params.agentId,
        caller_name: params.callerName,
        duration_seconds: params.durationSeconds,
        recording_url: params.recordingUrl,
        transcript: params.transcript,
        disconnect_reason: params.disconnectReason,
        lead_temperature: params.leadTemperature,
        lead_score: params.leadScore,
        loan_type: params.loanType,
        caller_intent: params.callerIntent,
        call_summary: params.callSummary,
        call_at: params.callAt,
        scores: params.review.scores,
        score_total: params.review.total,
        severity: params.review.severity,
        top_fixes: params.review.top_fixes,
        what_went_well: params.review.what_went_well,
        prompt_patch: params.review.prompt_patch,
        prompt_patch_applied: false,
      },
    })

    if (error) {
      console.error("[call-reviewer] Store error:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[call-reviewer] Store exception:", err)
    return false
  }
}

/**
 * Apply a prompt patch to Riley's LLM if the review found CRITICAL or HIGH issues.
 * Uses raw fetch (not retell-sdk) for reliability on Vercel.
 */
export async function applyPromptPatch(
  review: ReviewResult,
  callId: string
): Promise<string | null> {
  if (!review.prompt_patch) return null
  if (review.severity !== "CRITICAL" && review.severity !== "HIGH") return null

  const retellKey = process.env.RETELL_API_KEY
  const llmId = process.env.RETELL_PREME_LLM_ID
  if (!retellKey || !llmId) {
    console.error("[call-reviewer] Missing RETELL_API_KEY or RETELL_PREME_LLM_ID")
    return null
  }

  try {
    // Get current prompt
    const getRes = await fetch(`https://api.retellai.com/get-retell-llm/${llmId}`, {
      headers: { Authorization: `Bearer ${retellKey}` },
    })
    if (!getRes.ok) {
      console.error("[call-reviewer] Failed to get LLM:", getRes.status)
      return null
    }
    const llmData = await getRes.json()
    const currentPrompt: string = llmData.general_prompt || ""

    // Check if this patch is already applied (avoid duplicates)
    if (currentPrompt.includes(review.prompt_patch.substring(0, 50))) {
      console.log("[call-reviewer] Patch already applied for", callId)
      return "Patch already applied"
    }

    // Append patch under a LEARNED section
    const patchSection = `\n\n==============================\nLEARNED FROM CALL REVIEW (${callId})\n==============================\n${review.prompt_patch}`

    const patchRes = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retellKey}`,
      },
      body: JSON.stringify({ general_prompt: currentPrompt + patchSection }),
    })

    if (!patchRes.ok) {
      console.error("[call-reviewer] Failed to patch LLM:", patchRes.status, await patchRes.text().catch(() => ""))
      return null
    }

    console.log(`[call-reviewer] Prompt patched for call ${callId}: ${review.prompt_patch.substring(0, 80)}...`)

    // Mark patch as applied in zx_contact_interactions
    try {
      const { createClient } = await import("@supabase/supabase-js")
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        const supabase = createClient(url, key)
        // Update the review row's metadata to mark patch as applied
        const { data: rows } = await supabase
          .from("zx_contact_interactions")
          .select("id, metadata")
          .eq("channel", "voice")
          .filter("metadata->>type", "eq", "call_review")
          .filter("metadata->>call_id", "eq", callId)
          .order("created_at", { ascending: false })
          .limit(1)

        if (rows && rows.length > 0) {
          const meta = (rows[0].metadata as Record<string, unknown>) || {}
          await supabase
            .from("zx_contact_interactions")
            .update({
              metadata: { ...meta, prompt_patch_applied: true },
            })
            .eq("id", rows[0].id)
        }
      }
    } catch (err) {
      console.error("[call-reviewer] Failed to mark patch applied:", err)
    }

    return review.prompt_patch
  } catch (err) {
    console.error("[call-reviewer] Patch error:", err)
    return null
  }
}

/**
 * Send a Telegram summary of the review to the team.
 */
export async function sendReviewTelegram(params: {
  callerName: string
  callerPhone: string
  score: number
  severity: string
  topFixes: string[]
  recordingUrl: string | null
  patchApplied: string | null
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  const emoji = params.score >= 80 ? "🟢" : params.score >= 60 ? "🟡" : params.score >= 40 ? "🟠" : "🔴"

  const lines = [
    `🎓 *RILEY CALL REVIEW*`,
    ``,
    `${emoji} *Score: ${params.score}/100* (${params.severity})`,
    `📞 ${params.callerName || "Unknown"} — ${params.callerPhone}`,
    ``,
    `*Top Fixes:*`,
    ...params.topFixes.map((f, i) => `${i + 1}. ${f}`),
    ``,
    params.patchApplied ? `🔧 *Prompt auto-patched:* ${params.patchApplied.substring(0, 100)}...` : null,
    params.recordingUrl ? `[🎧 Listen](${params.recordingUrl})` : null,
  ].filter(Boolean).join("\n")

  fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  }).catch((err) => console.error("[call-reviewer] Telegram error:", err))
}
