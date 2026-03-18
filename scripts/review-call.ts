#!/usr/bin/env npx tsx
/**
 * Preme Home Loans — Voice Agent Call Review & Sales Coach
 *
 * Pulls the latest (or specified) call from Retell, analyzes the transcript
 * against a sales coaching rubric, and outputs a scorecard with specific
 * coaching notes.
 *
 * Usage:
 *   npx tsx scripts/review-call.ts                    # Review latest call
 *   npx tsx scripts/review-call.ts call_abc123        # Review specific call
 *   npx tsx scripts/review-call.ts --last 3           # Review last 3 calls
 */

import Retell from "retell-sdk"
import OpenAI from "openai"
import { readFileSync } from "fs"
import { resolve } from "path"

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

const RETELL_API_KEY = process.env.RETELL_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const AGENT_ID = process.env.RETELL_PREME_AGENT_ID || "agent_a6b1d2e882775997b0c4e286b2"

if (!RETELL_API_KEY) { console.error("RETELL_API_KEY required"); process.exit(1) }
if (!OPENAI_API_KEY) { console.error("OPENAI_API_KEY required"); process.exit(1) }

const retell = new Retell({ apiKey: RETELL_API_KEY })
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

// ---------------------------------------------------------------------------
// SALES COACHING RUBRIC
// ---------------------------------------------------------------------------
const RUBRIC = `You are an elite sales coach specializing in mortgage lending phone calls. You're reviewing a call made by "Riley," an AI voice agent for Preme Home Loans (investor mortgage lending — DSCR, Fix & Flip, Bridge, Commercial).

Score each category 1-10 and provide specific coaching notes with exact quotes from the transcript.

## SCORING RUBRIC

### 1. OPENING (1-10)
- Did the agent identify themselves clearly?
- For INBOUND: Did the agent let the caller explain why they called, or did the agent assume?
- For OUTBOUND: Was the opener natural and non-salesy?
- Did the agent get the caller's NAME within the first 30 seconds?
- Was there any confusion or repeated introductions?
- RED FLAG: Template variables spoken literally (e.g., "{{first_name}}")

### 2. RAPPORT & WARMTH (1-10)
- Did the agent build any connection before jumping into questions?
- Did the agent use the caller's name naturally?
- Did the agent acknowledge/validate what the caller shared before asking the next question?
- Did the agent mirror the caller's energy and pace?
- Was the tone warm and conversational, or robotic and scripted?

### 3. NEEDS DISCOVERY (1-10)
- Did the agent uncover WHY the caller is looking for financing (not just what)?
- Did the agent ask open-ended questions that let the caller talk?
- Did the agent listen and follow up on what the caller said?
- Were questions woven into conversation or fired like a checklist?
- Did the agent detect owner-occupied vs. investor correctly?

### 4. QUALIFICATION DEPTH (1-10)
- Property type gathered?
- Property value/purchase price gathered?
- Timeline/urgency gathered?
- Entity (LLC vs personal) gathered?
- Credit score range gathered?
- Experience level gathered?
- Any critical missing info that should have been asked?

### 5. PROGRAM KNOWLEDGE (1-10)
- Did the agent demonstrate knowledge of loan programs?
- Did the agent match the right program to the caller's situation?
- Did the agent avoid pitching investor products to owner-occupants?
- Were compliance guardrails maintained (no rate quotes, no guarantees)?

### 6. CREDIT SCORE HANDLING (1-10)
- Was the credit score addressed appropriately?
- Did the agent set realistic expectations?
- Was the response encouraging without being dishonest?

### 7. OBJECTION HANDLING (1-10)
- Were any concerns or hesitations addressed?
- Did the agent acknowledge before responding?
- Score N/A if no objections arose.

### 8. THE CLOSE (1-10)
- Was the next step clear and specific?
- Did the agent use tools appropriately (create lead, check status)?
- Was the caller guided to a concrete action?
- Did the agent ask for preferred contact method?

### 9. CALL CONTROL & PACING (1-10)
- Did the agent maintain control without being pushy?
- Was the call length appropriate (not too rushed, not too long)?
- Were there awkward pauses, interruptions, or overlapping speech?
- Did the agent wrap up cleanly?

### 10. OVERALL EFFECTIVENESS (1-10)
- Would this call result in a funded loan?
- Did the caller leave with confidence in Preme?
- What's the single biggest thing that would improve the next call?

## OUTPUT FORMAT

For each category, output:
**[Category Name]: [Score]/10**
[2-3 sentences of specific coaching with exact quotes from transcript]

Then at the end:
**TOTAL: [sum]/100**

**TOP 3 FIXES (prioritized):**
1. [Most impactful fix]
2. [Second most impactful]
3. [Third most impactful]

**WHAT WENT WELL:**
[1-2 things the agent did right]

**PROMPT PATCH SUGGESTION:**
[If applicable, suggest specific wording changes to the agent's system prompt that would fix the top issues]`

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2)
  let callIds: string[] = []

  if (args[0] === "--last") {
    const count = parseInt(args[1] || "1")
    const calls = await retell.call.list({
      filter_criteria: { agent_id: [AGENT_ID] },
      sort_order: "descending",
      limit: count,
    })
    callIds = calls.map((c) => c.call_id)
  } else if (args[0] && args[0].startsWith("call_")) {
    callIds = [args[0]]
  } else {
    // Default: latest call
    const calls = await retell.call.list({
      filter_criteria: { agent_id: [AGENT_ID] },
      sort_order: "descending",
      limit: 1,
    })
    callIds = calls.map((c) => c.call_id)
  }

  if (callIds.length === 0) {
    console.log("No calls found.")
    return
  }

  for (const callId of callIds) {
    console.log(`\n${"=".repeat(70)}`)
    console.log(`CALL REVIEW: ${callId}`)
    console.log("=".repeat(70))

    const call = await retell.call.retrieve(callId)

    if (!call.transcript) {
      console.log("No transcript available for this call.")
      continue
    }

    const duration = call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : 0

    console.log(`Direction: ${call.direction}`)
    console.log(`From: ${call.from_number} → To: ${call.to_number}`)
    console.log(`Duration: ${duration}s`)
    console.log(`Disconnect: ${call.disconnection_reason}`)
    console.log(`Recording: ${call.recording_url || "N/A"}`)

    const analysis = call.call_analysis?.custom_analysis_data || {}
    console.log(`Post-call: temp=${analysis.lead_temperature}, score=${analysis.score}, loan=${analysis.loan_type_confirmed}`)
    console.log("")

    // Send to GPT-4.1 for coaching analysis
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: RUBRIC,
        },
        {
          role: "user",
          content: `CALL METADATA:\n- Direction: ${call.direction}\n- Duration: ${duration}s\n- Disconnect reason: ${call.disconnection_reason}\n- Post-call analysis: ${JSON.stringify(analysis, null, 2)}\n\nFULL TRANSCRIPT:\n${call.transcript}`,
        },
      ],
    })

    const review = completion.choices[0]?.message?.content || ""
    console.log(review)
    console.log("")
  }
}

main().catch((err) => {
  console.error("Review failed:", err)
  process.exit(1)
})
