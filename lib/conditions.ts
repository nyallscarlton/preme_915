import { createAdminClient } from "@/lib/supabase/admin"

// ─── Types ───

export interface DscrLender {
  id: string
  name: string
  short_name: string
  min_fico: number
  min_loan: number
  max_loan: number | null
  min_dscr: number
  max_units: number | null
  ltv: Record<string, number>
  states: string[]
  active: boolean
  contact_email: string
  total_lender_fees: number | null
  max_term: string | null
  ppp: string | null
  recourse: string | null
  section8: string | null
  llc_layering: string | null
}

export interface LenderMatchResult {
  lender: DscrLender
  qualified: boolean
  reasons: string[]
}

export interface Condition {
  id: string
  application_id: string
  title: string
  description: string | null
  status: string // outstanding, submitted, approved, waived
  due_date: string | null
  created_by: string | null
  created_at: string
}

export interface LoanApplication {
  id: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string
  application_number: string
  status: string
  loan_amount: number
  loan_purpose: string
  loan_type: string
  property_type: string
  property_value: number
  property_address: string
  credit_score_range: string
  annual_income: number
  guest_token: string
}

// ─── Lender Matching ───

function creditRangeToNumber(range: string): number {
  if (range.includes("+")) return parseInt(range)
  const parts = range.split("-")
  return parseInt(parts[0]) || 0
}

export async function matchDscrLenders(applicationId: string): Promise<{
  matches: LenderMatchResult[]
  application: LoanApplication | null
  stats: { qualified: number; total: number }
}> {
  const supabase = createAdminClient()

  const { data: app } = await supabase
    .from("loan_applications")
    .select("*")
    .eq("id", applicationId)
    .single()

  if (!app) return { matches: [], application: null, stats: { qualified: 0, total: 0 } }

  const { data: lenders } = await supabase
    .from("dscr_lenders")
    .select("*")
    .eq("active", true)
    .order("name")

  if (!lenders) return { matches: [], application: app as LoanApplication, stats: { qualified: 0, total: 0 } }

  const creditScore = creditRangeToNumber(app.credit_score_range || "0")
  const loanAmount = app.loan_amount || 0
  const propertyState = (app.property_state || "").toUpperCase().trim()

  const matches: LenderMatchResult[] = lenders.map((l) => {
    const reasons: string[] = []

    if (creditScore > 0 && creditScore < l.min_fico) {
      reasons.push(`Credit ${creditScore} below min ${l.min_fico}`)
    }
    if (loanAmount > 0 && loanAmount < l.min_loan) {
      reasons.push(`Loan $${loanAmount.toLocaleString()} below min $${l.min_loan.toLocaleString()}`)
    }
    if (l.max_loan && loanAmount > l.max_loan) {
      reasons.push(`Loan $${loanAmount.toLocaleString()} exceeds max $${l.max_loan.toLocaleString()}`)
    }
    // Check state restrictions
    if (propertyState && l.states && l.states.length > 0) {
      const normalizedStates = l.states.map((s: string) => s.toUpperCase().trim())
      if (!normalizedStates.includes(propertyState)) {
        reasons.push(`Property state ${propertyState} not in lender's coverage`)
      }
    }

    return {
      lender: l as DscrLender,
      qualified: reasons.length === 0,
      reasons,
    }
  })

  matches.sort((a, b) => (a.qualified === b.qualified ? 0 : a.qualified ? -1 : 1))

  const qualified = matches.filter((m) => m.qualified).length
  return { matches, application: app as LoanApplication, stats: { qualified, total: matches.length } }
}

// ─── Conditions CRUD ───

export async function getConditions(applicationId: string): Promise<Condition[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("conditions")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })
  return (data || []) as Condition[]
}

export async function addCondition(
  applicationId: string,
  title: string,
  description?: string,
  dueDate?: string
): Promise<Condition> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("conditions")
    .insert({
      application_id: applicationId,
      title,
      description: description || null,
      status: "outstanding",
      due_date: dueDate || null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Condition
}

export async function updateConditionStatus(
  conditionId: string,
  newStatus: string,
  notes?: string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: current } = await supabase
    .from("conditions")
    .select("status")
    .eq("id", conditionId)
    .single()

  await supabase
    .from("conditions")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", conditionId)

  if (current) {
    await supabase.from("condition_history").insert({
      condition_id: conditionId,
      previous_status: current.status,
      new_status: newStatus,
      change_source: "admin",
      notes: notes || null,
    })
  }
}

export async function deleteCondition(conditionId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from("conditions").delete().eq("id", conditionId)
}

// ─── Documents ───

export interface ConditionDocument {
  id: string
  application_id: string | null
  condition_id: string | null
  uploaded_by: string | null
  file_name: string
  storage_path: string
  document_type: string | null
  status: string
  created_at: string
}

export async function getDocumentsForApplication(applicationId: string): Promise<ConditionDocument[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("loan_documents")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
  return (data || []) as ConditionDocument[]
}

// ─── Common Condition Templates ───

export const CONDITION_TEMPLATES = {
  dscr: [
    "Bank Statements (2 months)",
    "Lease Agreement / Rent Roll",
    "Property Insurance Binder",
    "Entity Docs (LLC/Corp Articles)",
    "Photo ID (Driver's License)",
    "Purchase Contract",
    "Property Appraisal",
    "Title Commitment",
  ],
  "fix-flip": [
    "Bank Statements (2 months)",
    "Scope of Work / Rehab Budget",
    "Purchase Contract",
    "Photo ID (Driver's License)",
    "Entity Docs (LLC/Corp Articles)",
    "Proof of Rehab Experience",
    "Property Insurance Binder",
  ],
  general: [
    "Bank Statements (2 months)",
    "Photo ID (Driver's License)",
    "Purchase Contract",
    "Property Insurance Binder",
  ],
}


// ── Functions ported from zentryx for /pipeline UI ──

export async function findApplicationForLead(leadId: string): Promise<LoanApplication | null> {
  const supabase = createAdminClient()

  // Try to match by email or phone
  const { data: lead } = await supabase
    .from("zx_leads")
    .select("email, phone, first_name, last_name")
    .eq("id", leadId)
    .single()

  if (!lead) return null

  // Match by email first, then phone
  let app = null
  if (lead.email) {
    const { data } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("applicant_email", lead.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    app = data
  }

  if (!app && lead.phone) {
    const phone = lead.phone.replace(/\D/g, "").slice(-10)
    const { data } = await supabase
      .from("loan_applications")
      .select("*")
      .like("applicant_phone", `%${phone}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    app = data
  }

  return app as LoanApplication | null
}
