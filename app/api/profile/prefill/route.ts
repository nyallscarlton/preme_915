import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET — static prefill data for the logged-in borrower starting a new
 * application: identity/contact from borrower_profiles (kept fresh by the
 * upsert_profile_from_application RPC on every submit), falling back to
 * their most recent application, plus their saved LLC list.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from("borrower_profiles")
    .select("first_name, last_name, email, phone, citizenship_type, marital_status, employer_name, employment_status, credit_score_exact, vesting_type, entity_legal_name, entity_org_type, entity_state_of_formation")
    .or(`user_id.eq.${user.id}${user.email ? `,email.eq.${user.email}` : ""}`)
    .limit(1)
    .maybeSingle()

  // Fallback: most recent application by this user (or their email)
  let lastApp: Record<string, any> | null = null
  if (user.email) {
    const { data } = await admin
      .from("loan_applications")
      .select("applicant_name, applicant_email, applicant_phone, credit_score_range, employment_status, employer_name, annual_income, contact_address, contact_city, contact_state, contact_zip")
      .or(`user_id.eq.${user.id},applicant_email.eq.${user.email}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    lastApp = data
  }

  const nameParts = (lastApp?.applicant_name || "").split(" ")
  const prefill = {
    firstName: profile?.first_name || nameParts[0] || "",
    lastName: profile?.last_name || nameParts.slice(1).join(" ") || "",
    email: user.email || profile?.email || lastApp?.applicant_email || "",
    phone: (profile as any)?.phone || lastApp?.applicant_phone || "",
    address: lastApp?.contact_address || "",
    city: lastApp?.contact_city || "",
    state: lastApp?.contact_state || "",
    zip: lastApp?.contact_zip || "",
    creditScoreRange: lastApp?.credit_score_range || "",
    employmentStatus: profile?.employment_status || lastApp?.employment_status || "",
    employerName: profile?.employer_name || lastApp?.employer_name || "",
    annualIncome: lastApp?.annual_income || null,
  }

  // Saved LLCs (empty until the borrower_llcs migration is applied)
  let llcs: any[] = []
  try {
    const { data } = await admin
      .from("borrower_llcs")
      .select("id, legal_name, org_type, state_of_formation, formation_date")
      .or(`user_id.eq.${user.id}${user.email ? `,email.eq.${user.email}` : ""}`)
      .order("created_at", { ascending: false })
    llcs = data || []
  } catch {
    // table missing pre-migration — fine
  }
  // Legacy single-entity slot from borrower_profiles counts as an option too
  if (profile?.entity_legal_name && !llcs.some((l) => l.legal_name === profile.entity_legal_name)) {
    llcs.push({
      id: null,
      legal_name: profile.entity_legal_name,
      org_type: profile.entity_org_type || "LLC",
      state_of_formation: profile.entity_state_of_formation || null,
      formation_date: null,
    })
  }

  return NextResponse.json({ prefill, llcs })
}
