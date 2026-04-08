#!/usr/bin/env npx tsx
/**
 * Preme Home Loans — Auto Review & Store Pipeline
 *
 * Runs locally (Mac mini) every 10 minutes via launchd.
 * Pulls unreviewed calls from Retell, reviews with Claude/GPT,
 * stores scorecard in Supabase, and patches Riley's prompt.
 *
 * Usage:
 *   cd preme-portal && npx tsx scripts/review-and-store.ts
 */

import Retell from "retell-sdk"
import { readFileSync } from "fs"
import { resolve } from "path"
import { createClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// ENV LOADING
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), ".env.local")
try {
  const envContent = readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx)
    const val = trimmed.slice(eqIdx + 1)
    if (!process.env[key]) process.env[key] = val
  }
} catch {}

const RETELL_API_KEY = process.env.RETELL_API_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const LLM_ID = process.env.RETELL_PREME_LLM_ID!
const AGENT_ID = process.env.RETELL_PREME_AGENT_ID || "agent_a6b1d2e882775997b0c4e286b2"

const TRAINING_PHONES = new Set(["+14706225965", "+19453088322"])

const retell = new Retell({ apiKey: RETELL_API_KEY })
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ---------------------------------------------------------------------------
// RUBRIC (same as call-reviewer.ts)
// ---------------------------------------------------------------------------
const RUBRIC = `You are an elite sales coach specializing in mortgage lending phone calls. You're reviewing a call made by "Riley," an AI voice agent for Preme Home Loans (investor mortgage lending — DSCR, Fix & Flip, Bridge, Commercial).

Score each category 1-10 and provide specific coaching notes with exact quotes from the transcript.

## SCORING RUBRIC

### 1. OPENING (1-10)
- Did the agent identify themselves clearly?
- For INBOUND: Did the agent let the caller explain why they called?
- Did the agent focus on understanding the caller's problem BEFORE collecting personal details?
- RED FLAG: Template variables spoken literally (e.g., "{{first_name}}")
- RED FLAG: "Let me pull up your information" — NEVER acceptable

### 2. RAPPORT & WARMTH (1-10)
- Connection before jumping into questions?
- Natural name usage?
- Warm and conversational, or robotic?

### 3. PAIN UNDERSTANDING & TRUST (1-10)
- Understood the caller's actual problem?
- Showed competence?
- Open-ended questions that let the caller talk?

### 4. QUALIFICATION DEPTH (1-10)
- Property type, value, timeline, entity, credit, experience gathered?

### 5. PROGRAM KNOWLEDGE (1-10)
- Right program for situation? Compliance maintained?

### 6. CREDIT SCORE HANDLING (1-10)
- Appropriate and encouraging? N/A if not discussed.

### 7. OBJECTION HANDLING (1-10)
- Acknowledged before responding? N/A if no objections.

### 8. THE CLOSE (1-10)
- Clear next step? Tools used? Action confirmed?

### 9. CALL CONTROL & PACING (1-10)
- Good flow? Appropriate length?

### 10. NATURALNESS & HUMAN FEEL (1-10)
- Sounds like a real person? Varied responses? No robotic patterns?

### 11. OVERALL EFFECTIVENESS (1-10)
- Would this call result in a funded loan?

## OUTPUT FORMAT (STRICT JSON)
Return ONLY valid JSON:
{
  "scores": {
    "opening": <1-10>, "rapport": <1-10>, "discovery": <1-10>,
    "qualification": <1-10>, "program_knowledge": <1-10>,
    "credit_handling": <1-10>, "objection_handling": <1-10>,
    "close": <1-10>, "call_control": <1-10>, "naturalness": <1-10>,
    "effectiveness": <1-10>
  },
  "total": <sum>,
  "severity": "<CRITICAL|HIGH|MODERATE|LOW>",
  "top_fixes": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "coaching_notes": "<Full coaching analysis as markdown>",
  "what_went_well": "<1-2 things done right>",
  "prompt_patch": "<Concise prompt addition to fix top issue. null if LOW severity.>"
}`

// ---------------------------------------------------------------------------
// REVIEW FUNCTION
// ---------------------------------------------------------------------------
async function reviewTranscript(transcript: string, metadata: string): Promise<any> {
  const userMessage = `${metadata}\n\nFULL TRANSCRIPT:\n${transcript}`

  // Try Anthropic first
  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: `${RUBRIC}\n\n---\n\n${userMessage}` }],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text || ""
        const match = text.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
      }
      console.error("[review] Anthropic failed:", res.status)
    } catch (err) {
      console.error("[review] Anthropic error:", err)
    }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
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
        const match = text.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
      }
    } catch (err) {
      console.error("[review] OpenAI error:", err)
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// PROMPT PATCH
// ---------------------------------------------------------------------------
async function applyPatch(review: any, callId: string): Promise<boolean> {
  if (!review.prompt_patch) return false
  if (!["CRITICAL", "HIGH", "MODERATE"].includes(review.severity)) return false

  try {
    const getRes = await fetch(`https://api.retellai.com/get-retell-llm/${LLM_ID}`, {
      headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
    })
    if (!getRes.ok) return false
    const llmData = await getRes.json()
    const currentPrompt: string = llmData.general_prompt || ""

    // Check for duplicate
    if (review.prompt_patch.length > 50 && currentPrompt.includes(review.prompt_patch.substring(0, 50))) {
      console.log(`[review] Patch already applied for ${callId}`)
      return false
    }

    // Parse existing learnings
    const SEPARATOR = "==============================\nLEARNED FROM CALL REVIEW"
    const firstIdx = currentPrompt.indexOf(SEPARATOR)
    let basePrompt: string
    let learnings: string[] = []

    if (firstIdx === -1) {
      basePrompt = currentPrompt
    } else {
      basePrompt = currentPrompt.substring(0, firstIdx).replace(/\n+$/, "")
      const block = currentPrompt.substring(firstIdx)
      const starts: number[] = []
      let searchFrom = 0
      while (true) {
        const idx = block.indexOf(SEPARATOR, searchFrom)
        if (idx === -1) break
        starts.push(idx)
        searchFrom = idx + 1
      }
      for (let i = 0; i < starts.length; i++) {
        const end = i + 1 < starts.length ? starts[i + 1] : block.length
        learnings.push(block.substring(starts[i], end).trim())
      }
    }

    // Add new learning, keep max 5
    learnings.push(`${SEPARATOR} (${callId})\n==============================\n${review.prompt_patch}`)
    learnings = learnings.slice(-5)

    const updatedPrompt = basePrompt + "\n\n" + learnings.join("\n\n")

    const patchRes = await fetch(`https://api.retellai.com/update-retell-llm/${LLM_ID}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RETELL_API_KEY}`,
      },
      body: JSON.stringify({ general_prompt: updatedPrompt }),
    })

    if (patchRes.ok) {
      console.log(`[review] Prompt patched: ${review.prompt_patch.substring(0, 80)}...`)
      return true
    }
    return false
  } catch (err) {
    console.error("[review] Patch error:", err)
    return false
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log(`[review] Starting review pipeline at ${new Date().toISOString()}`)

  // Get recent calls
  const calls = await retell.call.list({
    filter_criteria: {
      agent_id: [AGENT_ID],
    },
    sort_order: "descending",
    limit: 10,
  })

  // Get already-reviewed call IDs
  const { data: reviewed } = await supabase
    .from("zx_contact_interactions")
    .select("metadata")
    .filter("metadata->>type", "eq", "call_review")
    .order("created_at", { ascending: false })
    .limit(50)

  const reviewedIds = new Set(
    (reviewed || []).map((r: any) => r.metadata?.call_id).filter(Boolean)
  )

  // Filter to unreviewed calls with transcripts > 30s
  const toReview = calls.filter((c: any) => {
    if (reviewedIds.has(c.call_id)) return false
    if (!c.transcript || c.transcript.length < 50) return false
    const duration = c.end_timestamp && c.start_timestamp
      ? (c.end_timestamp - c.start_timestamp) / 1000
      : 0
    if (duration < 30) return false
    // Skip training calls
    const phone = c.from_number || c.to_number || ""
    if (TRAINING_PHONES.has(phone)) return false
    return true
  })

  if (toReview.length === 0) {
    console.log("[review] No unreviewed calls found")
    return
  }

  console.log(`[review] Found ${toReview.length} unreviewed call(s)`)

  for (const call of toReview) {
    const callId = call.call_id
    const analysis = (call as any).call_analysis?.custom_analysis_data || {}
    const duration = call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : 0
    const callerPhone = call.from_number || call.to_number || "unknown"
    const callerName = [analysis.first_name, analysis.last_name].filter(Boolean).join(" ") || "Unknown"

    const metadata = `CALL METADATA:
- Direction: ${(call as any).direction || "unknown"}
- Duration: ${duration}s
- Disconnect reason: ${(call as any).disconnection_reason || "unknown"}
- Post-call analysis: ${JSON.stringify(analysis, null, 2)}`

    console.log(`\n[review] Reviewing ${callId} (${callerName}, ${duration}s)...`)

    const review = await reviewTranscript(call.transcript!, metadata)
    if (!review) {
      console.error(`[review] Failed to generate review for ${callId}`)
      continue
    }

    console.log(`[review] Score: ${review.total}/110 (${review.severity})`)
    console.log(`[review] Top fix: ${review.top_fixes?.[0] || "none"}`)

    // Store in Supabase
    const { error } = await supabase.from("zx_contact_interactions").insert({
      phone: callerPhone,
      channel: "voice",
      direction: (call as any).direction || "outbound",
      content: review.coaching_notes,
      summary: `Score: ${review.total}/110 (${review.severity}) | ${review.top_fixes?.[0] || "No fixes"}`,
      metadata: {
        type: "call_review",
        call_id: callId,
        agent_id: AGENT_ID,
        caller_name: callerName,
        duration_seconds: duration,
        recording_url: call.recording_url || null,
        scores: review.scores,
        score_total: review.total,
        severity: review.severity,
        top_fixes: review.top_fixes,
        what_went_well: review.what_went_well,
        prompt_patch: review.prompt_patch,
        prompt_patch_applied: false,
      },
    })

    if (error) {
      console.error(`[review] Store error:`, error.message)
    } else {
      console.log(`[review] Stored review for ${callId}`)
    }

    // Apply prompt patch if needed
    if (review.prompt_patch && ["CRITICAL", "HIGH", "MODERATE"].includes(review.severity)) {
      const applied = await applyPatch(review, callId)
      if (applied) {
        // Mark as applied
        await supabase
          .from("zx_contact_interactions")
          .update({ metadata: { type: "call_review", call_id: callId, prompt_patch_applied: true } })
          .filter("metadata->>call_id", "eq", callId)
          .filter("metadata->>type", "eq", "call_review")
      }
    }
  }

  console.log(`\n[review] Pipeline complete`)
}

main().catch((err) => {
  console.error("[review] Fatal error:", err)
  process.exit(1)
})
