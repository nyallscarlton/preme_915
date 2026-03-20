#!/usr/bin/env npx tsx
/**
 * Preme Home Loans — Riley Training Agent
 *
 * Automated voice AI trainer that calls Riley using Retell agent-to-agent calls.
 * For each training scenario, this script:
 *   1. Creates (or reuses) a temporary Retell "trainer agent" with the scenario persona
 *   2. Triggers an outbound phone call from the trainer to Riley's number
 *   3. Waits for the call to complete
 *   4. Pulls the call review score from the webhook (auto-fires via call_analyzed)
 *   5. Logs results and moves to the next scenario
 *   6. After all scenarios: prints a summary report
 *
 * Architecture: Two Retell agents talking to each other via the phone system.
 * The trainer agent handles its own STT/TTS — no custom audio piping needed.
 *
 * Usage:
 *   npx tsx scripts/training-agent.ts                     # Run all scenarios
 *   npx tsx scripts/training-agent.ts --count 5           # Run 5 random scenarios
 *   npx tsx scripts/training-agent.ts --scenario easy-warm-dscr  # Run one scenario
 *   npx tsx scripts/training-agent.ts --difficulty hard    # Run all hard scenarios
 *   npx tsx scripts/training-agent.ts --dry-run            # Show scenarios without calling
 *
 * Env (from .env.local):
 *   RETELL_API_KEY, OPENAI_API_KEY
 */

import Retell from "retell-sdk"
import { readFileSync } from "fs"
import { resolve } from "path"
import {
  TRAINING_SCENARIOS,
  getScenarioById,
  getScenariosByDifficulty,
  getTrainingSet,
  type TrainingScenario,
  type Difficulty,
} from "../lib/training-scenarios"

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
if (!RETELL_API_KEY) {
  console.error("RETELL_API_KEY is required. Set it in .env.local.")
  process.exit(1)
}

const retell = new Retell({ apiKey: RETELL_API_KEY })

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const RILEY_PHONE_NUMBER = process.env.RETELL_PREME_PHONE_NUMBER || "+14709425787"
const RILEY_AGENT_ID = process.env.RETELL_PREME_AGENT_ID || "agent_a6b1d2e882775997b0c4e286b2"
const TRAINER_AGENT_NAME = "Preme Training — Caller Bot"
const TRAINER_VOICE = "11labs-Adrian" // Male voice for variety against Riley's female voice
const CALL_POLL_INTERVAL_MS = 5_000
const MAX_CALL_WAIT_MS = 360_000 // 6 minutes max per call
const DELAY_BETWEEN_CALLS_MS = 10_000 // 10s cooldown between calls

// ---------------------------------------------------------------------------
// TRAINER SYSTEM PROMPT WRAPPER
// ---------------------------------------------------------------------------
function buildTrainerPrompt(scenario: TrainingScenario): string {
  return `${scenario.persona}

==============================
CALL GUIDELINES
==============================
- You are calling a mortgage lending company called Preme Home Loans.
- The person who answers is "Riley," their AI loan specialist.
- Stay in character the entire call. You are the CALLER, not the agent.
- Let Riley lead the conversation — respond to their questions naturally.
- Bring up your objections at natural points in the conversation, not all at once.
- If Riley asks you to fill out an application or sends you a link, agree and wind down the call.
- If the conversation stalls or Riley repeats herself, politely end the call.
- Keep the call between 2-5 minutes. Don't drag it out.
- When you're ready to end the call, say something natural like "Alright, sounds good. I'll check that out. Thanks!" or "Okay I gotta go, but I'll think about it."
- NEVER reveal that you are a training bot, AI, or test caller.`
}

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------
interface TrainingResult {
  scenario_id: string
  scenario_name: string
  difficulty: string
  call_id: string | null
  status: "completed" | "failed" | "timeout" | "skipped"
  duration_seconds: number
  review_score: number | null
  review_severity: string | null
  error: string | null
  timestamp: string
}

// ---------------------------------------------------------------------------
// TRAINER AGENT MANAGEMENT
// ---------------------------------------------------------------------------

/** Create or update the trainer agent with a new persona prompt. */
async function upsertTrainerAgent(scenario: TrainingScenario): Promise<string> {
  const prompt = buildTrainerPrompt(scenario)

  // Check if trainer agent already exists
  const agents = await retell.agent.list({ limit: 100 })
  const existing = agents.find((a) => a.agent_name === TRAINER_AGENT_NAME)

  if (existing) {
    // Update the existing agent's LLM prompt for this scenario
    const agentDetails = existing as any
    const llmId = agentDetails.response_engine?.llm_id

    if (llmId) {
      await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RETELL_API_KEY}`,
        },
        body: JSON.stringify({
          general_prompt: prompt,
          begin_message: getBeginMessage(scenario),
        }),
      })
      console.log(`  Updated trainer LLM ${llmId} with scenario: ${scenario.id}`)
    }
    return existing.agent_id
  }

  // Create new LLM for the trainer
  const llm = await retell.llm.create({
    model: "gpt-4.1-mini",
    model_temperature: 0.9,
    start_speaker: "agent",
    begin_message: getBeginMessage(scenario),
    general_prompt: prompt,
    general_tools: [
      {
        type: "end_call" as const,
        name: "end_call",
        description:
          "End the call when the conversation is done, you've gotten the info you need, or the call has gone on too long. Also end if there are awkward silences or repeated loops.",
      },
    ],
  })

  // Create the trainer agent
  const agent = await retell.agent.create({
    agent_name: TRAINER_AGENT_NAME,
    voice_id: TRAINER_VOICE,
    response_engine: {
      type: "retell-llm",
      llm_id: llm.llm_id,
    },
    voice_speed: 1.0,
    voice_temperature: 0.9,
    max_call_duration_ms: 300_000, // 5 min max
    end_call_after_silence_ms: 12_000,
    responsiveness: 0.7,
    interruption_sensitivity: 0.6,
  })

  console.log(`  Created trainer agent: ${agent.agent_id} (LLM: ${llm.llm_id})`)
  return agent.agent_id
}

/** Generate a natural opening line based on the scenario. */
function getBeginMessage(scenario: TrainingScenario): string {
  // Each scenario gets a slightly different opener for realism
  const openers: Record<string, string> = {
    "easy-warm-dscr": "Hey, yeah, I'm calling about mortgage loans? I heard y'all do DSCR loans.",
    "easy-flip-experienced": "Hi there. I'm looking for a fix and flip lender. Got a deal I need to move on fast.",
    "easy-callback-status": "Hi, uh, I applied for a loan a couple weeks ago and I haven't heard back. Can someone check on my application?",
    "easy-bridge-urgent": "Hi, I need help urgently. My lender just fell through and I'm supposed to close in a week. Do you guys do bridge loans?",
    "med-low-credit": "Yeah, hey. I'm looking into getting a loan for a rental property. I wanna be upfront though — my credit isn't the best.",
    "med-rate-shopper": "Hi, I'm shopping around for DSCR loan rates. I already have a pre-approval but I'm comparing lenders.",
    "med-confused-product": "Hey! I'm looking to buy my first home and I heard about DSCR loans. I think that's what I need.",
    "med-multiple-properties": "Hi. I'm an investor looking to buy three properties at once. Do you guys do portfolio deals?",
    "med-brrrr-strategy": "Hey, so I'm trying to do my first BRRRR deal and I need to understand how the financing works.",
    "hard-hostile-tire-kicker": "Yeah, I saw your ad. What kind of loans do y'all do?",
    "hard-owner-occ-trap": "Hi! I'm looking to buy an investment property. Can you tell me about your loan programs?",
    "hard-competitor-bash": "Hey, I just had the worst experience with another lender and I'm looking for someone better.",
    "hard-ai-detector": "Hey, quick question — who am I speaking with right now?",
    "hard-silence-minimal": "Yeah. Looking at investment loans.",
    "edge-out-of-state": "Hi, I'm calling from California. I'm looking at buying a rental property in Atlanta.",
    "edge-commercial-multifamily": "Hello, I'm interested in financing for a 12-unit apartment building.",
    "edge-business-credit": "Hi, I'm looking into business credit lines for real estate acquisitions. No personal guarantee ideally.",
    "edge-spanish-speaker": "Hola — uh, hi. I want to ask about, um, loans for rental property? My English is okay but maybe slow.",
  }
  return openers[scenario.id] || "Hi, I'm calling about mortgage loans."
}

// ---------------------------------------------------------------------------
// CALL EXECUTION
// ---------------------------------------------------------------------------

/** Provision an outbound number for the trainer agent if none exists. */
async function ensureTrainerPhone(trainerAgentId: string): Promise<string> {
  // Check if trainer agent already has a phone number
  const numbers = await retell.phoneNumber.list()
  const trainerNumber = numbers.find(
    (n) =>
      (n as any).outbound_agents?.some((a: any) => a.agent_id === trainerAgentId) ||
      (n as any).nickname === "Training Caller Bot"
  )
  if (trainerNumber) {
    return trainerNumber.phone_number
  }

  // Provision a new number
  console.log("  Provisioning phone number for trainer agent...")
  const phone = await retell.phoneNumber.create({
    country_code: "US",
    area_code: 470, // Atlanta area
    outbound_agents: [{ agent_id: trainerAgentId, weight: 1 }],
    nickname: "Training Caller Bot",
  })
  console.log(`  Provisioned: ${phone.phone_number}`)
  return phone.phone_number
}

/** Make the trainer agent call Riley and wait for the call to complete. */
async function executeTrainingCall(
  trainerAgentId: string,
  trainerPhone: string,
  scenario: TrainingScenario
): Promise<{ call_id: string; duration_seconds: number } | { error: string }> {
  try {
    // Create the outbound call: trainer calls Riley's number
    const call = await retell.call.createPhoneCall({
      from_number: trainerPhone,
      to_number: RILEY_PHONE_NUMBER,
      override_agent_id: trainerAgentId,
      metadata: {
        training: "true",
        scenario_id: scenario.id,
        scenario_name: scenario.name,
      },
      retell_llm_dynamic_variables: {
        // Riley's dynamic vars — simulate an inbound lead context
        first_name: scenario.name.split(" — ")[0]?.split(" ").pop() || "Caller",
        last_name: "",
        lead_context: "inbound",
        loan_type: "",
        property_address: "",
        application_status: "",
        conversation_history: "No prior interactions.",
      },
    })

    console.log(`  Call started: ${call.call_id}`)

    // Poll until call completes
    const startTime = Date.now()
    while (Date.now() - startTime < MAX_CALL_WAIT_MS) {
      await sleep(CALL_POLL_INTERVAL_MS)

      try {
        const status = await retell.call.retrieve(call.call_id)
        const callStatus = (status as any).call_status || (status as any).status

        if (callStatus === "ended" || callStatus === "error") {
          const durationMs =
            status.end_timestamp && status.start_timestamp
              ? status.end_timestamp - status.start_timestamp
              : 0
          return {
            call_id: call.call_id,
            duration_seconds: Math.round(durationMs / 1000),
          }
        }
      } catch {
        // Retrieval can fail mid-call — keep polling
      }
    }

    return { error: `Call timed out after ${MAX_CALL_WAIT_MS / 1000}s` }
  } catch (err: any) {
    return { error: err?.message || String(err) }
  }
}

/** Pull the review score for a completed training call. */
async function getCallReviewScore(callId: string): Promise<{
  score: number | null
  severity: string | null
  top_fixes: string[]
}> {
  // Wait a bit for the webhook + review pipeline to complete
  await sleep(15_000)

  try {
    const call = await retell.call.retrieve(callId)
    const analysis = (call.call_analysis as any)?.custom_analysis_data || {}
    return {
      score: analysis.score ? parseInt(analysis.score) : null,
      severity: null, // Severity comes from the call-reviewer, not Retell analysis
      top_fixes: [],
    }
  } catch {
    return { score: null, severity: null, top_fixes: [] }
  }
}

// ---------------------------------------------------------------------------
// MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")

  // Parse scenario selection
  let scenarios: TrainingScenario[] = []

  const scenarioIdx = args.indexOf("--scenario")
  const difficultyIdx = args.indexOf("--difficulty")
  const countIdx = args.indexOf("--count")

  if (scenarioIdx !== -1 && args[scenarioIdx + 1]) {
    const s = getScenarioById(args[scenarioIdx + 1])
    if (!s) {
      console.error(`Scenario not found: ${args[scenarioIdx + 1]}`)
      console.error("Available:", TRAINING_SCENARIOS.map((s) => s.id).join(", "))
      process.exit(1)
    }
    scenarios = [s]
  } else if (difficultyIdx !== -1 && args[difficultyIdx + 1]) {
    const d = args[difficultyIdx + 1] as Difficulty
    scenarios = getScenariosByDifficulty(d)
    if (scenarios.length === 0) {
      console.error(`No scenarios for difficulty: ${d}`)
      process.exit(1)
    }
  } else if (countIdx !== -1 && args[countIdx + 1]) {
    const count = parseInt(args[countIdx + 1])
    scenarios = getTrainingSet(count)
  } else {
    scenarios = [...TRAINING_SCENARIOS]
  }

  console.log("=".repeat(70))
  console.log("PREME HOME LOANS — RILEY TRAINING SESSION")
  console.log("=".repeat(70))
  console.log(`Scenarios: ${scenarios.length}`)
  console.log(`Riley Agent: ${RILEY_AGENT_ID}`)
  console.log(`Riley Phone: ${RILEY_PHONE_NUMBER}`)
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE CALLS"}`)
  console.log("")

  // List scenarios
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]
    console.log(`  ${i + 1}. [${s.difficulty.toUpperCase()}] ${s.name} — ${s.summary}`)
  }
  console.log("")

  if (dryRun) {
    console.log("Dry run — no calls will be made.")
    for (const s of scenarios) {
      console.log(`\n--- ${s.id} ---`)
      console.log(`Persona prompt preview:\n${buildTrainerPrompt(s).substring(0, 300)}...\n`)
      console.log(`Success criteria: ${s.success_criteria.join("; ")}`)
      console.log(`Focus areas: ${s.focus_areas.join(", ")}`)
      console.log(`Min passing score: ${s.min_passing_score}/110`)
    }
    return
  }

  // Setup trainer agent
  console.log("Setting up trainer agent...")
  const trainerAgentId = await upsertTrainerAgent(scenarios[0])
  const trainerPhone = await ensureTrainerPhone(trainerAgentId)
  console.log(`Trainer agent: ${trainerAgentId}`)
  console.log(`Trainer phone: ${trainerPhone}`)
  console.log("")

  // Execute training calls
  const results: TrainingResult[] = []
  const sessionStart = Date.now()

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]
    console.log(`\n${"─".repeat(70)}`)
    console.log(`SCENARIO ${i + 1}/${scenarios.length}: ${scenario.name}`)
    console.log(`Difficulty: ${scenario.difficulty} | Min Score: ${scenario.min_passing_score}/110`)
    console.log("─".repeat(70))

    // Update trainer agent prompt for this scenario
    if (i > 0) {
      await upsertTrainerAgent(scenario)
      // Cooldown between calls
      console.log(`  Waiting ${DELAY_BETWEEN_CALLS_MS / 1000}s between calls...`)
      await sleep(DELAY_BETWEEN_CALLS_MS)
    }

    // Execute the call
    console.log(`  Calling Riley at ${RILEY_PHONE_NUMBER}...`)
    const callResult = await executeTrainingCall(trainerAgentId, trainerPhone, scenario)

    if ("error" in callResult) {
      console.error(`  FAILED: ${callResult.error}`)
      results.push({
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        difficulty: scenario.difficulty,
        call_id: null,
        status: "failed",
        duration_seconds: 0,
        review_score: null,
        review_severity: null,
        error: callResult.error,
        timestamp: new Date().toISOString(),
      })
      continue
    }

    console.log(`  Call completed: ${callResult.call_id} (${callResult.duration_seconds}s)`)

    // Get review score (from auto sales coach webhook)
    console.log(`  Waiting for review pipeline...`)
    const review = await getCallReviewScore(callResult.call_id)

    const passed = review.score !== null && review.score >= scenario.min_passing_score
    const statusEmoji = passed ? "PASS" : review.score !== null ? "FAIL" : "PENDING"

    console.log(
      `  Result: ${statusEmoji} | Score: ${review.score ?? "pending"}/110 | Min: ${scenario.min_passing_score}/110`
    )

    results.push({
      scenario_id: scenario.id,
      scenario_name: scenario.name,
      difficulty: scenario.difficulty,
      call_id: callResult.call_id,
      status: "completed",
      duration_seconds: callResult.duration_seconds,
      review_score: review.score,
      review_severity: review.severity,
      error: null,
      timestamp: new Date().toISOString(),
    })
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  const sessionDuration = Math.round((Date.now() - sessionStart) / 1000)
  const completed = results.filter((r) => r.status === "completed")
  const scored = completed.filter((r) => r.review_score !== null)
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, r) => sum + (r.review_score || 0), 0) / scored.length)
      : null
  const passed = scored.filter(
    (r) =>
      r.review_score !== null &&
      r.review_score >= (getScenarioById(r.scenario_id)?.min_passing_score ?? 70)
  )
  const failed = results.filter((r) => r.status === "failed")

  console.log(`\n${"=".repeat(70)}`)
  console.log("TRAINING SESSION SUMMARY")
  console.log("=".repeat(70))
  console.log(`Duration:    ${Math.floor(sessionDuration / 60)}m ${sessionDuration % 60}s`)
  console.log(`Total:       ${results.length} scenarios`)
  console.log(`Completed:   ${completed.length}`)
  console.log(`Scored:      ${scored.length}`)
  console.log(`Passed:      ${passed.length}/${scored.length}`)
  console.log(`Failed:      ${failed.length} (call errors)`)
  console.log(`Avg Score:   ${avgScore ?? "N/A"}/110`)
  console.log("")

  // Per-scenario breakdown
  console.log("SCENARIO RESULTS:")
  console.log("─".repeat(70))
  for (const r of results) {
    const scenario = getScenarioById(r.scenario_id)
    const passThreshold = scenario?.min_passing_score ?? 70
    const mark =
      r.status === "failed"
        ? "ERR"
        : r.review_score === null
          ? "---"
          : r.review_score >= passThreshold
            ? "OK "
            : "LOW"

    console.log(
      `  [${mark}] ${r.scenario_name.padEnd(35)} ${String(r.review_score ?? "---").padStart(3)}/110  ${r.duration_seconds}s  ${r.call_id || r.error || ""}`
    )
  }

  // Weak areas
  if (scored.length > 0) {
    console.log("")
    console.log("AREAS TO IMPROVE:")
    const weakScenarios = scored
      .filter((r) => {
        const s = getScenarioById(r.scenario_id)
        return s && r.review_score !== null && r.review_score < s.min_passing_score
      })
      .sort((a, b) => (a.review_score || 0) - (b.review_score || 0))

    if (weakScenarios.length === 0) {
      console.log("  All scored scenarios passed their thresholds.")
    } else {
      for (const r of weakScenarios) {
        const s = getScenarioById(r.scenario_id)!
        console.log(
          `  - ${r.scenario_name}: ${r.review_score}/110 (need ${s.min_passing_score}). Focus: ${s.focus_areas.join(", ")}`
        )
      }
    }
  }

  console.log(`\n${"=".repeat(70)}`)
  console.log("Training session complete.")

  // Cleanup note
  console.log(`\nNote: Trainer agent "${TRAINER_AGENT_NAME}" and its phone number remain active.`)
  console.log("To clean up: delete the agent in the Retell dashboard or run with --cleanup flag.")
}

// ---------------------------------------------------------------------------
// CLEANUP
// ---------------------------------------------------------------------------
async function cleanup() {
  console.log("Cleaning up trainer agent and phone number...")
  const agents = await retell.agent.list({ limit: 100 })
  const trainer = agents.find((a) => a.agent_name === TRAINER_AGENT_NAME)
  if (!trainer) {
    console.log("No trainer agent found.")
    return
  }

  // Delete phone number first
  const numbers = await retell.phoneNumber.list()
  const trainerNumber = numbers.find((n) => (n as any).nickname === "Training Caller Bot")
  if (trainerNumber) {
    await retell.phoneNumber.delete(trainerNumber.phone_number)
    console.log(`Deleted phone: ${trainerNumber.phone_number}`)
  }

  // Delete agent
  await retell.agent.delete(trainer.agent_id)
  console.log(`Deleted agent: ${trainer.agent_id}`)

  // Delete LLM
  const agentDetails = trainer as any
  const llmId = agentDetails.response_engine?.llm_id
  if (llmId) {
    try {
      await fetch(`https://api.retellai.com/delete-retell-llm/${llmId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
      })
      console.log(`Deleted LLM: ${llmId}`)
    } catch {}
  }

  console.log("Cleanup complete.")
}

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)
if (args.includes("--cleanup")) {
  cleanup().catch((err) => {
    console.error("Cleanup failed:", err)
    process.exit(1)
  })
} else {
  main().catch((err) => {
    console.error("Training failed:", err)
    process.exit(1)
  })
}
