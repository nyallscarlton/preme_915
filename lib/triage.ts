import Anthropic from "@anthropic-ai/sdk"

// ── Types ────────────────────────────────────────────────────────────

export interface TriageInput {
  title: string
  description: string | null
  description_details: string | null
  category: string | null
  prior_to: string | null
  status: string
  sub_status: string | null
  condition_type: string | null
}

export interface TriageResult {
  action_owner:
    | "broker"
    | "title_company"
    | "lender_internal"
    | "insurance_agent"
    | "closing_auto"
    | "other"
  action_owner_name: string | null
  priority: "critical" | "high" | "normal" | "low"
  is_blocking: boolean
  action_summary: string
}

// ── Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a mortgage loan condition triage engine for a wholesale mortgage broker (Preme Home Loans). You classify underwriting conditions returned by wholesale lenders.

For each condition, return a JSON object with these fields:

1. action_owner — who needs to act:
   - "broker": Preme/broker needs to gather or create a document (LOEs, bank statements, executed forms, motivation letters, credit explanations)
   - "title_company": Title/closing agent needs to provide something (CPL, prelim CD, wire instructions, survey, title reports, fee sheets, closing docs)
   - "lender_internal": Pending lender review/approval (credit exceptions, QC review, UW clearance items, lock confirmations, appraisal reviews)
   - "insurance_agent": Insurance company needs to provide something (hazard dec page, policy info, proof of insurance)
   - "closing_auto": Standard closing condition that clears at the table or automatically at closing (final 1003 signed, funds for closing, max cash to close, PITIA verification, reserves, subordinate financing, executed closing docs, deadline conditions)
   - "other": Does not fit the above

2. action_owner_name — specific person/company if obvious from context, otherwise null

3. priority:
   - "critical": Blocking closing OR requires immediate action
   - "high": Requires action this week, affects timeline
   - "normal": Needs to be done but not urgent
   - "low": Informational or auto-clearing at closing

4. is_blocking — true when:
   - Could prevent closing (credit exceptions pending, title issues unresolved)
   - Description contains language like "loan cannot close until", "null and void", "must be completed prior to"
   - The condition is a credit exception or QC review that requires lender approval

5. action_summary — a plain English one-liner explaining what needs to happen. No legalese. Be specific. Examples:
   - "Write and sign an LOE explaining the address discrepancies"
   - "Chase title company for CPL, wire instructions, and E&O"
   - "Waiting on Logan to complete appraisal review"
   - "Clears at closing — borrower signs final 1003 at the table"
   - "Provide 2 months bank statements showing $2,000 EMD withdrawal"

Return ONLY a JSON array of objects matching the input order. No markdown, no explanation — just the raw JSON array.`

// ── Engine ───────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Batch conditions into a single prompt (cheaper & faster than per-condition)
export async function triageConditions(
  conditions: TriageInput[],
  closingDate?: string | null
): Promise<TriageResult[]> {
  if (conditions.length === 0) return []

  const closingContext = closingDate
    ? `The loan closing date is ${closingDate}. Today is ${new Date().toISOString().split("T")[0]}. Factor this into priority and is_blocking decisions.`
    : ""

  const userContent = `${closingContext}

Classify these ${conditions.length} conditions:

${JSON.stringify(
  conditions.map((c, i) => ({
    index: i,
    title: c.title,
    description: c.description,
    description_details: c.description_details,
    category: c.category,
    prior_to: c.prior_to,
    status: c.status,
    sub_status: c.sub_status,
    condition_type: c.condition_type,
  })),
  null,
  2
)}`

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  })

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : ""

  // Strip markdown code fences if present (```json ... ```)
  const raw = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

  try {
    const parsed = JSON.parse(raw)
    // Handle both [...] and {results: [...]} response shapes
    const results: TriageResult[] = Array.isArray(parsed)
      ? parsed
      : parsed.results ?? parsed.conditions ?? Object.values(parsed)[0]

    if (!Array.isArray(results) || results.length !== conditions.length) {
      console.error(
        `[triage] Expected ${conditions.length} results, got ${Array.isArray(results) ? results.length : "non-array"}`
      )
      return conditions.map(
        (_, i) =>
          results?.[i] ?? {
            action_owner: "other",
            action_owner_name: null,
            priority: "normal",
            is_blocking: false,
            action_summary: "Needs manual review",
          }
      )
    }

    return results
  } catch (e) {
    console.error("[triage] Failed to parse AI response:", e, raw)
    return conditions.map(() => ({
      action_owner: "other" as const,
      action_owner_name: null,
      priority: "normal" as const,
      is_blocking: false,
      action_summary: "Triage failed — needs manual review",
    }))
  }
}
