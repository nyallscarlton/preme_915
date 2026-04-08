export interface Vertical {
  id: string
  slug: string
  name: string
  description: string | null
  retell_agent_id: string | null
  default_form_fields: FormField[]
  active: boolean
  created_at: string
}

export interface Buyer {
  id: string
  vertical_id: string
  name: string
  webhook_url: string
  webhook_secret: string | null
  pricing_model: "per_lead" | "rev_share"
  price_per_lead: number | null
  rev_share_pct: number | null
  acceptance_criteria: Record<string, unknown> | null
  active: boolean
  created_at: string
}

export interface Lead {
  id: string
  vertical_id: string
  buyer_id: string | null
  landing_page_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  custom_fields: Record<string, unknown>
  status: LeadStatus
  score: number | null
  temperature: "cold" | "warm" | "hot" | null
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  retell_call_id: string | null
  retell_transcript: string | null
  retell_recording_url: string | null
  retell_summary: string | null
  qualification_data: Record<string, unknown> | null
  handoff_status: "pending" | "sent" | "accepted" | "rejected" | null
  handoff_at: string | null
  buyer_reference_id: string | null
  created_at: string
  updated_at: string
}

export type LeadStatus =
  | "new"
  | "contacting"
  | "calling"
  | "contacted"
  | "qualified"
  | "application"
  | "processing"
  | "closed_won"
  | "closed_lost"
  | "handed_off"
  | "converted"
  | "dead"

export interface LeadEvent {
  id: string
  lead_id: string
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
}

// ─── CRM Types ───

export interface Sequence {
  id: string
  slug: string
  name: string
  description: string | null
  trigger_on: "lead_created" | "no_answer" | "manual"
  active: boolean
  created_at: string
}

export interface SequenceStep {
  id: string
  sequence_id: string
  step_number: number
  delay_minutes: number
  channel: "auto_sms" | "auto_call" | "manual_call" | "manual_task"
  template_id: string | null
  task_description: string | null
  send_after_hour: number
  send_before_hour: number
  active: boolean
  created_at: string
  // Joined
  template?: MessageTemplate
}

export interface SequenceEnrollment {
  id: string
  lead_id: string
  sequence_id: string
  status: "active" | "paused" | "completed" | "cancelled"
  current_step: number
  enrolled_at: string
  paused_at: string | null
  completed_at: string | null
  pause_reason: string | null
  created_at: string
  updated_at: string
  // Joined
  sequence?: Sequence
  lead?: Lead
}

export interface MessageTemplate {
  id: string
  slug: string
  name: string
  channel: "sms" | "email"
  body: string
  active: boolean
  created_at: string
}

export interface Task {
  id: string
  lead_id: string
  enrollment_id: string | null
  type: "call" | "sms" | "email" | "other"
  title: string
  description: string | null
  due_at: string
  completed_at: string | null
  status: "pending" | "completed" | "skipped" | "overdue"
  notified: boolean
  created_at: string
  // Joined
  lead?: Lead
}

export interface LeadNote {
  id: string
  lead_id: string
  content: string
  author: string
  created_at: string
}

// ─── Water Damage Types ───

export type WaterDamageType =
  | "burst_pipe"
  | "flooding"
  | "sewage_backup"
  | "roof_leak"
  | "appliance_leak"
  | "storm_damage"
  | "foundation_leak"
  | "other"

export interface WaterDamageCustomFields {
  damage_type: WaterDamageType
  address: string
  zip_code: string
  city: string
  market: "dallas" | "atlanta" | "houston"
  insurance_claim?: boolean
  damage_description?: string
  urgency?: "emergency" | "urgent" | "standard"
}

export type VerticalSlug = "real-estate" | "water-damage"

export interface Testimonial {
  name: string
  role: string
  quote: string
  rating: number
}

export interface Stat {
  value: string
  label: string
}

export interface LandingPage {
  id: string
  vertical_id: string
  slug: string
  headline: string
  subheadline: string | null
  body_copy: string | null
  bullets: string[]
  trust_signals: string[]
  cta_text: string
  form_fields: FormField[]
  testimonials: Testimonial[]
  stats: Stat[]
  urgency_text: string | null
  seo_title: string | null
  seo_description: string | null
  active: boolean
  created_at: string
}

export interface FormField {
  name: string
  label: string
  type: "text" | "email" | "tel" | "select" | "textarea"
  required: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface Campaign {
  id: string
  vertical_id: string
  landing_page_id: string | null
  name: string
  platform: string | null
  budget: number | null
  spend: number | null
  leads_count: number
  cost_per_lead: number | null
  active: boolean
  start_date: string | null
  end_date: string | null
  created_at: string
}
