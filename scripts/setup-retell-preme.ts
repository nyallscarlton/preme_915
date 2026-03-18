/**
 * Retell AI Setup Script — Preme Home Loans (Riley / Lead Qualifier)
 *
 * Creates LLM, Agent, and provisions phone number via Retell API.
 * Riley qualifies mortgage leads (DSCR, Fix & Flip, Bridge, Commercial),
 * checks application status, reads conditions, and creates leads with
 * SMS apply links.
 *
 * Usage:
 *   RETELL_API_KEY=key_xxx npx tsx scripts/setup-retell-preme.ts
 *
 * Or set RETELL_API_KEY in .env.local first, then:
 *   npx tsx scripts/setup-retell-preme.ts
 */

import Retell from "retell-sdk"
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
if (!RETELL_API_KEY) {
  console.error("RETELL_API_KEY is required. Set it in .env.local or pass as env var.")
  process.exit(1)
}

const retell = new Retell({ apiKey: RETELL_API_KEY })

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const AGENT_NAME = "Preme Home Loans - Riley"
const BASE_URL = "https://premerealestate.com"
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/retell`
const INBOUND_CONTEXT_URL = `${BASE_URL}/api/webhooks/retell/inbound-context`
const CHECK_STATUS_URL = `${BASE_URL}/api/tools/check-application-status`
const READ_CONDITIONS_URL = `${BASE_URL}/api/tools/read-conditions`
const CREATE_LEAD_URL = `${BASE_URL}/api/tools/create-lead-and-text`
const AREA_CODE = 713

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Riley, a friendly and knowledgeable loan specialist at Preme Home Loans. You help real estate investors and borrowers navigate mortgage lending — specifically DSCR loans, fix & flip financing, bridge loans, and commercial lending.

COMPANY INFO:
- Company: Preme Home Loans
- Website: premerealestate.com
- Service: Mortgage lending for real estate investors
- Specialties: DSCR, Fix & Flip, Bridge, Business Credit, Commercial
- Speed: Close in as little as 7-14 days on most programs

==============================
CALLER CONTEXT
==============================
The caller is {{first_name}} {{last_name}}.
Lead context: {{lead_context}}
Loan type interest: {{loan_type}}
Property: {{property_address}}
Application status: {{application_status}}
Prior interactions: {{conversation_history}}

==============================
CALL OBJECTIVES
==============================
Based on the caller's context, adapt your approach:

IF lead_context is "inbound" or "callback":
→ New lead or returning caller. Qualify them using the qualification framework below.

IF lead_context is "existing_applicant":
→ They have an active application. Proactively check their status and conditions.
  Use check_application_status tool, then ask if they have questions.
  If they ask about conditions, use read_conditions tool.

IF lead_context is "incomplete_application":
→ They started but didn't finish. Gently encourage them to complete it.
  Offer to create a fresh link: use create_lead_and_text tool.

==============================
QUALIFICATION FRAMEWORK
==============================
For new leads, gather these naturally (NOT as a checklist):

1. PROPERTY TYPE — Single family, multi-family, commercial, mixed-use?
2. PROPERTY VALUE — Approximate purchase price or current value
3. TIMELINE — How soon do they want to close? Under contract already?
4. ENTITY — Do they have an LLC or buying in personal name?
5. CREDIT SCORE — Range is fine (600s, 700s, 800s). Never ask for exact number.
6. EXPERIENCE — First deal or experienced investor? How many properties?

Hot lead = has a deal, 650+ credit, timeline under 60 days
Warm lead = interested, some details known, may need follow-up
Cold lead = not ready, just exploring, or not a fit

==============================
LOAN PROGRAM KNOWLEDGE
==============================
Know these cold — speak confidently about each:

DSCR (Debt Service Coverage Ratio):
- Qualify using rental income, not personal income or tax returns
- No W-2s, no pay stubs, no DTI calculation
- Min DSCR typically 1.0-1.25 (property income covers the payment)
- Great for investors who show low income on taxes
- Close in 14-21 days typical
- Available for 1-4 unit, 5+ unit, and short-term rentals

FIX & FLIP:
- Short-term bridge loan based on ARV (After Repair Value)
- Up to 90% of purchase + 100% of rehab in many cases
- 12-18 month terms typical
- Interest-only payments
- Draw schedule for rehab funds
- Close in 7-14 days for competitive deals

BRIDGE LOANS:
- Fast asset-based financing
- Close in 7-14 days
- Use for: acquisitions needing speed, value-add plays, transitional properties
- Interest-only, short-term (6-24 months)

BUSINESS CREDIT:
- Entity-based lines of credit
- No personal guarantee options available
- Requires established LLC with EIN
- Revolving credit lines for acquisitions

COMMERCIAL:
- Multi-family (5+ units) and mixed-use financing
- DSCR-based qualification
- Longer terms available (5/1, 7/1, 10/1 ARM or 30-year fixed)

==============================
COMPLIANCE GUARDRAILS
==============================
NEVER:
- Quote specific interest rates. Say: "Rates depend on the deal — LTV, credit, property type all factor in. Our loan officer will walk you through actual numbers."
- Promise guaranteed approval.
- Discuss competitors' rates or programs.
- Provide legal, tax, or financial planning advice. Say: "That's a great question for your CPA/attorney."
- Make claims about speed that you can't back up. Use "as little as" language.
- Discuss internal pricing, margins, or wholesale relationships.

ALWAYS:
- If asked about rates: "Rates are deal-specific. Our LO will quote you exact numbers based on your scenario."
- If asked about approval odds: "Every deal is different. Based on what you've told me, it sounds like a strong scenario. Our underwriting team will give you a definitive answer."
- Disclose if asked: "I'm an AI assistant helping Preme Home Loans. Would you like to speak with a loan officer directly?"

==============================
TOOL USAGE
==============================
You have three tools available:

1. check_application_status — Use when caller asks about their application, or when lead_context is "existing_applicant". Pass their phone number.

2. read_conditions — Use when caller asks "what do you need from me?" or "what's outstanding?" Pass their phone number.

3. create_lead_and_text — Use when a NEW qualified lead wants to apply. Creates a draft application and texts them a link. Pass: first_name, last_name, phone, email (if given), loan_type, property_address, estimated_amount.

==============================
THE CLOSE
==============================
For qualified new leads:
"I'd love to get you connected with one of our senior loan officers who can run your exact numbers. Let me text you a quick application link — takes about 5 minutes — and our LO will review it and reach out within 24 hours with specific terms. Sound good?"
→ Use create_lead_and_text tool

For existing applicants:
"Is there anything else I can help you with on your application?"

For callbacks:
"Would you prefer our loan officer calls you back, or would you rather fill out a quick application online?"

==============================
VOICE & STYLE
==============================
- Short, natural sentences. This is a phone call, not an essay.
- Warm but professional. You're knowledgeable, not salesy.
- Mirror the caller's pace and energy.
- Use their first name naturally.
- Never interrupt. Let them finish.
- Verbal nods: "I hear you," "That makes sense," "Great question."
- If they're not interested, respect it: "No worries at all. If anything changes, we're here."
- Keep calls under 5 minutes unless the caller wants to keep talking.
- If they want a human: "Absolutely, let me have our loan officer reach out to you directly."

==============================
CALL WRAP-UP
==============================
Before ending every call:
1. Confirm next steps (application link sent, LO callback, etc.)
2. Confirm their preferred contact method
3. Thank them for their time
4. "We appreciate you considering Preme. Have a great day!"`

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log("Preme Home Loans Riley — Retell AI Setup\n")

  // Step 1: Check for existing agents
  console.log("Checking for existing agents...")
  const existingAgents = await retell.agent.list({ limit: 100 })
  const existing = existingAgents.find((a) => a.agent_name === AGENT_NAME)
  if (existing) {
    console.log(`Agent already exists: ${existing.agent_id}`)
    console.log("Delete it in the Retell dashboard to recreate, or update manually.")
    console.log(`\nRETELL_PREME_AGENT_ID=${existing.agent_id}`)
    return
  }

  // Step 2: Create LLM
  console.log("Creating LLM (Preme mortgage qualification prompt)...")
  const llm = await retell.llm.create({
    model: "gpt-4.1-mini",
    model_temperature: 0.7,
    start_speaker: "agent",
    begin_message:
      "Hey {{first_name}}, this is Riley from Preme Home Loans. I saw you were looking into {{loan_type}} — I wanted to quickly see how we can help. Got a minute?",
    general_prompt: SYSTEM_PROMPT,
    general_tools: [
      {
        type: "end_call" as const,
        name: "end_call",
        description:
          "End the call when the conversation is complete, the caller is not interested, or all questions are answered. Also end if the caller becomes hostile or requests to stop.",
      },
      {
        type: "custom" as const,
        name: "check_application_status",
        description:
          "Check the status of a caller's loan application. Use when the caller asks about their application, what stage it's in, or when lead_context is 'existing_applicant'. Returns current status, loan details, and last update date.",
        url: CHECK_STATUS_URL,
        speak_during_execution: true,
        speak_after_execution: true,
        execution_message_description:
          "Tell the caller: 'Let me pull up your application real quick.'",
        parameters: {
          type: "object" as const,
          properties: {
            phone: {
              type: "string" as const,
              description: "Caller's phone number",
            },
            application_number: {
              type: "string" as const,
              description: "Application number if the caller provides it (e.g., PREME-XXXXX)",
            },
          },
          required: ["phone"],
        },
      },
      {
        type: "custom" as const,
        name: "read_conditions",
        description:
          "Read outstanding loan conditions that need to be satisfied. Use when a borrower asks 'what do you need from me?', 'what's outstanding?', or 'what conditions are left?'. Returns a list of open conditions with priority and who needs to act.",
        url: READ_CONDITIONS_URL,
        speak_during_execution: true,
        speak_after_execution: true,
        execution_message_description:
          "Tell the caller: 'Let me check what conditions are still open on your file.'",
        parameters: {
          type: "object" as const,
          properties: {
            phone: {
              type: "string" as const,
              description: "Caller's phone number",
            },
            application_number: {
              type: "string" as const,
              description: "Application number if known",
            },
          },
          required: ["phone"],
        },
      },
      {
        type: "custom" as const,
        name: "create_lead_and_text",
        description:
          "Create a new lead record and text the caller an application link. Use when a NEW qualified caller wants to apply. This creates a draft application in the system and sends an SMS with a personalized link to complete the application online.",
        url: CREATE_LEAD_URL,
        speak_during_execution: true,
        speak_after_execution: true,
        execution_message_description:
          "Tell the caller: 'I'm sending you a quick application link right now.'",
        parameters: {
          type: "object" as const,
          properties: {
            first_name: {
              type: "string" as const,
              description: "Caller's first name",
            },
            last_name: {
              type: "string" as const,
              description: "Caller's last name",
            },
            phone: {
              type: "string" as const,
              description: "Caller's phone number (E.164 format)",
            },
            email: {
              type: "string" as const,
              description: "Caller's email if provided",
            },
            loan_type: {
              type: "string" as const,
              description: "Type of loan discussed (DSCR, Fix & Flip, Bridge, Commercial)",
            },
            property_address: {
              type: "string" as const,
              description: "Property address if discussed",
            },
            estimated_amount: {
              type: "string" as const,
              description: "Estimated loan amount or property value if discussed",
            },
          },
          required: ["first_name", "phone"],
        },
      },
    ],
  })

  console.log(`LLM created: ${llm.llm_id}\n`)

  // Step 3: Create Agent
  console.log("Creating agent...")
  const agent = await retell.agent.create({
    agent_name: AGENT_NAME,
    voice_id: "11labs-Myra",
    response_engine: {
      type: "retell-llm",
      llm_id: llm.llm_id,
    },
    voice_speed: 1.0,
    voice_temperature: 0.8,
    webhook_url: WEBHOOK_URL,
    webhook_events: ["call_started", "call_ended", "call_analyzed"],
    post_call_analysis_data: [
      {
        type: "enum" as const,
        name: "lead_temperature",
        description: "Overall interest and qualification level",
        choices: ["Hot", "Warm", "Cold"],
      },
      {
        type: "string" as const,
        name: "credit_score_range",
        description: "Credit score or range mentioned (e.g., '720-740', 'above 700')",
      },
      {
        type: "enum" as const,
        name: "property_type",
        description: "Type of property discussed",
        choices: ["Single Family", "Condo", "Townhouse", "Multi-Family", "Commercial", "Mixed-Use", "Unknown"],
      },
      {
        type: "string" as const,
        name: "property_address",
        description: "Property address if discussed",
      },
      {
        type: "enum" as const,
        name: "loan_type_confirmed",
        description: "Type of loan discussed",
        choices: ["DSCR", "Fix & Flip", "Bridge", "Business Credit", "Commercial", "Unknown"],
      },
      {
        type: "string" as const,
        name: "estimated_loan_amount",
        description: "Estimated loan amount or property value",
      },
      {
        type: "string" as const,
        name: "estimated_value",
        description: "Approximate property value or purchase price",
      },
      {
        type: "string" as const,
        name: "timeline",
        description: "When the caller wants to close (e.g., 'next 30 days', '3-6 months')",
      },
      {
        type: "boolean" as const,
        name: "has_entity",
        description: "Whether the caller has an LLC or business entity",
      },
      {
        type: "enum" as const,
        name: "experience_level",
        description: "Investment experience level",
        choices: ["First-time", "Some Experience", "Experienced"],
      },
      {
        type: "boolean" as const,
        name: "wants_callback",
        description: "Whether the caller requested a callback from a loan officer",
      },
      {
        type: "string" as const,
        name: "objections",
        description: "Any concerns or objections raised",
      },
      {
        type: "boolean" as const,
        name: "is_pre_approved",
        description: "Whether the caller mentioned having a pre-approval from another lender",
      },
      {
        type: "string" as const,
        name: "existing_application",
        description: "If the caller mentioned an existing application number or status",
      },
      {
        type: "string" as const,
        name: "caller_intent",
        description: "Primary reason for calling (new loan inquiry, status check, conditions question, general info)",
      },
      {
        type: "string" as const,
        name: "first_name",
        description: "Caller's first name",
      },
      {
        type: "string" as const,
        name: "last_name",
        description: "Caller's last name",
      },
      {
        type: "string" as const,
        name: "email",
        description: "Caller's email if provided",
      },
      {
        type: "number" as const,
        name: "score",
        description: "Lead quality score 1-100 based on qualification strength, timeline urgency, and deal readiness",
      },
    ],
    voicemail_option: "machine_detection" as any,
    voicemail_message:
      "Hey {{first_name}}, this is Riley from Preme Home Loans. We received your inquiry about {{loan_type}}. Give us a call back when you get a chance — we'd love to help. Have a great day!",
    max_call_duration_ms: 300000,
    end_call_after_silence_ms: 15000,
    responsiveness: 0.8,
    interruption_sensitivity: 0.7,
    boosted_keywords: [
      "Preme",
      "DSCR",
      "LTV",
      "ARV",
      "LLC",
      "fix and flip",
      "bridge loan",
      "pre-qualification",
      "pre-approval",
      "closing",
      "underwriting",
      "conditions",
      "appraisal",
      "Section 8",
      "multi-family",
    ],
  })

  console.log(`Agent created: ${agent.agent_id}\n`)

  // Step 4: Provision phone number
  console.log(`Provisioning phone number (area code ${AREA_CODE})...`)
  const phoneNumber = await retell.phoneNumber.create({
    country_code: "US",
    area_code: AREA_CODE,
    inbound_agent_id: agent.agent_id,
    outbound_agents: [{ agent_id: agent.agent_id, weight: 1 }],
    nickname: "Preme Home Loans Riley",
  })

  console.log(`Phone number: ${phoneNumber.phone_number}\n`)

  // Step 5: Set inbound webhook for dynamic context
  // Note: Inbound context webhook is set at the agent level in the Retell dashboard
  // under Agent Settings → Inbound → Dynamic Variables Webhook URL
  // Set it to: https://premerealestate.com/api/webhooks/retell/inbound-context

  // Step 6: Print env vars
  console.log("=".repeat(60))
  console.log("SETUP COMPLETE — Add these to .env.local and Vercel:\n")
  console.log(`RETELL_API_KEY=${RETELL_API_KEY}`)
  console.log(`RETELL_PREME_AGENT_ID=${agent.agent_id}`)
  console.log(`RETELL_PREME_LLM_ID=${llm.llm_id}`)
  console.log(`RETELL_PREME_PHONE_NUMBER=${phoneNumber.phone_number}`)
  console.log("")
  console.log("Agent Name:  " + AGENT_NAME)
  console.log("Agent ID:    " + agent.agent_id)
  console.log("LLM ID:      " + llm.llm_id)
  console.log("Phone:       " + phoneNumber.phone_number)
  console.log("Webhook:     " + WEBHOOK_URL)
  console.log("Voice:       11labs-Myra")
  console.log("Model:       gpt-4.1-mini")
  console.log("=".repeat(60))
  console.log("\nManual steps in Retell Dashboard:")
  console.log(`1. Go to Agent → ${AGENT_NAME} → Inbound Settings`)
  console.log(`2. Set Dynamic Variables Webhook URL to: ${INBOUND_CONTEXT_URL}`)
  console.log("3. Add env vars to .env.local and Vercel")
  console.log("4. Deploy the portal: vercel --prod")
  console.log("5. Test with a real call to the provisioned number")
}

main().catch((err) => {
  console.error("Setup failed:", err)
  process.exit(1)
})
