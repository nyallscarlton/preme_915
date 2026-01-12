import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client"

export interface LoanApplication {
  id: string
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

// Generate unique application number
function generateApplicationNumber(): string {
  const prefix = "PREME"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

// Generate guest token for magic link access
function generateGuestToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Submit a new loan application
export async function submitApplication(
  data: Partial<LoanApplication>,
): Promise<{ success: boolean; application?: LoanApplication; error?: string }> {
  console.log("[v0] submitApplication called with data:", data)

  const supabase = getSupabaseClient()
  const hasConfig = hasSupabaseConfig()

  console.log("[v0] Supabase client:", supabase ? "available" : "null")
  console.log("[v0] hasSupabaseConfig:", hasConfig)

  if (!supabase || !hasConfig) {
    // Mock response for development
    console.log("[v0] Using mock data - Supabase not configured")
    const mockApp: LoanApplication = {
      id: crypto.randomUUID(),
      application_number: generateApplicationNumber(),
      applicant_email: data.applicant_email || "",
      applicant_name: data.applicant_name || "",
      applicant_phone: data.applicant_phone || "",
      status: "submitted",
      guest_token: data.is_guest ? generateGuestToken() : undefined,
      is_guest: data.is_guest || false,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ...data,
    }
    return { success: true, application: mockApp }
  }

  try {
    const applicationData = {
      ...data,
      application_number: generateApplicationNumber(),
      guest_token: data.is_guest ? generateGuestToken() : null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    }

    console.log("[v0] Inserting into Supabase:", applicationData)

    const { data: application, error } = await supabase
      .from("loan_applications")
      .insert([applicationData])
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase insert error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] Application inserted successfully:", application)
    return { success: true, application }
  } catch (err) {
    console.error("[v0] Error submitting application:", err)
    return { success: false, error: "Failed to submit application" }
  }
}

// Get all applications (for admin)
export async function getAllApplications(): Promise<{
  success: boolean
  applications?: LoanApplication[]
  error?: string
}> {
  console.log("[v0] getAllApplications called")

  const supabase = getSupabaseClient()
  const hasConfig = hasSupabaseConfig()

  if (!supabase || !hasConfig) {
    console.log("[v0] Using mock data for getAllApplications")
    // Mock data for development
    return {
      success: true,
      applications: [
        {
          id: "1",
          application_number: "PREME-ABC123-XYZ",
          applicant_email: "john@example.com",
          applicant_name: "John Smith",
          applicant_phone: "(555) 123-4567",
          status: "submitted",
          loan_amount: 500000,
          property_address: "123 Main St",
          property_city: "Los Angeles",
          property_state: "CA",
          loan_type: "Bridge Loan",
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
    }
  }

  try {
    console.log("[v0] Fetching from Supabase...")
    const { data: applications, error } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Supabase fetch error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] Fetched applications:", applications?.length)
    return { success: true, applications: applications || [] }
  } catch (err) {
    console.error("[v0] Error fetching applications:", err)
    return { success: false, error: "Failed to fetch applications" }
  }
}

// Get applications by email
export async function getApplicationsByEmail(
  email: string,
): Promise<{ success: boolean; applications?: LoanApplication[]; error?: string }> {
  const supabase = getSupabaseClient()
  const hasConfig = hasSupabaseConfig()

  if (!supabase || !hasConfig) {
    return { success: true, applications: [] }
  }

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

// Get application by guest token
export async function getApplicationByToken(
  token: string,
): Promise<{ success: boolean; application?: LoanApplication; error?: string }> {
  const supabase = getSupabaseClient()
  const hasConfig = hasSupabaseConfig()

  if (!supabase || !hasConfig) {
    return { success: false, error: "Database not configured" }
  }

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

// Update application status (for admin)
export async function updateApplicationStatus(
  applicationId: string,
  status: LoanApplication["status"],
): Promise<{ success: boolean; error?: string }> {
  console.log("[v0] updateApplicationStatus called:", { applicationId, status })

  const supabase = getSupabaseClient()
  const hasConfig = hasSupabaseConfig()

  if (!supabase || !hasConfig) {
    console.log("[v0] Mock: Updating application status", applicationId, status)
    return { success: true }
  }

  try {
    const { error } = await supabase
      .from("loan_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", applicationId)

    if (error) {
      console.error("[v0] Supabase update error:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] Application status updated successfully")
    return { success: true }
  } catch (err) {
    console.error("[v0] Error updating application:", err)
    return { success: false, error: "Failed to update application" }
  }
}

// Archive application
export async function archiveApplication(applicationId: string): Promise<{ success: boolean; error?: string }> {
  return updateApplicationStatus(applicationId, "archived")
}
