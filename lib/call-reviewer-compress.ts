/**
 * Preme Home Loans — Call Review Compression Engine
 *
 * Runs periodically (after every 10-15 calls) to compress accumulated
 * tactical prompt patches into permanent Core Rules. This prevents the
 * system prompt from growing unbounded while preserving lessons learned.
 *
 * Flow:
 * 1. Pull all uncompressed call review patches from Supabase
 * 2. Send patches to LLM to find patterns (3+ occurrences = Core Rule)
 * 3. Fetch Riley's current prompt from Retell
 * 4. Inject/replace CORE RULES FROM EXPERIENCE section
 * 5. Update Retell LLM
 * 6. Mark reviews as compressed in Supabase
 */

import { createAdminClient } from "./supabase/admin"

const TAG = "[call-reviewer-compress]"
const CORE_RULES_HEADER = "## CORE RULES FROM EXPERIENCE"
const LEARNED_HEADER = "LEARNED FROM CALL REVIEW"
const MAX_CORE_RULES_WORDS = 500

interface CallReviewRow {
  id: string
  metadata: Record<string, unknown>
  created_at: string
}

interface CompressionResult {
  success: boolean
  rulesGenerated: number
  reviewsCompressed: number
  error?: string
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Check if enough uncompressed reviews have accumulated to trigger compression.
 * Returns true when 10+ uncompressed reviews exist.
 */
export async function shouldCompress(): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from("zx_contact_interactions")
      .select("id", { count: "exact", head: true })
      .eq("channel", "voice")
      .filter("metadata->>type", "eq", "call_review")
      .not("metadata->>prompt_patch", "is", null)
      .or("metadata->>compressed.is.null,metadata->>compressed.eq.false")

    if (error) {
      console.error(TAG, "shouldCompress query error:", error.message)
      return false
    }

    console.log(TAG, `Uncompressed reviews: ${count ?? 0}`)
    return (count ?? 0) >= 10
  } catch (err) {
    console.error(TAG, "shouldCompress exception:", err)
    return false
  }
}

/**
 * Compress accumulated call review patches into permanent Core Rules.
 * Idempotent — safe to call multiple times. Marks reviews as compressed after success.
 */
export async function compressLearnings(): Promise<CompressionResult> {
  console.log(TAG, "Starting compression run...")

  // Step 1: Pull all uncompressed reviews with prompt patches
  const supabase = createAdminClient()

  const { data: reviews, error: fetchErr } = await supabase
    .from("zx_contact_interactions")
    .select("id, metadata, created_at")
    .eq("channel", "voice")
    .filter("metadata->>type", "eq", "call_review")
    .not("metadata->>prompt_patch", "is", null)
    .or("metadata->>compressed.is.null,metadata->>compressed.eq.false")
    .order("created_at", { ascending: true })

  if (fetchErr) {
    console.error(TAG, "Failed to fetch reviews:", fetchErr.message)
    return { success: false, rulesGenerated: 0, reviewsCompressed: 0, error: fetchErr.message }
  }

  const rows = (reviews ?? []) as CallReviewRow[]
  if (rows.length === 0) {
    console.log(TAG, "No uncompressed reviews found. Skipping.")
    return { success: true, rulesGenerated: 0, reviewsCompressed: 0 }
  }

  console.log(TAG, `Found ${rows.length} uncompressed reviews`)

  // Step 2: Fetch current Riley prompt from Retell
  const currentPrompt = await fetchRetellPrompt()
  if (currentPrompt === null) {
    return { success: false, rulesGenerated: 0, reviewsCompressed: 0, error: "Failed to fetch Retell prompt" }
  }

  // Extract existing section headers to avoid duplication
  const sectionHeaders = currentPrompt
    .split("\n")
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => line.replace(/^#+\s*/, "").trim())

  // Build patches list for the LLM
  const patchList = rows.map((row) => {
    const meta = row.metadata
    const date = row.created_at?.substring(0, 10) || "unknown"
    const patch = String(meta.prompt_patch || "")
    const severity = String(meta.severity || "")
    const callId = String(meta.call_id || "")
    return `[${date}] (${severity}, call: ${callId}) ${patch}`
  })

  // Step 3: Send to LLM for pattern compression
  const coreRules = await generateCoreRules(patchList, sectionHeaders)
  if (coreRules === null) {
    return { success: false, rulesGenerated: 0, reviewsCompressed: 0, error: "LLM compression failed" }
  }

  const ruleCount = (coreRules.match(/^\d+\./gm) || []).length
  console.log(TAG, `LLM generated ${ruleCount} core rules`)

  // Step 4-5: Inject core rules into the prompt and update Retell
  const updatedPrompt = injectCoreRules(currentPrompt, coreRules)
  const updateOk = await updateRetellPrompt(updatedPrompt)
  if (!updateOk) {
    return { success: false, rulesGenerated: ruleCount, reviewsCompressed: 0, error: "Failed to update Retell prompt" }
  }

  // Step 6: Mark all reviews as compressed
  const markedCount = await markReviewsCompressed(rows.map((r) => r.id))
  console.log(TAG, `Compression complete: ${ruleCount} rules from ${markedCount}/${rows.length} reviews`)

  return { success: true, rulesGenerated: ruleCount, reviewsCompressed: markedCount }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function fetchRetellPrompt(): Promise<string | null> {
  const retellKey = process.env.RETELL_API_KEY
  const llmId = process.env.RETELL_PREME_LLM_ID
  if (!retellKey || !llmId) {
    console.error(TAG, "Missing RETELL_API_KEY or RETELL_PREME_LLM_ID")
    return null
  }

  try {
    const res = await fetch(`https://api.retellai.com/get-retell-llm/${llmId}`, {
      headers: { Authorization: `Bearer ${retellKey}` },
    })
    if (!res.ok) {
      console.error(TAG, "Retell GET failed:", res.status)
      return null
    }
    const data = await res.json()
    return data.general_prompt || ""
  } catch (err) {
    console.error(TAG, "Retell GET exception:", err)
    return null
  }
}

async function updateRetellPrompt(prompt: string): Promise<boolean> {
  const retellKey = process.env.RETELL_API_KEY
  const llmId = process.env.RETELL_PREME_LLM_ID
  if (!retellKey || !llmId) return false

  try {
    const res = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retellKey}`,
      },
      body: JSON.stringify({ general_prompt: prompt }),
    })
    if (!res.ok) {
      console.error(TAG, "Retell PATCH failed:", res.status, await res.text().catch(() => ""))
      return false
    }
    console.log(TAG, "Retell prompt updated successfully")
    return true
  } catch (err) {
    console.error(TAG, "Retell PATCH exception:", err)
    return false
  }
}

/**
 * Send patches to LLM for pattern detection and rule generation.
 * Tries Claude Sonnet first, falls back to GPT-4o-mini.
 */
async function generateCoreRules(
  patches: string[],
  existingSectionHeaders: string[]
): Promise<string | null> {
  const systemPrompt = `You are analyzing prompt patches from voice AI call reviews. Each patch was a tactical fix applied after a specific call. Your job is to find PATTERNS — things that keep coming up across multiple calls — and compress them into permanent rules.

Input: A list of prompt patches with their dates.

Rules:
- Only create a Core Rule if the same theme appears 3+ times across different calls
- Each Core Rule should be 1-2 sentences max — concise and actionable
- Do NOT duplicate rules that already exist in the current prompt (I'll provide the current prompt)
- Max 15 Core Rules total — if you'd exceed 15, merge related rules
- Output format: numbered list of rules, nothing else

Current prompt sections to NOT duplicate: ${existingSectionHeaders.join(", ")}`

  const userMessage = `Here are ${patches.length} prompt patches from call reviews:\n\n${patches.join("\n\n")}`

  // Try Anthropic (Sonnet) first
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
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text || ""
        if (text.trim()) {
          console.log(TAG, "Core rules generated via Claude Sonnet")
          return enforceWordLimit(text.trim(), MAX_CORE_RULES_WORDS)
        }
      }
      console.error(TAG, "Anthropic response not ok:", res.status)
    } catch (err) {
      console.error(TAG, "Anthropic error:", err)
    }
  }

  // Fallback to OpenAI (GPT-4o-mini)
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
          model: "gpt-4o-mini",
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || ""
        if (text.trim()) {
          console.log(TAG, "Core rules generated via GPT-4o-mini")
          return enforceWordLimit(text.trim(), MAX_CORE_RULES_WORDS)
        }
      }
      console.error(TAG, "OpenAI response not ok:", res.status)
    } catch (err) {
      console.error(TAG, "OpenAI error:", err)
    }
  }

  console.error(TAG, "No LLM available for compression")
  return null
}

/**
 * Inject the CORE RULES FROM EXPERIENCE section into the prompt.
 * Placement: after the main prompt body, before any LEARNED FROM CALL REVIEW sections.
 */
function injectCoreRules(prompt: string, rules: string): string {
  const coreRulesBlock = `${CORE_RULES_HEADER}\n${rules}`

  // Check if CORE RULES section already exists — replace it
  const coreStart = prompt.indexOf(CORE_RULES_HEADER)
  if (coreStart !== -1) {
    // Find where CORE RULES section ends (next ## header, or LEARNED section, or EOF)
    const afterHeader = coreStart + CORE_RULES_HEADER.length
    let coreEnd = prompt.length

    // Look for next section boundary after the core rules header
    const nextSectionRegex = /\n(?=## |==============================)/g
    nextSectionRegex.lastIndex = afterHeader
    const match = nextSectionRegex.exec(prompt)
    if (match) {
      coreEnd = match.index
    }

    return prompt.substring(0, coreStart) + coreRulesBlock + prompt.substring(coreEnd)
  }

  // No existing CORE RULES section — insert before LEARNED sections or at end
  const learnedIdx = prompt.indexOf("==============================\n" + LEARNED_HEADER)
  if (learnedIdx !== -1) {
    const before = prompt.substring(0, learnedIdx).replace(/\n+$/, "")
    const after = prompt.substring(learnedIdx)
    return before + "\n\n" + coreRulesBlock + "\n\n" + after
  }

  // No LEARNED sections either — append to end
  return prompt.replace(/\n+$/, "") + "\n\n" + coreRulesBlock
}

/**
 * Mark review rows as compressed so they aren't reprocessed.
 */
async function markReviewsCompressed(ids: string[]): Promise<number> {
  const supabase = createAdminClient()
  let marked = 0

  // Batch in groups of 50 to avoid oversized queries
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)

    // Fetch current metadata for each row, then update with compressed flag
    const { data: rows, error: fetchErr } = await supabase
      .from("zx_contact_interactions")
      .select("id, metadata")
      .in("id", batch)

    if (fetchErr || !rows) {
      console.error(TAG, "Failed to fetch batch for marking:", fetchErr?.message)
      continue
    }

    for (const row of rows) {
      const meta = (row.metadata as Record<string, unknown>) || {}
      const { error: updateErr } = await supabase
        .from("zx_contact_interactions")
        .update({ metadata: { ...meta, compressed: true } })
        .eq("id", row.id)

      if (updateErr) {
        console.error(TAG, `Failed to mark ${row.id} compressed:`, updateErr.message)
      } else {
        marked++
      }
    }
  }

  return marked
}

/**
 * Truncate text to a maximum word count, preserving complete rules.
 */
function enforceWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text

  // Find the last complete numbered rule within the word limit
  const truncated = words.slice(0, maxWords).join(" ")
  const lastRuleEnd = truncated.lastIndexOf("\n")
  if (lastRuleEnd > 0) {
    return truncated.substring(0, lastRuleEnd).trim()
  }
  return truncated.trim()
}
