import { createClient } from "@/lib/supabase/client"

export interface LoanApplication {
  id: string
  user_id?: string
  applicant_email: string
  applicant_name: string
  applicant_phone: string
  application_number: string
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "on_hold" | "archived"
  contact_address?: string
  contact_city?: string
  contact_state?: string
  contact_zip?: string
  loan_amount?: number
  loan_purpose?: string
  loan_type?: string
  property_address?: string
  property_city?: string
  property_state?: string
  property_zip?: string
  property_type?: string
  property_value?: number
  annual_income?: number
  employment_status?: string
  employer_name?: string
  credit_score_range?: string
  has_sponsor?: boolean
  sponsor_name?: string
  sponsor_email?: string
  sponsor_phone?: string
  cash_reserves?: number
  investment_accounts?: number
  retirement_accounts?: number
  guest_token?: string
  is_guest?: boolean
  submitted_at?: string
  created_at?: string
  updated_at?: string
}

function generateApplicationNumber(): string {
  const prefix = "PREME"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomUUID().substring(0, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

function generateGuestToken(): string {
  return crypto.randomUUID()
}

export async function submitApplication(
  data: Partial<LoanApplication>,
  userId?: string
): Promise<{ success: boolean; application?: LoanApplication; error?: string }> {
  const supabase = createClient()

  try {
    const applicationData = {
      ...data,
      user_id: userId || null,
      application_number: generateApplicationNumber(),
      guest_token: data.is_guest ? generateGuestToken() : null,
      status: "submitted" as const,
      submitted_at: new Date().toISOString(),
    }

    const { data: application, error } = await supabase
      .from("loan_applications")
      .insert([applicationData])
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, application }
  } catch (err) {
    return { success: false, error: "Failed to submit application" }
  }
}

export async function getAllApplications(): Promise<{
  success: boolean
  applications?: LoanApplication[]
  error?: string
}> {
  const supabase = createClient()

  try {
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, applications: applications || [] }
  } catch (err) {
    return { success: false, error: "Failed to fetch applications" }
  }
}

export async function getApplicationsByUser(
  userId: string,
  email: string
): Promise<{ success: boolean; applications?: LoanApplication[]; error?: string }> {
  const supabase = createClient()

  try {
    // Get apps by user_id OR by email (for pre-auth guest submissions)
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("*")
      .or(`user_id.eq.${userId},applicant_email.eq.${email}`)
      .order("created_at", { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, applications: applications || [] }
  } catch (err) {
    return { success: false, error: "Failed to fetch applications" }
  }
}

export async function getApplicationsByEmail(
  email: string
): Promise<{ success: boolean; applications?: LoanApplication[]; error?: string }> {
  const supabase = createClient()

  try {
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("applicant_email", email)
      .order("created_at", { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, applications: applications || [] }
  } catch (err) {
    return { success: false, error: "Failed to fetch applications" }
  }
}

export async function getApplicationByToken(
  token: string
): Promise<{ success: boolean; application?: LoanApplication; error?: string }> {
  const supabase = createClient()

  try {
    const { data: application, error } = await supabase
      .from("loan_applications")
      .select("*")
      .eq("guest_token", token)
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, application }
  } catch (err) {
    return { success: false, error: "Failed to fetch application" }
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  status: LoanApplication["status"]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from("loan_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", applicationId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: "Failed to update application" }
  }
}

export async function archiveApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  return updateApplicationStatus(applicationId, "archived")
}
