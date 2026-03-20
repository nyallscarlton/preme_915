/**
 * Preme Home Loans — Training API Endpoint
 *
 * POST /api/training — Trigger a training session against Riley
 * GET  /api/training — Get training scenario metadata
 *
 * This endpoint creates a Retell trainer agent, calls Riley, and returns
 * the call ID for tracking. The actual scoring happens via the existing
 * call_analyzed webhook → call-reviewer pipeline.
 *
 * Body (POST):
 *   { scenario_id?: string, difficulty?: string, count?: number }
 *
 * If no params, runs a single random scenario.
 */

import { NextRequest, NextResponse } from "next/server"
import Retell from "retell-sdk"
import {
  TRAINING_SCENARIOS,
  getScenarioById,
  getScenariosByDifficulty,
  getTrainingSet,
  type Difficulty,
  type TrainingScenario,
} from "@/lib/training-scenarios"

export const maxDuration = 120

const RILEY_PHONE_NUMBER = process.env.RETELL_PREME_PHONE_NUMBER || "+14709425787"
const TRAINER_AGENT_NAME = "Preme Training — Caller Bot"
const TRAINER_VOICE = "11labs-Adrian"

function getRetell(): Retell | null {
  if (!process.env.RETELL_API_KEY) return null
  return new Retell({ apiKey: process.env.RETELL_API_KEY })
}

// ---------------------------------------------------------------------------
// GET — Return available scenarios
// ---------------------------------------------------------------------------
export async function GET() {
  const scenarios = TRAINING_SCENARIOS.map((s) => ({
    id: s.id,
    name: s.name,
    difficulty: s.difficulty,
    summary: s.summary,
    focus_areas: s.focus_areas,
    min_passing_score: s.min_passing_score,
  }))

  return NextResponse.json({
    total: scenarios.length,
    scenarios,
    difficulties: ["easy", "medium", "hard", "edge_case"],
  })
}

// ---------------------------------------------------------------------------
// POST — Launch a training call
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const retell = getRetell()
  if (!retell) {
    return NextResponse.json({ error: "RETELL_API_KEY not configured" }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const { scenario_id, difficulty, count } = body as {
    scenario_id?: string
    difficulty?: string
    count?: number
  }

  // Select scenario(s)
  let scenarios: TrainingScenario[] = []

  if (scenario_id) {
    const s = getScenarioById(scenario_id)
    if (!s) {
      return NextResponse.json(
        { error: `Scenario not found: ${scenario_id}`, available: TRAINING_SCENARIOS.map((s) => s.id) },
        { status: 400 }
      )
    }
    scenarios = [s]
  } else if (difficulty) {
    scenarios = getScenariosByDifficulty(difficulty as Difficulty)
    if (scenarios.length === 0) {
      return NextResponse.json({ error: `No scenarios for difficulty: ${difficulty}` }, { status: 400 })
    }
  } else if (count) {
    scenarios = getTrainingSet(count)
  } else {
    // Default: one random scenario
    scenarios = getTrainingSet(1)
  }

  // For the API, we only launch the FIRST scenario (to keep request within timeout).
  // For batch training, use the CLI script.
  const scenario = scenarios[0]

  try {
    // Upsert trainer agent
    const trainerAgentId = await upsertTrainerAgent(retell, scenario)
    const trainerPhone = await ensureTrainerPhone(retell, trainerAgentId)

    // Launch the call
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
        first_name: scenario.name.split(" — ")[0]?.split(" ").pop() || "Caller",
        last_name: "",
        lead_context: "inbound",
        loan_type: "",
        property_address: "",
        application_status: "",
        conversation_history: "No prior interactions.",
      },
    })

    return NextResponse.json({
      ok: true,
      call_id: call.call_id,
      scenario: {
        id: scenario.id,
        name: scenario.name,
        difficulty: scenario.difficulty,
        min_passing_score: scenario.min_passing_score,
        focus_areas: scenario.focus_areas,
      },
      message: `Training call started. Riley will be called by "${scenario.name}" persona. Review will be auto-generated via the call_analyzed webhook.`,
      remaining_scenarios: scenarios.length > 1 ? scenarios.slice(1).map((s) => s.id) : [],
    })
  } catch (err: any) {
    console.error("[training] Failed to launch training call:", err)
    return NextResponse.json(
      { error: err?.message || "Failed to launch training call" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// HELPERS (shared with CLI but inlined here to avoid import issues in Edge)
// ---------------------------------------------------------------------------

async function upsertTrainerAgent(retell: Retell, scenario: TrainingScenario): Promise<string> {
  const prompt = buildTrainerPrompt(scenario)
  const agents = await retell.agent.list({ limit: 100 })
  const existing = agents.find((a) => a.agent_name === TRAINER_AGENT_NAME)

  if (existing) {
    const agentDetails = existing as any
    const llmId = agentDetails.response_engine?.llm_id
    if (llmId) {
      await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        },
        body: JSON.stringify({
          general_prompt: prompt,
          begin_message: getBeginMessage(scenario),
        }),
      })
    }
    return existing.agent_id
  }

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
        description: "End the call when the conversation is done or has gone on too long.",
      },
    ],
  })

  const agent = await retell.agent.create({
    agent_name: TRAINER_AGENT_NAME,
    voice_id: TRAINER_VOICE,
    response_engine: { type: "retell-llm", llm_id: llm.llm_id },
    voice_speed: 1.0,
    voice_temperature: 0.9,
    max_call_duration_ms: 300_000,
    end_call_after_silence_ms: 12_000,
    responsiveness: 0.7,
    interruption_sensitivity: 0.6,
  })

  return agent.agent_id
}

async function ensureTrainerPhone(retell: Retell, trainerAgentId: string): Promise<string> {
  const numbers = await retell.phoneNumber.list()
  const trainerNumber = numbers.find(
    (n) =>
      (n as any).outbound_agents?.some((a: any) => a.agent_id === trainerAgentId) ||
      (n as any).nickname === "Training Caller Bot"
  )
  if (trainerNumber) return trainerNumber.phone_number

  const phone = await retell.phoneNumber.create({
    country_code: "US",
    area_code: 470,
    outbound_agents: [{ agent_id: trainerAgentId, weight: 1 }],
    nickname: "Training Caller Bot",
  })
  return phone.phone_number
}

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
- When you're ready to end the call, say something natural like "Alright, sounds good. I'll check that out. Thanks!"
- NEVER reveal that you are a training bot, AI, or test caller.`
}

function getBeginMessage(scenario: TrainingScenario): string {
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
