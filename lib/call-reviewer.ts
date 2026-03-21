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
- For INBOUND: Did the agent let the caller explain why they called and what their PAIN is?
- Did the agent focus on understanding the caller's problem BEFORE collecting personal details?
- Was there any confusion or repeated introductions?
- RED FLAG: Template variables spoken literally (e.g., "{{first_name}}")
- NOTE: Getting the caller's name is nice but NOT a priority. Pain discovery matters more than name collection.

### 2. RAPPORT & WARMTH (1-10)
- Did the agent build connection before jumping into questions?
- Did the agent use the caller's name naturally?
- Did the agent acknowledge what the caller shared before asking next question?
- Was tone warm and conversational, or robotic?

### 3. PAIN DISCOVERY / SANDLER PAIN FUNNEL (1-10) — HIGH PRIORITY
- Did the agent uncover the caller's PAIN — not just what they want, but WHY and what happens if they don't get it?
- Did the agent go 3-4 levels deep on the pain (surface → impact → urgency → emotion)?
- Open-ended questions that let the caller talk?
- Did the agent reflect the pain back so the caller felt truly heard BEFORE pitching solutions?
- Did the agent build TRUST through demonstrating they understand the problem?
- Questions woven into conversation or fired like a checklist?
- Did the agent detect owner-occupied vs. investor correctly?
- NOTE: Trust comes from "can you solve my problem?" not from collecting info. Pain discovery drives the entire sale.

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
  "prompt_patch": "<If CRITICAL, HIGH, or MODERATE severity (score under 85), provide specific text to add to the system prompt to fix the top issue. Keep it under 3 sentences — concise and actionable. null only if LOW severity.>"
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
 * Apply a prompt patch to Riley's LLM.
 * Triggers on CRITICAL, HIGH, or MODERATE (score < 85) severity.
 * Maintains a ROLLING WINDOW of max 5 learnings — oldest get pruned.
 */
export async function applyPromptPatch(
  review: ReviewResult,
  callId: string
): Promise<string | null> {
  if (!review.prompt_patch) return null
  // Patch on CRITICAL, HIGH, or MODERATE severity
  const patchSeverities = ["CRITICAL", "HIGH", "MODERATE"]
  if (!patchSeverities.includes(review.severity)) return null

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

    // Check if this exact patch is already applied (avoid duplicates)
    if (review.prompt_patch.length > 50 && currentPrompt.includes(review.prompt_patch.substring(0, 50))) {
      console.log("[call-reviewer] Patch already applied for", callId)
      return "Patch already applied"
    }

    // --- Rolling window: keep max 5 LEARNED sections ---
    // Split prompt at each LEARNED FROM CALL REVIEW boundary
    const LEARNED_SEPARATOR = "\n\n==============================\nLEARNED FROM CALL REVIEW"
    const firstLearnedIdx = currentPrompt.indexOf("==============================\nLEARNED FROM CALL REVIEW")
    let basePrompt: string
    let existingLearnings: string[]

    if (firstLearnedIdx === -1) {
      // No existing learnings
      basePrompt = currentPrompt
      existingLearnings = []
    } else {
      // Split base from learnings
      basePrompt = currentPrompt.substring(0, firstLearnedIdx).replace(/\n+$/, "")
      const learnedBlock = currentPrompt.substring(firstLearnedIdx)
      // Split individual learned sections by finding each "======" header
      existingLearnings = []
      const sectionStarts: number[] = []
      let searchFrom = 0
      while (true) {
        const idx = learnedBlock.indexOf("==============================\nLEARNED FROM CALL REVIEW", searchFrom)
        if (idx === -1) break
        sectionStarts.push(idx)
        searchFrom = idx + 1
      }
      for (let i = 0; i < sectionStarts.length; i++) {
        const start = sectionStarts[i]
        const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : learnedBlock.length
        existingLearnings.push(learnedBlock.substring(start, end).trim())
      }
    }

    // Add new learning
    const newLearning = `==============================\nLEARNED FROM CALL REVIEW (${callId})\n==============================\n${review.prompt_patch}`
    existingLearnings.push(newLearning)

    // Keep only the 5 most recent learnings (drop oldest)
    const MAX_LEARNINGS = 5
    const trimmedLearnings = existingLearnings.slice(-MAX_LEARNINGS)

    // Rebuild prompt
    const updatedPrompt = trimmedLearnings.length > 0
      ? basePrompt + "\n\n" + trimmedLearnings.join("\n\n")
      : basePrompt

    const patchRes = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retellKey}`,
      },
      body: JSON.stringify({ general_prompt: updatedPrompt }),
    })

    if (!patchRes.ok) {
      console.error("[call-reviewer] Failed to patch LLM:", patchRes.status, await patchRes.text().catch(() => ""))
      return null
    }

    const pruned = existingLearnings.length - trimmedLearnings.length
    console.log(`[call-reviewer] Prompt patched for call ${callId} (${trimmedLearnings.length}/5 learnings${pruned > 0 ? `, pruned ${pruned} old` : ""}): ${review.prompt_patch.substring(0, 80)}...`)

    // Mark patch as applied in zx_contact_interactions
    try {
      const { createClient } = await import("@supabase/supabase-js")
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && key) {
        const supabase = createClient(url, key)
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
 * sendReviewTelegram — DISABLED
 * Score alerts are no longer sent. Reviews are stored in Supabase
 * and auto-patch the prompt. No notification needed unless actionable.
 */
export async function sendReviewTelegram(_params: {
  callerName: string
  callerPhone: string
  score: number
  severity: string
  topFixes: string[]
  recordingUrl: string | null
  patchApplied: string | null
}) {
  // Intentionally disabled — no Telegram score alerts.
  // Reviews are stored in Supabase and visible in Mission Control.
  return
}
