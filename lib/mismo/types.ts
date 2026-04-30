/**
 * Shape of the data that flows through the MISMO generator pipeline.
 * Populated by fetchLoanData.ts and consumed by the Handlebars templates.
 * PII fields (ssn, ein) are decrypted here — never persist this object.
 */

export type LoanApplication = {
  id: string
  application_number: string | null
  status: string | null
  submitted_at: string | null
  applicant_signed_date: string | null

  // Primary borrower identity
  applicant_email: string | null
  applicant_phone: string | null
  applicant_first_name: string | null
  applicant_middle_name: string | null
  applicant_last_name: string | null
  applicant_name_suffix: string | null
  applicant_dob: string | null
  applicant_ssn: string | null                    // DECRYPTED at fetch time
  applicant_citizenship_type: string | null
  applicant_marital_status: string | null
  applicant_dependent_count: number | null
  applicant_current_residence_basis: string | null
  applicant_current_residence_months: number | null
  credit_score_exact: number | null
  credit_score_range: string | null

  // Contact
  contact_address: string | null
  contact_city: string | null
  contact_state: string | null
  contact_zip: string | null

  // Vesting / entity
  vesting_type: string | null
  entity_legal_name: string | null
  entity_org_type: string | null
  entity_state_of_formation: string | null
  entity_formation_date: string | null
  entity_ein: string | null                       // DECRYPTED
  entity_address: string | null
  entity_city: string | null
  entity_state: string | null
  entity_zip: string | null

  // Loan terms
  loan_amount: number | null
  loan_purpose: string | null
  mortgage_type: string | null
  lien_priority: string | null
  note_amount: number | null
  note_rate_percent: number | null
  note_date: string | null
  loan_term_months: number | null
  amortization_type: string | null
  interest_only: boolean | null
  balloon: boolean | null
  has_prepay_penalty: boolean | null
  total_mortgaged_properties_count: number | null
  properties_financed_by_lender_count: number | null
  arms_length: boolean | null
  is_renovation_loan: boolean | null
  is_hpml: boolean | null
  has_escrow: boolean | null

  // Subject property
  property_address: string | null
  property_city: string | null
  property_state: string | null
  property_zip: string | null
  property_county: string | null
  fips_state: string | null
  fips_county: string | null
  census_tract: string | null
  property_value: number | null
  property_usage_type: string | null
  current_occupancy_type: string | null
  financed_unit_count: number | null
  construction_method: string | null
  construction_status: string | null
  year_built: number | null
  gross_living_area_sqft: number | null
  acreage: number | null
  attachment_type: string | null
  is_pud: boolean | null
  mixed_use: boolean | null
  deed_restriction: boolean | null
  property_acquired_date: string | null
  property_original_cost: number | null
  property_existing_lien_amount: number | null

  // Rental income (DSCR)
  rental_gross_monthly: number | null
  rental_net_monthly: number | null
  rental_monthly_cashflow: number | null
  rental_occupancy_pct: number | null
  lease_rent_monthly: number | null
  lease_expiration_date: string | null
  dscr_ratio: number | null
  dscr_rent_source: string | null
  is_short_term_rental: boolean | null

  // PITIA
  annual_property_tax: number | null
  hazard_insurance_monthly: number | null
  hoa_monthly: number | null
  flood_insurance_monthly: number | null
  property_mgmt_fee_monthly: number | null

  // Deal structure (bridge / hard money)
  renovation_costs: number | null
  anticipated_arv: number | null
  flood_zone: boolean | null
  project_summary: string | null
  exit_strategy: string | null
  funds_available_for_project: number | null
  target_closing_date: string | null
  target_closing_reason: string | null

  // Originator
  originator_nmls_individual: string | null
  originator_first_name: string | null
  originator_last_name: string | null
  originator_nmls_company: string | null

  // Appraisal
  appraised_value: number | null
  appraisal_date: string | null
  appraisal_form_type: string | null
  appraisal_method: string | null
  appraiser_license_id: string | null
  uad_document_file_id: string | null

  // HMDA
  hmda_ethnicity: string[] | null
  hmda_race: string[] | null
  hmda_gender: string | null
  hmda_ethnicity_refused: boolean | null
  hmda_race_refused: boolean | null

  // Attestations
  credit_report_authorization_indicator: boolean | null

  // Generator output (writebacks)
  mismo_xml_url: string | null
  mismo_generated_at: string | null
  fnm_url: string | null
  fnm_generated_at: string | null
  mismo_xml_path: string | null
  fnm_path: string | null
}

export type LoanBorrower = {
  id: string
  role: 'CoBorrower' | 'Guarantor'
  classification_type: 'Primary' | 'Secondary' | null
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  name_suffix: string | null
  dob: string | null
  ssn: string | null                               // DECRYPTED
  citizenship_type: string | null
  marital_status: string | null
  email: string | null
  phone: string | null
  current_address: string | null
  current_city: string | null
  current_state: string | null
  current_zip: string | null
  residency_basis: string | null
  residency_months: number | null
  credit_score_exact: number | null
  signed_date: string | null
  joint_with_primary: boolean | null
}

export type LoanDeclaration = {
  id: string
  borrower_id: string | null           // NULL = primary borrower
  intent_to_occupy: boolean
  homeowner_past_3yrs: boolean | null
  bankruptcy: boolean
  bankruptcy_chapter: string | null
  bankruptcy_filed_date: string | null
  bankruptcy_discharged_date: string | null
  outstanding_judgments: boolean
  party_to_lawsuit: boolean
  presently_delinquent_federal_debt: boolean
  undisclosed_borrowed_funds: boolean
  undisclosed_borrowed_funds_amount: number | null
  undisclosed_mortgage_application: boolean
  undisclosed_credit_application: boolean
  undisclosed_comaker: boolean
  prior_deed_in_lieu: boolean
  prior_short_sale: boolean
  prior_foreclosure: boolean
  proposed_clean_energy_lien: boolean
  special_borrower_seller_relationship: boolean | null
}

export type LoanLiability = {
  id: string
  owner_party: string
  liability_type: string
  account_identifier: string | null
  unpaid_balance_amount: number
  monthly_payment_amount: number
  holder_name: string | null
  remaining_term_months: number | null
  payoff_at_close: boolean | null
  excluded_from_dti: boolean | null
  payment_includes_ti: boolean | null
  mortgage_type: string | null
  heloc_maximum_balance: number | null
  linked_reo_property_id: string | null
}

export type LoanAsset = {
  id: string
  owner_party: string
  asset_type: string
  account_identifier: string | null
  holder_name: string | null
  account_type: string | null
  cash_or_market_value_amount: number
  net_value_amount: number | null
  verified: boolean | null
  liquidity_indicator: boolean | null
  funds_source_type: string | null
  description: string | null
}

export type LoanReoProperty = {
  id: string
  is_subject: boolean
  disposition_status: string
  usage_type: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
  county: string | null
  present_market_value: number
  lien_upb_amount: number
  monthly_mortgage_payment: number
  monthly_maintenance_expense: number
  monthly_rental_income_gross: number
  monthly_rental_income_net: number
  unit_count: number
  property_acquired_date: string | null
  property_original_cost: number | null
}

/**
 * Aggregated object passed to the Handlebars template.
 * Contains computed/derived fields so the template doesn't do logic.
 */
export type LoanData = {
  loan: LoanApplication
  borrowers: LoanBorrower[]        // does NOT include primary; primary lives on loan.*
  declarations: LoanDeclaration[]
  liabilities: LoanLiability[]
  assets: LoanAsset[]
  reo_properties: LoanReoProperty[]

  // Computed
  borrower_count: number
  has_entity_borrower: boolean
  has_guarantor: boolean
  primary_declaration: LoanDeclaration | null
  total_liabilities_monthly_payment: number
  total_monthly_proposed_housing_expense: number
  generated_at: string           // ISO-8601 timestamp
  mismo_version: string          // '3.4.032420160128'
  origin_company: {
    name: string                 // 'Preme Home Loans LLC'
    nmls: string
    address: string
    city: string
    state: string
    zip: string
    phone: string
  }
}

export class MISMOValidationError extends Error {
  public readonly violations: string[]
  constructor(violations: string[]) {
    super(`MISMO XML failed XSD validation with ${violations.length} violation(s):\n${violations.join('\n')}`)
    this.name = 'MISMOValidationError'
    this.violations = violations
  }
}
