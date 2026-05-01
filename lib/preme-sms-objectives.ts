/**
 * Canonical Preme SMS objective registry — source of truth for the 13 objectives
 * declared in Doc 02.13 §7 (AI Conversational SMS Architecture).
 *
 * An "objective" is the reason a send is happening. The Retell SMS agent reads the
 * objective + payload on every outbound chat and generates the actual message
 * aligned with the objective's tone guidance.
 *
 * Shape:
 *   - objective: discriminated-union string literal (one of 13)
 *   - payload: per-objective zod schema (runtime-validated)
 *   - promptSlice: fragment for the Retell agent's system prompt
 *   - renderFallback: deterministic baseline SMS; used until the Retell console
 *     prompt is updated to generate from objective + payload directly. Safe,
 *     compliant (STOP language always present), and short.
 *
 * Update protocol:
 *   1. Add the entry to OBJECTIVE_METADATA below.
 *   2. Add the payload schema to PAYLOAD_SCHEMAS.
 *   3. Add the render to FALLBACK_RENDERERS.
 *   4. Run `pnpm tsx scripts/smoke-test-objectives.ts` — all objectives must pass.
 *   5. Update Doc 02.13 §7 (bible hygiene).
 *   6. Regenerate agent console via docs/preme-sms-agent-console-update.md.
 */

import { z } from "zod"

export const OBJECTIVES = [
  "pre_qual_link_send",
  "pre_qual_link_resend",
  "follow_up_no_call_connect",
  "day1_evening_soft_check",
  "day2_value_recap",
  "day4_objection_handle",
  "day5_help_offer",
  "day6_urgency",
  "day7_final_release",
  "callback_confirmation",
  "post_submission_thanks",
  "custom_ad_hoc",
  "nurture_monthly",
  // Drip nudges (Doc 02.13 §7, added 2026-04-25)
  "pre_qual_open_nudge",
  "pre_qual_submit_nudge",
  "loan_app_open_nudge",
  "loan_app_submit_nudge",
  // 1003 manual send (Solomon-triggered, gated on pre_qual_approved tag — Doc 02.14 §4.5)
  "loan_app_send",
  // Stale lead re-engagement (tag: stale_lead — 30+ day cold leads)
  "stale_reintro",
  "stale_missed_call",
  "stale_disqualify",
  "stale_breakup",
] as const

export type Objective = (typeof OBJECTIVES)[number]

export const ObjectiveSchema = z.enum(OBJECTIVES)

// ---------------------------------------------------------------------------
// Per-objective payload schemas (zod)
// ---------------------------------------------------------------------------

const PreQualLinkSendPayload = z.object({
  pre_qual_url: z.string().url(),
  timeline_note: z.string().optional(),
})

// reason is kept — it tells Riley WHY she's reaching out (voicemail vs missed vs other).
// cta/tone removed as required fields — Riley generates her own language.
const FollowUpNoCallConnectPayload = z.object({
  reason: z.enum(["voicemail_first_attempt", "missed", "other"]).default("voicemail_first_attempt"),
})

// All cadence-step payloads below accept {} — Riley generates freely from objective + phase + timeline_notes.
const Day1EveningSoftCheckPayload = z.object({}).passthrough()

const Day2ValueRecapPayload = z.object({}).passthrough()

const Day4ObjectionHandlePayload = z.object({}).passthrough()

const Day5HelpOfferPayload = z.object({}).passthrough()

const Day6UrgencyPayload = z.object({}).passthrough()

const Day7FinalReleasePayload = z.object({}).passthrough()

const CallbackConfirmationPayload = z.object({
  callback_time_iso: z.string().optional(),
  call_from_number: z.string().optional(),
})

const PostSubmissionThanksPayload = z.object({
  next_step_owner: z.string().min(1).default("Solomon"),
  next_step_eta: z.string().min(1).default("within 24 hours"),
})

const CustomAdHocPayload = z.object({
  full_context: z.string().min(1),
  caller_intent: z.string().min(1),
})

const NurtureMonthlyPayload = z.object({
  days_since_last_activity: z.number().int().positive().optional(),
  original_reason_cold: z.string().optional(),
}).passthrough()

// pre_qual_link_resend — same shape as pre_qual_link_send (lead asked again or Riley is re-firing)
const PreQualLinkResendPayload = PreQualLinkSendPayload

// Drip nudges — free generation, Riley uses objective + phase + timeline_notes
const DripNudgeP1Payload = z.object({}).passthrough()
const DripNudgeP3Payload = z.object({}).passthrough()

// loan_app_send (Solomon-triggered, gated on pre_qual_approved tag — Doc 02.14 §4.5)
const LoanAppSendPayload = z.object({
  portal_1003_url: z.string().url(),
  phase: z.literal("P3").default("P3"),
})

// Stale lead re-engagement — all free generation, Riley uses objective + phase + timeline_notes
const StaleReintroPayload = z.object({}).passthrough()
const StaleMissedCallPayload = z.object({}).passthrough()
const StaleDisqualifyPayload = z.object({}).passthrough()
const StaleBreakupPayload = z.object({}).passthrough()

export const PAYLOAD_SCHEMAS: { [K in Objective]: z.ZodTypeAny } = {
  pre_qual_link_send: PreQualLinkSendPayload,
  pre_qual_link_resend: PreQualLinkResendPayload,
  follow_up_no_call_connect: FollowUpNoCallConnectPayload,
  day1_evening_soft_check: Day1EveningSoftCheckPayload,
  day2_value_recap: Day2ValueRecapPayload,
  day4_objection_handle: Day4ObjectionHandlePayload,
  day5_help_offer: Day5HelpOfferPayload,
  day6_urgency: Day6UrgencyPayload,
  day7_final_release: Day7FinalReleasePayload,
  callback_confirmation: CallbackConfirmationPayload,
  post_submission_thanks: PostSubmissionThanksPayload,
  custom_ad_hoc: CustomAdHocPayload,
  nurture_monthly: NurtureMonthlyPayload,
  pre_qual_open_nudge: DripNudgeP1Payload,
  pre_qual_submit_nudge: DripNudgeP1Payload,
  loan_app_open_nudge: DripNudgeP3Payload,
  loan_app_submit_nudge: DripNudgeP3Payload,
  loan_app_send: LoanAppSendPayload,
  stale_reintro: StaleReintroPayload,
  stale_missed_call: StaleMissedCallPayload,
  stale_disqualify: StaleDisqualifyPayload,
  stale_breakup: StaleBreakupPayload,
}

export type ObjectivePayload<T extends Objective> = z.infer<(typeof PAYLOAD_SCHEMAS)[T]>

// ---------------------------------------------------------------------------
// Metadata — human-facing; also drives the agent prompt slices and console doc
// ---------------------------------------------------------------------------

export interface ObjectiveMetadata {
  whenFires: string
  toneGuidance: string
  replyHandling: string
  payloadHints: string[]
}

export const OBJECTIVE_METADATA: { [K in Objective]: ObjectiveMetadata } = {
  pre_qual_link_send: {
    whenFires:
      "ONLY when (a) Riley verbally connects with the lead and invokes mid-call (via custom_ad_hoc or this objective directly), OR (b) the lead replies via SMS explicitly asking for the link. Does NOT fire automatically on Day 1 from VM fallback — that path uses follow_up_no_call_connect (no link).",
    toneGuidance:
      "Warm, brief, link is the focal point. Frame as 'as promised' or 'here it is' — never apologetic, never pushy. Single CTA = open the link.",
    replyHandling:
      "Confirmation of receipt ⇒ thank, don't resend. Form-field questions ⇒ route to custom_ad_hoc with the field topic in payload.",
    payloadHints: [
      "pre_qual_url (string, URL) — the link",
      "timeline_note (string, optional) — e.g., 'in the next 2 weeks'",
    ],
  },
  follow_up_no_call_connect: {
    whenFires:
      "Touch 2 of the cadence when Riley's first call hits voicemail / no-answer. Replaces the prior 'auto pre_qual_link_send on VM' path.",
    toneGuidance:
      "Warm, brief, single CTA = call or text back. Do NOT include a pre-qual link URL. Do NOT promise a link. Goal is to re-engage the conversation, not to deliver the form.",
    replyHandling:
      "Any reply re-engages cadence. Inbound 'send me the link' / 'yes please text it' ⇒ trigger pre_qual_link_send (lead-pulled path).",
    payloadHints: [
      "reason (enum voicemail_first_attempt | missed | other)",
      "cta (string) — one-line ask (used as a hint; renderer ignores any URL content)",
      "tone (enum warm | neutral, default warm)",
    ],
  },
  day1_evening_soft_check: {
    whenFires: "Cadence touch #4 — Day 1 evening, lead has not responded since Touch 2.",
    toneGuidance:
      "You missed Riley earlier. Goal of this SMS: get them back on the phone. Don't push the form. Tone: warm, casual, single-CTA (the call). NO link.",
    replyHandling:
      "A time ⇒ callback_confirmation. 'Send me the link' / 'yes' / 'ok' ⇒ pre_qual_link_send. STOP ⇒ opt out.",
    payloadHints: ["cta (string) — push-to-phone hint; renderer never includes a URL"],
  },
  day2_value_recap: {
    whenFires: "Cadence touch #6 — Day 2 afternoon, lead still hasn't connected with Riley.",
    toneGuidance:
      "Lead is on Day 2 still hasn't connected with Riley. Goal: lead values the conversation enough to take a call. Don't push the form. Tone: value-led, push to call. NO link.",
    replyHandling:
      "A time ⇒ callback_confirmation. 'Send me the link' / 'yes' / 'ok' ⇒ pre_qual_link_send. STOP ⇒ opt out.",
    payloadHints: [
      "one_line_value_hook (string) — value framing hint",
      "ask (string) — push-to-call ask; renderer never includes a URL",
    ],
  },
  day4_objection_handle: {
    whenFires:
      "Cadence touch #8 — Day 4 afternoon, lead has been silent ~3 days after Riley call attempts.",
    toneGuidance:
      "Empathetic objection probe + push to phone. Acceptable secondary: OFFER to text the pre-qual link if they prefer SMS over a call. Do NOT send the link unprompted — only offer it. Tone: empathetic, two-option close.",
    replyHandling:
      "Objection ⇒ reply in thread; route to custom_ad_hoc if substantive. 'Send me the link' ⇒ pre_qual_link_send. A time ⇒ callback_confirmation.",
    payloadHints: [
      "common_objections (string[]) — list to reference (hints only, renderer keeps message short)",
      "invite_reply (string)",
    ],
  },
  day5_help_offer: {
    whenFires:
      "Cadence touch #9 — Day 5, last attempt to schedule a call before P3 release.",
    toneGuidance:
      "Last attempt to schedule a call. If lead won't take a call, explicitly offer the SMS form path. Do NOT send the link in this message — only offer. Lead must reply asking for it before pre_qual_link_send fires. Tone: lead-driven, hand it over to them.",
    replyHandling:
      "'Send the link' / 'yes' / 'ok' ⇒ pre_qual_link_send. A time ⇒ callback_confirmation. Silence ⇒ cadence advances to P3.",
    payloadHints: [
      "offer_detail (string) — what specifically we'll help with (hint only, renderer never sends a URL)",
    ],
  },
  day6_urgency: {
    whenFires: "Cadence touch #11 — gentle scarcity (rate window, lender timing).",
    toneGuidance: "Light urgency, never fake. Real framing only.",
    replyHandling: "Any response ⇒ prioritize callback within 1 hour.",
    payloadHints: ["scarcity_framing (string) — the real reason timing matters"],
  },
  day7_final_release: {
    whenFires: "Cadence touch #13 — polite close, door left open.",
    toneGuidance: "Respectful, final, no ask.",
    replyHandling: "Any reply reopens active cadence; STOP hard-kills.",
    payloadHints: ["door_open_line (string) — closing hook"],
  },
  callback_confirmation: {
    whenFires: "After Riley or the SMS agent schedules a callback.",
    toneGuidance: "Factual, precise, confirmation-style.",
    replyHandling: "Reschedule requests ⇒ trigger calendar flow. STOP ⇒ opt out.",
    payloadHints: [
      "callback_time_iso (string, ISO datetime)",
      "call_from_number (string) — the number we'll call from",
    ],
  },
  post_submission_thanks: {
    whenFires: "Pre-qual form submitted by the lead.",
    toneGuidance: "Warm, brief, sets expectation for next owner.",
    replyHandling: "Questions about timing/next steps ⇒ handoff-ready reply.",
    payloadHints: [
      "next_step_owner (string, default 'Solomon')",
      "next_step_eta (string, default 'within 24 hours')",
    ],
  },
  custom_ad_hoc: {
    whenFires: "Mid-call or manual sends where no canonical objective applies.",
    toneGuidance: "Driven entirely by caller-provided context.",
    replyHandling: "Per caller-provided intent.",
    payloadHints: [
      "full_context (string) — what to say and why",
      "caller_intent (string) — one-line summary",
    ],
  },
  // Drip nudges (Doc 02.13 §7, Workflows 7+8 — added 2026-04-25)
  pre_qual_open_nudge: {
    whenFires:
      "Workflow 7 (Pre-Qual Drip) — pre_qual_state still link_sent 1h after Riley delivered the link.",
    toneGuidance:
      "Warm, gentle. Goal: confirm the link arrived. Single CTA = let me know if anything's off. NO pressure.",
    replyHandling:
      "'didn't get it' / 'resend' ⇒ trigger pre_qual_link_resend. Confirmation ⇒ no further nudge until 15-min open→submit leg fires.",
    payloadHints: ["phase (literal P1)"],
  },
  pre_qual_submit_nudge: {
    whenFires:
      "Workflow 7 (Pre-Qual Drip) — pre_qual_state = opened but not submitted after 15 min.",
    toneGuidance:
      "Helpful, low-pressure. Offer field-level help. Don't push the form, offer to unstick.",
    replyHandling:
      "Field question ⇒ route to custom_ad_hoc with the field topic. 'Almost done' ⇒ no further nudge.",
    payloadHints: ["phase (literal P1)"],
  },
  loan_app_open_nudge: {
    whenFires:
      "Workflow 8 (1003 Drip) — loan_app_state still link_sent 1h after Solomon sent the 1003.",
    toneGuidance:
      "Serious — formal application, not pre-qual. Confirm receipt. ~10 min to complete framing.",
    replyHandling:
      "'didn't get it' / 'resend' ⇒ escalate to Solomon (post-approval — lender match locked). Confirmation ⇒ no further nudge.",
    payloadHints: ["phase (literal P3)"],
  },
  loan_app_submit_nudge: {
    whenFires:
      "Workflow 8 (1003 Drip) — loan_app_state = opened but not submitted after 15 min.",
    toneGuidance:
      "Helpful, 'anything stuck?' Solomon-callable. Don't attempt 1003 field guidance via SMS.",
    replyHandling:
      "Field question ⇒ escalate to Solomon. Yes/scheduling ⇒ callback_confirmation.",
    payloadHints: ["phase (literal P3)"],
  },
  // 1003 manual send (Solomon-triggered, gated on pre_qual_approved tag — Doc 02.14 §4.5)
  loan_app_send: {
    whenFires:
      "Solomon clicks 'Send 1003' button in portal after reviewing a submitted pre-qual and applying tag pre_qual_approved. Mac Mini handler 4xx-rejects if tag is absent (gate enforcement).",
    toneGuidance:
      "Warm + handoff-flavored. Frame as 'next step'. Never 'approval' (1003 is the formal app).",
    replyHandling:
      "Confirmation ⇒ thank, don't resend. Field question ⇒ escalate to Solomon. STOP ⇒ opt out.",
    payloadHints: [
      "portal_1003_url (string, URL) — link to the 1003 form on app.premerealestate.com",
      "phase (literal P3)",
    ],
  },
  // pre_qual_link_resend — same shape and tone as pre_qual_link_send (lead-pulled re-fire)
  pre_qual_link_resend: {
    whenFires:
      "Lead replies asking for the link again, OR Riley re-fires after a confirmed 'didn't get it' from a nudge.",
    toneGuidance:
      "Warm, brief, link is the focal point. Frame as 're-sending' or 'as requested' — not 'sorry to bother'.",
    replyHandling:
      "Same as pre_qual_link_send — confirmation ⇒ thank, don't resend a third time. Field questions ⇒ custom_ad_hoc.",
    payloadHints: [
      "pre_qual_url (string, URL) — the link",
      "timeline_note (string, optional)",
    ],
  },
  nurture_monthly: {
    whenFires:
      "Leads tagged cold_after_cadence on Day 30 / 60 / 90 from last activity (Doc 02.3 §6 After Day 7 branching).",
    toneGuidance: "Soft, zero urgency, door-left-open. Acknowledge time has passed.",
    replyHandling:
      "Warm reply ⇒ re-enter active cadence at Day 1 Phase 1. STOP ⇒ hard-kill.",
    payloadHints: [
      "days_since_last_activity (number, positive)",
      "original_reason_cold (string) — e.g., didn't submit, callback missed, didn't respond",
      "phase (literal P3)",
    ],
  },
  stale_reintro: {
    whenFires:
      "Touch 1 of the stale lead re-engagement workflow. Lead tagged stale_lead — went cold 30+ days ago, likely never got proper follow-up. First contact after the gap.",
    toneGuidance:
      "Warm, human, zero pitch. Acknowledge the gap honestly. Lead with curiosity — what happened? Are they still in the market? Sound like a real person checking in, not a sales sequence.",
    replyHandling:
      "Any engagement ⇒ move to active re-engagement. 'Found someone' ⇒ acknowledge, close cleanly. STOP ⇒ hard-kill.",
    payloadHints: [],
  },
  stale_missed_call: {
    whenFires:
      "Touch 3 of the stale lead workflow. Riley just attempted a call and went to VM. SMS follow-up after the missed call attempt.",
    toneGuidance:
      "Brief, direct. Just tried to reach them. One ask — call or text back. No pitch. No pressure.",
    replyHandling:
      "Any reply ⇒ re-engage. Scheduling ⇒ callback_confirmation. STOP ⇒ hard-kill.",
    payloadHints: [],
  },
  stale_disqualify: {
    whenFires:
      "Touch 4 of the stale lead workflow. Lead has not responded after 3 days of re-engagement. Time for a direct qualifying question.",
    toneGuidance:
      "Hormozi disqualifier frame. Give them permission to say no. 'Did you end up going with someone else? No hard feelings if so.' Direct, honest, not needy. A yes gets more responses than another check-in.",
    replyHandling:
      "'Found someone' ⇒ acknowledge, close, tag not_interested. Engagement ⇒ re-enter active follow-up. STOP ⇒ hard-kill.",
    payloadHints: [],
  },
  stale_breakup: {
    whenFires:
      "Touch 6 of the stale lead workflow. Final outreach before closing the file. Hormozi breakup message — genuine finality, not manufactured urgency.",
    toneGuidance:
      "Honest and final. Tell them you're going to stop reaching out after this. Give them one last genuine chance to reconnect or say no. Do NOT pitch. Do NOT manufacture urgency. The finality itself is the message. This should feel like a real person closing a file, not a sales tactic.",
    replyHandling:
      "Any reply ⇒ re-engage immediately, high priority. Silence ⇒ workflow closes. STOP ⇒ hard-kill.",
    payloadHints: [],
  },
}

// ---------------------------------------------------------------------------
// Fallback renderers — baseline SMS text used until Retell console prompt is
// updated to generate from objective+payload. All include STOP language (A2P).
// ---------------------------------------------------------------------------

type FallbackRenderer<T extends Objective> = (
  payload: ObjectivePayload<T>,
  firstName: string,
) => string

const stopSuffix = " Reply STOP to opt out."

function clip(s: string, max = 1500): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…"
}

const RENDER_PRE_QUAL_LINK_SEND: FallbackRenderer<"pre_qual_link_send"> = (p, name) => {
  const timeline = p.timeline_note ? ` (aimed at ${p.timeline_note})` : ""
  return clip(`Hey ${name} — here's your pre-qual link${timeline}: ${p.pre_qual_url}${stopSuffix}`)
}

// follow_up_no_call_connect: NO link, push-to-phone (Doc 02.3 §3a, Doc 02.13 §7).
// Payload `cta` is intentionally ignored — renderer is hardcoded to guarantee no URL leakage.
const RENDER_FOLLOW_UP_NO_CALL_CONNECT: FallbackRenderer<"follow_up_no_call_connect"> = (_p, name) =>
  clip(
    `Hey ${name} — Riley from Preme. Tried to reach you about your DSCR inquiry. Call or text me back when you have a min and we'll get you sorted.${stopSuffix}`,
  )

// day1_evening_soft_check (P1): NO link, push-to-phone.
const RENDER_DAY1_EVENING_SOFT_CHECK: FallbackRenderer<"day1_evening_soft_check"> = (_p, name) =>
  clip(
    `Hey ${name} — Riley here from Preme. I tried to reach you earlier about your DSCR inquiry. What's a good time tomorrow morning to grab 5 minutes?${stopSuffix}`,
  )

// day2_value_recap (P1): NO link, push-to-phone, value-led.
const RENDER_DAY2_VALUE_RECAP: FallbackRenderer<"day2_value_recap"> = (_p, name) =>
  clip(
    `Hey ${name} — quick context: we work with 38 DSCR lenders and most investors get matched in their first call. Want to grab 5 min today or tomorrow?${stopSuffix}`,
  )

// day4_objection_handle (P2): empathetic objection probe + push-to-phone, OFFERS SMS form path
// without sending a link. Payload `common_objections` / `invite_reply` are hints, not interpolated
// (kept short + URL-free).
const RENDER_DAY4_OBJECTION_HANDLE: FallbackRenderer<"day4_objection_handle"> = (_p, name) =>
  clip(
    `Hey ${name} — haven't heard back. Anything specific holding you up? Happy to grab 5 min on the phone, or if it's easier I can also text you the pre-qual link directly. Your call.${stopSuffix}`,
  )

// day5_help_offer (P2): last-shot call ask, OFFERS SMS form path, lead must explicitly request link.
const RENDER_DAY5_HELP_OFFER: FallbackRenderer<"day5_help_offer"> = (_p, name) =>
  clip(
    `Hey ${name} — last shot from me. Want to lock in a quick call this week? Or if you'd rather just text-fill the pre-qual yourself, say the word and I'll send the link.${stopSuffix}`,
  )

const RENDER_DAY6_URGENCY: FallbackRenderer<"day6_urgency"> = (p, name) =>
  clip(`${name} — quick heads up: ${p.scarcity_framing} Can we lock you in?${stopSuffix}`)

const RENDER_DAY7_FINAL_RELEASE: FallbackRenderer<"day7_final_release"> = (p, name) =>
  clip(`${name}, I'll stop reaching out for now. ${p.door_open_line}${stopSuffix}`)

const RENDER_CALLBACK_CONFIRMATION: FallbackRenderer<"callback_confirmation"> = (p, name) => {
  const t = new Date(p.callback_time_iso)
  const when = t.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
  return clip(`Confirmed, ${name} — I'll call you ${when} from ${p.call_from_number}.${stopSuffix}`)
}

const RENDER_POST_SUBMISSION_THANKS: FallbackRenderer<"post_submission_thanks"> = (p, name) =>
  clip(
    `Thanks ${name} — app's in. ${p.next_step_owner} will reach out ${p.next_step_eta} with next steps.${stopSuffix}`,
  )

const RENDER_CUSTOM_AD_HOC: FallbackRenderer<"custom_ad_hoc"> = (p, name) =>
  clip(`Hey ${name} — ${p.full_context}${stopSuffix}`)

// Drip nudges (Doc 02.13 §7) — all hardcoded strings, no URL leakage on P1.
const RENDER_PRE_QUAL_OPEN_NUDGE: FallbackRenderer<"pre_qual_open_nudge"> = (_p, name) =>
  clip(
    `Hey ${name} — did the pre-qual link come through? Should be from a 470 number. Lemme know if anything's off.${stopSuffix}`,
  )

const RENDER_PRE_QUAL_SUBMIT_NUDGE: FallbackRenderer<"pre_qual_submit_nudge"> = (_p, name) =>
  clip(
    `Saw you got into the form, ${name} — anything I can help unstick? Happy to walk through any field.${stopSuffix}`,
  )

const RENDER_LOAN_APP_OPEN_NUDGE: FallbackRenderer<"loan_app_open_nudge"> = (_p, name) =>
  clip(
    `Hey ${name} — your loan app from Preme is in your inbox + texts. Knock it out when you have a sec, takes ~10 min.${stopSuffix}`,
  )

const RENDER_LOAN_APP_SUBMIT_NUDGE: FallbackRenderer<"loan_app_submit_nudge"> = (_p, name) =>
  clip(
    `Saw you opened the loan app, ${name} — any questions on the fields? Solomon can jump on a quick call if helpful.${stopSuffix}`,
  )

// loan_app_send (Solomon-triggered, post pre-qual approval). Includes link.
const RENDER_LOAN_APP_SEND: FallbackRenderer<"loan_app_send"> = (p, name) =>
  clip(
    `Hey ${name} — great news, you're moving forward. Here's your loan app: ${p.portal_1003_url} — takes about 10 minutes.${stopSuffix}`,
  )

// pre_qual_link_resend — same shape as pre_qual_link_send, "as requested" framing.
const RENDER_PRE_QUAL_LINK_RESEND: FallbackRenderer<"pre_qual_link_resend"> = (p, name) => {
  const timeline = p.timeline_note ? ` (aimed at ${p.timeline_note})` : ""
  return clip(`Hey ${name} — re-sending the pre-qual link${timeline}: ${p.pre_qual_url}${stopSuffix}`)
}

const RENDER_NURTURE_MONTHLY: FallbackRenderer<"nurture_monthly"> = (p, name) => {
  const elapsed =
    p.days_since_last_activity >= 90
      ? "about three months"
      : p.days_since_last_activity >= 60
        ? "a couple of months"
        : "about a month"
  return clip(
    `Hi ${name} — it's been ${elapsed} since we talked. No pressure, just checking in: has anything changed on your side?${stopSuffix}`,
  )
}

export const FALLBACK_RENDERERS: {
  [K in Objective]: FallbackRenderer<K>
} = {
  pre_qual_link_send: RENDER_PRE_QUAL_LINK_SEND,
  pre_qual_link_resend: RENDER_PRE_QUAL_LINK_RESEND,
  follow_up_no_call_connect: RENDER_FOLLOW_UP_NO_CALL_CONNECT,
  day1_evening_soft_check: RENDER_DAY1_EVENING_SOFT_CHECK,
  day2_value_recap: RENDER_DAY2_VALUE_RECAP,
  day4_objection_handle: RENDER_DAY4_OBJECTION_HANDLE,
  day5_help_offer: RENDER_DAY5_HELP_OFFER,
  day6_urgency: RENDER_DAY6_URGENCY,
  day7_final_release: RENDER_DAY7_FINAL_RELEASE,
  callback_confirmation: RENDER_CALLBACK_CONFIRMATION,
  post_submission_thanks: RENDER_POST_SUBMISSION_THANKS,
  custom_ad_hoc: RENDER_CUSTOM_AD_HOC,
  nurture_monthly: RENDER_NURTURE_MONTHLY,
  pre_qual_open_nudge: RENDER_PRE_QUAL_OPEN_NUDGE,
  pre_qual_submit_nudge: RENDER_PRE_QUAL_SUBMIT_NUDGE,
  loan_app_open_nudge: RENDER_LOAN_APP_OPEN_NUDGE,
  loan_app_submit_nudge: RENDER_LOAN_APP_SUBMIT_NUDGE,
  loan_app_send: RENDER_LOAN_APP_SEND,
  stale_reintro: (_p, name) =>
    clip(`Hey ${name} — it's been a while since we talked about your financing. Still in the market or did things change on your end?${stopSuffix}`),
  stale_missed_call: (_p, name) =>
    clip(`Hey ${name} — just tried to reach you. Call or text back when you have a sec.${stopSuffix}`),
  stale_disqualify: (_p, name) =>
    clip(`Hey ${name} — did you end up going with someone else for your loan? No hard feelings either way — just want to make sure I'm not bugging you if timing's off.${stopSuffix}`),
  stale_breakup: (_p, name) =>
    clip(`${name} — I'm going to go ahead and close your file after this. If things change or timing shifts, just text me and I'll pick it back up. No pressure.${stopSuffix}`),
}

// ---------------------------------------------------------------------------
// Registry accessors
// ---------------------------------------------------------------------------

export function getObjectiveMetadata<T extends Objective>(objective: T): ObjectiveMetadata {
  return OBJECTIVE_METADATA[objective]
}

export function validatePayload<T extends Objective>(
  objective: T,
  payload: unknown,
): ObjectivePayload<T> {
  const schema = PAYLOAD_SCHEMAS[objective]
  return schema.parse(payload) as ObjectivePayload<T>
}

export function renderFallback<T extends Objective>(
  objective: T,
  payload: ObjectivePayload<T>,
  firstName: string,
): string {
  const renderer = FALLBACK_RENDERERS[objective] as FallbackRenderer<T>
  const name = firstName?.trim() || "there"
  return renderer(payload, name)
}

/**
 * Build the prompt slice fragment the Retell SMS agent's system prompt should
 * include for a given objective. Copy-paste target lives in
 * docs/preme-sms-agent-console-update.md.
 */
export function promptSliceFor<T extends Objective>(objective: T): string {
  const meta = OBJECTIVE_METADATA[objective]
  const payloadList = meta.payloadHints.map((h) => `    - ${h}`).join("\n")
  return [
    `If {{objective}} == "${objective}":`,
    `  When it fires: ${meta.whenFires}`,
    `  Tone: ${meta.toneGuidance}`,
    `  Reply handling: ${meta.replyHandling}`,
    `  Payload fields available:`,
    payloadList,
  ].join("\n")
}

/**
 * Build the agent tool definition (OpenAI-function-style JSON schema). This is
 * the "send_preme_sms" function the Retell console exposes; the objective enum
 * + payload hints are materialized into parameters.
 */
export function buildAgentToolDefinition(): Record<string, unknown> {
  return {
    name: "compose_outbound_sms",
    description:
      "Compose an outbound SMS aligned with the given objective and payload. The Retell SMS agent uses this schema to generate a message when invoked via createSMSChat with retell_llm_dynamic_variables.objective set.",
    parameters: {
      type: "object",
      required: ["objective", "payload", "first_name"],
      properties: {
        objective: {
          type: "string",
          enum: [...OBJECTIVES],
          description:
            "One of the 13 canonical Preme objectives. Source of truth: Doc 02.13 §7.",
        },
        first_name: {
          type: "string",
          description: "Lead's first name (defaults to 'there' if empty).",
        },
        payload: {
          type: "object",
          description:
            "Objective-specific payload. Shape depends on objective — see per-objective schemas in the Retell agent prompt (prompt slices) for the allowed fields.",
        },
      },
    },
  }
}
