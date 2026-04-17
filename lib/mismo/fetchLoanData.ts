import { createAdminClient } from "@/lib/supabase/admin"
import type {
  LoanData,
  LoanApplication,
  LoanBorrower,
  LoanDeclaration,
  LoanLiability,
  LoanAsset,
  LoanReoProperty,
} from "./types"

/**
 * Pull a loan_application + all MISMO-relevant children, decrypt PII, and
 * compute derived fields. This object is ephemeral — never persist it.
 *
 * Decryption uses preme.decrypt_pii RPC which writes to preme.pii_access_log.
 */
export async function fetchLoanData(loanId: string): Promise<LoanData> {
  const sb = createAdminClient()

  const { data: appRow, error: appErr } = await sb
    .from("loan_applications")
    .select("*")
    .eq("id", loanId)
    .single()
  if (appErr || !appRow) throw new Error(`loan_application ${loanId} not found: ${appErr?.message ?? "no row"}`)

  const [borrowersRes, declarationsRes, liabilitiesRes, assetsRes, reosRes] = await Promise.all([
    sb.from("loan_borrowers").select("*").eq("loan_application_id", loanId),
    sb.from("loan_declarations").select("*").eq("loan_application_id", loanId),
    sb.from("loan_liabilities").select("*").eq("loan_application_id", loanId),
    sb.from("loan_assets").select("*").eq("loan_application_id", loanId),
    sb.from("loan_reo_properties").select("*").eq("loan_application_id", loanId),
  ])

  const decryptedSsn = await decryptPii(sb, appRow.applicant_ssn_encrypted, "mismo_generation", loanId, "applicant_ssn")
  const decryptedEin = await decryptPii(sb, appRow.entity_ein_encrypted, "mismo_generation", loanId, "entity_ein")

  const borrowers: LoanBorrower[] = await Promise.all(
    (borrowersRes.data ?? []).map(async (b) => ({
      id: b.id,
      role: b.role,
      classification_type: b.classification_type,
      first_name: b.first_name,
      middle_name: b.middle_name,
      last_name: b.last_name,
      name_suffix: b.name_suffix,
      dob: b.dob,
      ssn: await decryptPii(sb, b.ssn_encrypted, "mismo_generation", loanId, `borrower_${b.id}_ssn`),
      citizenship_type: b.citizenship_type,
      marital_status: b.marital_status,
      email: b.email,
      phone: b.phone,
      current_address: b.current_address,
      current_city: b.current_city,
      current_state: b.current_state,
      current_zip: b.current_zip,
      residency_basis: b.residency_basis,
      residency_months: b.residency_months,
      credit_score_exact: b.credit_score_exact,
      signed_date: b.signed_date,
      joint_with_primary: b.joint_with_primary,
    }))
  )

  const loan: LoanApplication = {
    ...(appRow as any),
    applicant_ssn: decryptedSsn,
    entity_ein: decryptedEin,
  }
  delete (loan as any).applicant_ssn_encrypted
  delete (loan as any).entity_ein_encrypted

  const declarations = (declarationsRes.data ?? []) as LoanDeclaration[]
  const primaryDeclaration = declarations.find((d) => d.borrower_id === null) ?? null

  const liabilities = (liabilitiesRes.data ?? []) as LoanLiability[]
  const assets = (assetsRes.data ?? []) as LoanAsset[]
  const reoProperties = (reosRes.data ?? []) as LoanReoProperty[]

  const totalLiabilitiesMonthlyPayment = liabilities
    .filter((l) => !l.excluded_from_dti)
    .reduce((sum, l) => sum + Number(l.monthly_payment_amount ?? 0), 0)

  // Proposed housing expense (monthly) = monthly P&I + taxes + insurance + HOA + flood + MI + PM fee
  const monthlyTaxes = Number(loan.annual_property_tax ?? 0) / 12
  const monthlyPrincipalInterest = computeMonthlyPI(loan)
  const totalMonthlyProposedHousingExpense =
    monthlyPrincipalInterest +
    monthlyTaxes +
    Number(loan.hazard_insurance_monthly ?? 0) +
    Number(loan.hoa_monthly ?? 0) +
    Number(loan.flood_insurance_monthly ?? 0) +
    Number(loan.property_mgmt_fee_monthly ?? 0)

  return {
    loan,
    borrowers,
    declarations,
    liabilities,
    assets,
    reo_properties: reoProperties,
    borrower_count: 1 + borrowers.filter((b) => b.role !== "Guarantor").length,
    has_entity_borrower: loan.vesting_type === "Entity" && !!loan.entity_legal_name,
    has_guarantor: borrowers.some((b) => b.role === "Guarantor"),
    primary_declaration: primaryDeclaration,
    total_liabilities_monthly_payment: round2(totalLiabilitiesMonthlyPayment),
    total_monthly_proposed_housing_expense: round2(totalMonthlyProposedHousingExpense),
    generated_at: new Date().toISOString(),
    mismo_version: "3.4.032420160128",
    origin_company: {
      name: process.env.PREME_LEGAL_NAME ?? "Preme Home Loans LLC",
      nmls: process.env.PREME_NMLS_COMPANY ?? "",
      address: process.env.PREME_ADDRESS ?? "",
      city: process.env.PREME_CITY ?? "",
      state: process.env.PREME_STATE ?? "",
      zip: process.env.PREME_ZIP ?? "",
      phone: process.env.PREME_PHONE ?? "+14709425787",
    },
  }
}

async function decryptPii(
  sb: ReturnType<typeof createAdminClient>,
  ciphertext: string | null,
  purpose: string,
  loanApplicationId: string,
  fieldName: string
): Promise<string | null> {
  if (!ciphertext) return null
  const { data, error } = await sb.rpc("decrypt_pii", {
    ciphertext,
    purpose,
    loan_application_id: loanApplicationId,
    field_name: fieldName,
  })
  if (error) throw new Error(`decrypt_pii(${fieldName}) failed: ${error.message}`)
  return (data as string) ?? null
}

function computeMonthlyPI(loan: LoanApplication): number {
  const amount = Number(loan.note_amount ?? loan.loan_amount ?? 0)
  const rate = Number(loan.note_rate_percent ?? 0) / 100 / 12
  const term = Number(loan.loan_term_months ?? 360)
  if (!amount || !rate || !term) return 0
  if (loan.interest_only) return amount * rate
  const factor = Math.pow(1 + rate, term)
  return (amount * rate * factor) / (factor - 1)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
