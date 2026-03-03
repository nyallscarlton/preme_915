# Retell AI Voice Agent Setup — Preme Home Loans

## Overview

When a lead submits the get-started form with a phone number:
1. Lead saved to Supabase `leads` table
2. Mission Control notified
3. Retell AI automatically calls the lead (Riley) to qualify them
4. After the call, Retell sends analysis data back via webhook
5. Lead status updated to `qualified` or `contacted` based on call outcome

## Step 1: Create a Retell Account

Go to https://dashboard.retellai.com and sign up.

## Step 2: Create the LLM (System Prompt)

In the Retell dashboard → LLMs → Create New LLM:

**Model:** GPT-4.1 (or GPT-4.1 Mini for cost savings)

**Start Speaker:** Agent

**Begin Message:**
```
Hey {{first_name}}, this is Riley from Preme Home Loans. I saw you were looking into a {{loan_type}} — I wanted to quickly see how we can help. Got a minute?
```

**General Prompt (System Instructions):**
```
You are Riley, a friendly and knowledgeable loan specialist at Preme Home Loans. You're calling {{first_name}} {{last_name}} who submitted a lead form expressing interest in a {{loan_type}}.

Your goal is to QUALIFY this lead by gathering:
1. Property type (single family, multi-family, commercial)
2. Approximate property value or purchase price
3. Their timeline (how soon they want to close)
4. Whether they have an entity (LLC) or are buying in personal name
5. Credit score range (600s, 700s, 800s — don't ask for exact number)
6. Investment experience (first deal or experienced investor)

Rules:
- Be warm, conversational, and confident. Not salesy.
- Use short sentences. This is a phone call, not an essay.
- If they're not interested, respect that and end politely.
- If they ARE qualified (has a deal, 650+ credit, timeline under 60 days), say you'll have a senior loan officer reach out with specific terms within 24 hours.
- If they need more time, offer to schedule a callback.
- Never make promises about specific rates or guaranteed approval.
- Keep the call under 3 minutes.

Loan knowledge:
- DSCR loans: qualify with rental income, not tax returns. No W-2s needed. 7-14 day close.
- Fix & flip: short-term bridge loans based on ARV. Fast close for competitive deals.
- Bridge loans: fast asset-based financing. Close in 7-14 days.
- Business credit: entity-based lines of credit. No personal guarantee options available.
- Commercial: multi-family and mixed-use financing.

If they ask about rates, say "Rates depend on the specific deal — property type, LTV, credit score all factor in. That's exactly what our loan officer will walk you through with actual numbers."
```

**Default Dynamic Variables:**
```
first_name = "there"
last_name = ""
loan_type = "real estate financing"
```

**Tools:** Add an "End Call" tool so the agent can hang up when done.

Copy the **LLM ID** after saving.

## Step 3: Create the Agent

In the Retell dashboard → Agents → Create New Agent:

**Agent Name:** `Preme Lead Qualifier`

**Response Engine:** Retell LLM → select the LLM you just created

**Voice:** Pick a warm, natural male voice. Recommended:
- ElevenLabs voices (best quality): search for "Marcus", "Josh", or "Liam"
- Or clone a custom voice if you have audio samples

**Voice Settings:**
- Temperature: 0.8 (natural variation)
- Speed: 1.0
- Enable backchannel: Yes (adds "mm-hmm", "yeah" for natural feel)

**Webhook URL:** `https://premerealestate.com/api/webhooks/retell`

**Webhook Events:** `call_started`, `call_ended`, `call_analyzed`

**Post-Call Analysis Data:**
```
- credit_score_range (string): "Credit score or range mentioned (e.g., '720-740', 'above 700')"
- property_type (enum): "Property type" — choices: Single Family, Condo, Townhouse, Multi-Family, Investment Property, Unknown
- loan_type_confirmed (enum): "Type of loan discussed" — choices: DSCR, Fix & Flip, Bridge, Business Credit, Commercial, Unknown
- timeline (string): "When the lead wants to close (e.g., 'next 30 days', '3-6 months')"
- estimated_value (number): "Approximate property value or purchase price"
- has_entity (boolean): "Whether the lead has an LLC or business entity"
- experience_level (enum): "Investment experience" — choices: First-time, Some Experience, Experienced
- wants_callback (boolean): "Whether the lead requested a callback"
- objections (string): "Any concerns or objections raised"
- lead_temperature (enum): "Overall interest level" — choices: Hot, Warm, Cold
```

**Analysis Success Prompt:**
```
The call is successful if the lead provided qualifying information (credit score, property type, or timeline) OR agreed to a follow-up.
```

**Other Settings:**
- Max call duration: 300000 (5 minutes)
- End call after silence: 15000 (15 seconds)
- Enable voicemail detection: Yes
- Voicemail message: "Hey {{first_name}}, this is Riley from Preme Home Loans. We received your inquiry about a {{loan_type}}. Give us a call back when you get a chance — we'd love to help. Have a great day!"
- Responsiveness: 0.8
- Interruption sensitivity: 0.7
- Boosted keywords: DSCR, LTV, ARV, LLC, pre-qualification, Preme

Copy the **Agent ID** after saving.

## Step 4: Provision a Phone Number

In the Retell dashboard → Phone Numbers → Buy Number:
- Area code: 713 (Houston) or your preferred market
- Bind the outbound agent to your "Preme Lead Qualifier" agent

Copy the **Phone Number** (E.164 format, e.g., `+17135551234`).

## Step 5: Add Environment Variables

Add to `.env.local` (and Vercel for production):
```
RETELL_API_KEY=your-api-key-from-dashboard
RETELL_AGENT_ID=your-agent-id
RETELL_PHONE_NUMBER=+17135551234
```

## Step 6: Test

1. Submit the get-started form with your own phone number
2. You should receive a call from Riley within 30 seconds
3. Have a test conversation — try giving qualifying info
4. Check Supabase `leads` table:
   - `retell_call_id` should be populated
   - After call ends: `call_transcript`, `call_recording_url`
   - After analysis: `qualification_data`, `call_summary`, `status` updated

## Architecture

```
Lead submits /get-started form
        |
        v
  POST /api/leads
        |
   ┌────┼──────────────────┐
   v    v                  v
Supabase  MC webhook    Retell API
(insert)  (notify)      (outbound call)
                           |
                      Riley calls lead
                      (3 min qualification)
                           |
                  ┌────────┼────────┐
                  v        v        v
            call_started  call_ended  call_analyzed
                  |        |           |
                  v        v           v
            POST /api/webhooks/retell
                  |
         ┌────────┼────────┐
         v                 v
   Update lead        If qualified:
   (Supabase)         notify MC → LO assignment
```

## Costs

- Retell base: $0.07/min
- All-in with voice + LLM: ~$0.15-0.20/min
- Phone number: ~$2-5/month
- Per-lead call (3 min avg): ~$0.45-0.60
- 200 leads/month: ~$90-120/month
- Includes: SOC 2 + HIPAA compliance, recording, transcription, analysis

## TCPA Compliance

The get-started form includes consent language:
> "By submitting, you consent to receive calls and texts from PREME Home Loans at the number provided, including via automated technology."

Additional requirements:
- One-to-one consent rule (effective April 2026): each lead's consent applies only to Preme
- DNC list scrubbing before campaigns (handle in Supabase/CRM layer)
- No calls before 8am or after 9pm local time
- Some states require AI disclosure — Riley should acknowledge if asked
