import { create } from "xmlbuilder2"
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces"
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
 * Produce MISMO 3.4 XML as a UTF-8 string.
 *
 * Structure follows Fannie DU Spec v2.6.1 (MISMO v3.4 B324):
 *   MESSAGE > DEAL_SETS > DEAL_SET > DEALS > DEAL >
 *     { ASSETS, COLLATERALS, LIABILITIES, LOANS, PARTIES, RELATIONSHIPS }
 *
 * Borrowers, originators, and the entity borrower all live in PARTIES and
 * reference the LOAN via RELATIONSHIP xlink arcroles.
 */
export function renderMISMO(data: LoanData): string {
  const { loan, borrowers, reo_properties, origin_company } = data

  // Unique xlink labels — used by RELATIONSHIP arcroles later
  const LOAN_LABEL = "LOAN_1"
  const PROPERTY_LABEL = "SUBJECT_PROPERTY_1"
  const LO_INDIV_LABEL = "PARTY_LO_INDIVIDUAL_1"
  const LO_CO_LABEL = "PARTY_LO_COMPANY_1"
  const PRIMARY_BORROWER_LABEL = "PARTY_BORROWER_1"
  const ENTITY_LABEL = "PARTY_ENTITY_1"

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("MESSAGE", {
    xmlns: "http://www.mismo.org/residential/2009/schemas",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    MISMOReferenceModelIdentifier: data.mismo_version,
  })

  // ABOUT_VERSIONS
  const avs = root.ele("ABOUT_VERSIONS")
  const av = avs.ele("ABOUT_VERSION")
  av.ele("AboutVersionIdentifier").txt("Preme MISMO 3.4 Generator v1")
  av.ele("CreatedDatetime").txt(data.generated_at)
  av.ele("DataVersionName").txt("MISMO v3.4 B324")

  // DEAL_SETS > DEAL_SET > DEALS > DEAL
  const deal = root.ele("DEAL_SETS").ele("DEAL_SET").ele("DEALS").ele("DEAL")

  renderAssets(deal, data, PRIMARY_BORROWER_LABEL)
  renderCollaterals(deal, loan, PROPERTY_LABEL)
  renderLiabilities(deal, data.liabilities)
  renderLoans(deal, data, LOAN_LABEL)
  renderParties(deal, data, {
    LOAN_LABEL,
    LO_INDIV_LABEL,
    LO_CO_LABEL,
    PRIMARY_BORROWER_LABEL,
    ENTITY_LABEL,
  })
  renderRelationships(deal, data, {
    LOAN_LABEL,
    PROPERTY_LABEL,
    LO_INDIV_LABEL,
    LO_CO_LABEL,
    PRIMARY_BORROWER_LABEL,
    ENTITY_LABEL,
  })

  // Placeholder for lender-specific extensions
  root.com(" LENDER_EXTENSIONS — injected per-lender in lib/mismo/extensions/<lender>.ts ")

  return root.end({ prettyPrint: true })
}

// ---------------------------------------------------------------------------
// LOANS
// ---------------------------------------------------------------------------

function renderLoans(parent: XMLBuilder, data: LoanData, loanLabel: string): void {
  const { loan } = data
  const loans = parent.ele("LOANS")
  const ln = loans.ele("LOAN", {
    "xlink:label": loanLabel,
    LoanRoleType: "SubjectLoan",
    SequenceNumber: "1",
  })

  // LOAN_IDENTIFIERS
  const ids = ln.ele("LOAN_IDENTIFIERS")
  putId(ids, loan.application_number ?? loan.id, "LenderLoan")
  if (loan.application_number && loan.application_number !== loan.id) {
    putId(ids, loan.id, "Other", "ApplicationUUID")
  }

  // TERMS_OF_LOAN
  const terms = ln.ele("TERMS_OF_LOAN")
  setText(terms, "AssumabilityIndicator", "false")
  setText(terms, "BaseLoanAmount", num(loan.loan_amount))
  setText(terms, "LienPriorityType", loan.lien_priority ?? "FirstLien")
  setText(terms, "LoanPurposeType", mapLoanPurpose(loan.loan_purpose))
  setText(terms, "MortgageType", loan.mortgage_type ?? "Conventional")
  setText(terms, "NoteAmount", num(loan.note_amount ?? loan.loan_amount))
  setText(terms, "NoteDate", isoDate(loan.note_date))
  setText(terms, "NoteRatePercent", num(loan.note_rate_percent, 5))

  // LOAN_DETAIL (core flags)
  const detail = ln.ele("LOAN_DETAIL")
  setText(detail, "ApplicationReceivedDate", isoDate(loan.submitted_at))
  setText(detail, "ArmsLengthIndicator", bool(loan.arms_length ?? true))
  setText(detail, "BalloonIndicator", bool(loan.balloon))
  setText(detail, "BorrowerCount", String(data.borrower_count))
  setText(detail, "ConstructionLoanIndicator", "false")
  setText(detail, "HELOCIndicator", "false")
  setText(detail, "HigherPricedMortgageLoanIndicator", bool(loan.is_hpml ?? false))
  setText(detail, "InterestOnlyIndicator", bool(loan.interest_only))
  setText(detail, "MICoverageExistsIndicator", "false")
  setText(detail, "MIRequiredIndicator", "false")
  setText(detail, "PrepaymentPenaltyIndicator", bool(loan.has_prepay_penalty))
  setText(detail, "PropertiesFinancedByLenderCount", num(loan.properties_financed_by_lender_count ?? 0, 0))
  setText(detail, "QualifiedMortgageIndicator", "false")
  setText(detail, "RelocationLoanIndicator", "false")
  setText(detail, "RenovationLoanIndicator", bool(loan.is_renovation_loan))
  setText(detail, "TotalMortgagedPropertiesCount", num(loan.total_mortgaged_properties_count ?? 0, 0))

  // MATURITY
  if (loan.loan_term_months) {
    const mat = ln.ele("MATURITY").ele("MATURITY_RULE")
    setText(mat, "LoanMaturityPeriodCount", String(loan.loan_term_months))
    setText(mat, "LoanMaturityPeriodType", "Month")
  }

  // AMORTIZATION
  const amort = ln.ele("AMORTIZATION").ele("AMORTIZATION_RULE")
  setText(amort, "AmortizationType", loan.amortization_type ?? "Fixed")
  setText(amort, "LoanAmortizationPeriodCount", String(loan.loan_term_months ?? 360))
  setText(amort, "LoanAmortizationPeriodType", "Month")

  // QUALIFICATION
  const qual = ln.ele("QUALIFICATION")
  setText(qual, "TotalLiabilitiesMonthlyPaymentAmount", num(data.total_liabilities_monthly_payment))
  setText(qual, "TotalMonthlyIncomeAmount", num(0)) // DSCR — no personal income qualification
  setText(qual, "TotalMonthlyProposedHousingExpenseAmount", num(data.total_monthly_proposed_housing_expense))

  // SUBJECT_PROPERTY_RENTAL_INCOME (DSCR-critical)
  if (loan.rental_gross_monthly || loan.dscr_ratio) {
    const rent = ln.ele("SUBJECT_PROPERTY_RENTAL_INCOME")
    setText(rent, "SubjectPropertyGrossRentalIncomeAmount", num(loan.rental_gross_monthly))
    setText(rent, "SubjectPropertyNetRentalIncomeAmount", num(loan.rental_net_monthly))
    setText(rent, "SubjectPropertyMonthlyCashFlowAmount", num(loan.rental_monthly_cashflow))
    setText(rent, "SubjectPropertyOccupancyPercent", num(loan.rental_occupancy_pct, 2))
    if (loan.lease_rent_monthly) setText(rent, "SubjectPropertyLeaseAmount", num(loan.lease_rent_monthly))
    if (loan.lease_expiration_date) setText(rent, "SubjectPropertyLeaseExpirationDate", isoDate(loan.lease_expiration_date))
    if (loan.dscr_ratio) setText(rent, "SubjectPropertyMonthlyRentalCoveragePercent", num(Number(loan.dscr_ratio) * 100, 2))
  }

  // HOUSING_EXPENSES
  const expenses = ln.ele("HOUSING_EXPENSES")
  addExpense(expenses, "HazardInsurance", loan.hazard_insurance_monthly)
  addExpense(expenses, "RealEstateTax", loan.annual_property_tax ? Number(loan.annual_property_tax) / 12 : null)
  addExpense(expenses, "HomeownersAssociationDuesOrCondominiumFee", loan.hoa_monthly)
  addExpense(expenses, "FloodInsurance", loan.flood_insurance_monthly)
  addExpense(expenses, "OtherHousingExpense", loan.property_mgmt_fee_monthly, "PropertyManagementFee")
}

function addExpense(parent: XMLBuilder, type: string, amount: number | null, description?: string): void {
  if (!amount || Number(amount) <= 0) return
  const exp = parent.ele("HOUSING_EXPENSE")
  setText(exp, "HousingExpenseType", type)
  if (description && type === "OtherHousingExpense") {
    setText(exp, "HousingExpenseTypeOtherDescription", description)
  }
  setText(exp, "HousingExpensePaymentAmount", num(amount))
  setText(exp, "HousingExpenseTimingType", "Present")
}

// ---------------------------------------------------------------------------
// COLLATERALS
// ---------------------------------------------------------------------------

function renderCollaterals(parent: XMLBuilder, loan: LoanApplication, propertyLabel: string): void {
  const col = parent.ele("COLLATERALS").ele("COLLATERAL")
  const subj = col.ele("SUBJECT_PROPERTY", { "xlink:label": propertyLabel })
  const prop = subj.ele("PROPERTY")

  // ADDRESS
  const addresses = prop.ele("ADDRESSES")
  const addr = addresses.ele("ADDRESS")
  setText(addr, "AddressLineText", loan.property_address)
  setText(addr, "CityName", loan.property_city)
  setText(addr, "StateCode", loan.property_state)
  setText(addr, "PostalCode", loan.property_zip)
  if (loan.property_county) setText(addr, "CountyName", loan.property_county)
  setText(addr, "CountryCode", "US")

  // LOCATION_IDENTIFIER > FIPS_INFORMATION
  if (loan.fips_state || loan.census_tract) {
    const fips = prop.ele("LOCATION_IDENTIFIER").ele("FIPS_INFORMATION")
    if (loan.fips_state) setText(fips, "FIPSStateNumericCode", loan.fips_state)
    if (loan.fips_county) setText(fips, "FIPSCountyCode", loan.fips_county)
    if (loan.census_tract) setText(fips, "CensusTractIdentifier", loan.census_tract)
  }

  // PROPERTY_DETAIL
  const pd = prop.ele("PROPERTY_DETAIL")
  setText(pd, "AttachmentType", loan.attachment_type ?? "Detached")
  setText(pd, "ConstructionMethodType", loan.construction_method ?? "SiteBuilt")
  setText(pd, "ConstructionStatusType", loan.construction_status ?? "Existing")
  setText(pd, "DeedRestrictionIndicator", bool(loan.deed_restriction ?? false))
  setText(pd, "FinancedUnitCount", String(loan.financed_unit_count ?? 1))
  if (loan.gross_living_area_sqft)
    setText(pd, "GrossLivingAreaSquareFeetNumber", String(loan.gross_living_area_sqft))
  setText(pd, "PropertyEstimatedValueAmount", num(loan.property_value))
  setText(pd, "PropertyMixedUsageIndicator", bool(loan.mixed_use ?? false))
  setText(pd, "PropertyUsageType", loan.property_usage_type ?? "Investment")
  if (loan.current_occupancy_type) setText(pd, "PropertyCurrentOccupancyType", loan.current_occupancy_type)
  if (loan.year_built) setText(pd, "PropertyStructureBuiltYear", String(loan.year_built))
  setText(pd, "PUDIndicator", bool(loan.is_pud ?? false))
  if (loan.acreage != null) setText(pd, "PropertyAcreageNumber", num(loan.acreage, 4))
  if (loan.property_acquired_date) setText(pd, "PropertyAcquiredDate", isoDate(loan.property_acquired_date))
  if (loan.property_original_cost) setText(pd, "PropertyOriginalCostAmount", num(loan.property_original_cost))
  if (loan.property_existing_lien_amount) setText(pd, "PropertyExistingLienAmount", num(loan.property_existing_lien_amount))

  // PROPERTY_VALUATIONS (if appraised)
  if (loan.appraised_value) {
    const vals = prop.ele("PROPERTY_VALUATIONS").ele("PROPERTY_VALUATION")
    const vd = vals.ele("PROPERTY_VALUATION_DETAIL")
    setText(vd, "PropertyValuationAmount", num(loan.appraised_value))
    setText(vd, "PropertyValuationEffectiveDate", isoDate(loan.appraisal_date))
    setText(vd, "PropertyValuationFormType", loan.appraisal_form_type ?? "FNMA1004")
    setText(vd, "PropertyValuationMethodType", loan.appraisal_method ?? "FullAppraisal")
    if (loan.appraiser_license_id) setText(vd, "AppraiserLicenseIdentifier", loan.appraiser_license_id)
    if (loan.uad_document_file_id) setText(vd, "AppraisalIdentifier", loan.uad_document_file_id)
  }
}

// ---------------------------------------------------------------------------
// ASSETS
// ---------------------------------------------------------------------------

function renderAssets(parent: XMLBuilder, data: LoanData, ownerLabel: string): void {
  const assets = parent.ele("ASSETS")

  for (const a of data.assets) {
    const asset = assets.ele("ASSET")
    const ad = asset.ele("ASSET_DETAIL")
    setText(ad, "AssetType", a.asset_type)
    if (a.asset_type === "Other") setText(ad, "AssetTypeOtherDescription", a.description ?? "OtherAsset")
    if (a.account_identifier) setText(ad, "AssetAccountIdentifier", a.account_identifier)
    if (a.account_type) setText(ad, "AssetAccountType", a.account_type)
    setText(ad, "AssetCashOrMarketValueAmount", num(a.cash_or_market_value_amount))
    if (a.net_value_amount != null) setText(ad, "AssetNetValueAmount", num(a.net_value_amount))
    if (a.verified != null) setText(ad, "VerifiedIndicator", bool(a.verified))

    if (a.holder_name) {
      const holder = asset.ele("ASSET_HOLDER").ele("NAME")
      setText(holder, "FullName", a.holder_name)
    }
  }

  // REO schedule: each existing rental = one ASSET with OWNED_PROPERTY child
  for (const reo of data.reo_properties.filter((r) => !r.is_subject)) {
    const asset = assets.ele("ASSET")
    const owned = asset.ele("OWNED_PROPERTY")
    const od = owned.ele("OWNED_PROPERTY_DETAIL")
    setText(od, "OwnedPropertyDispositionStatusType", reo.disposition_status)
    setText(od, "OwnedPropertySubjectIndicator", bool(reo.is_subject))
    setText(od, "OwnedPropertyLienInstallmentAmount", num(reo.monthly_mortgage_payment))
    setText(od, "OwnedPropertyLienUPBAmount", num(reo.lien_upb_amount))
    setText(od, "OwnedPropertyMaintenanceExpenseAmount", num(reo.monthly_maintenance_expense))
    setText(od, "OwnedPropertyOwnedUnitCount", String(reo.unit_count))
    setText(od, "OwnedPropertyRentalIncomeGrossAmount", num(reo.monthly_rental_income_gross))
    setText(od, "OwnedPropertyRentalIncomeNetAmount", num(reo.monthly_rental_income_net))

    const prop = owned.ele("PROPERTY")
    const pd = prop.ele("PROPERTY_DETAIL")
    setText(pd, "PropertyEstimatedValueAmount", num(reo.present_market_value))
    setText(pd, "PropertyUsageType", reo.usage_type)
    if (reo.property_acquired_date) setText(pd, "PropertyAcquiredDate", isoDate(reo.property_acquired_date))
    if (reo.property_original_cost) setText(pd, "PropertyOriginalCostAmount", num(reo.property_original_cost))

    const addresses = prop.ele("ADDRESSES")
    const addr = addresses.ele("ADDRESS")
    setText(addr, "AddressLineText", reo.address_line1)
    if (reo.address_line2) setText(addr, "AddressAdditionalLineText", reo.address_line2)
    setText(addr, "CityName", reo.city)
    setText(addr, "StateCode", reo.state)
    setText(addr, "PostalCode", reo.postal_code)
    if (reo.county) setText(addr, "CountyName", reo.county)
    setText(addr, "CountryCode", "US")
  }
}

// ---------------------------------------------------------------------------
// LIABILITIES
// ---------------------------------------------------------------------------

function renderLiabilities(parent: XMLBuilder, liabilities: LoanLiability[]): void {
  if (liabilities.length === 0) return
  const libs = parent.ele("LIABILITIES")
  for (const l of liabilities) {
    const lib = libs.ele("LIABILITY")
    const ld = lib.ele("LIABILITY_DETAIL")
    setText(ld, "LiabilityType", l.liability_type)
    if (l.account_identifier) setText(ld, "LiabilityAccountIdentifier", l.account_identifier)
    setText(ld, "LiabilityUnpaidBalanceAmount", num(l.unpaid_balance_amount))
    setText(ld, "LiabilityMonthlyPaymentAmount", num(l.monthly_payment_amount))
    if (l.remaining_term_months) setText(ld, "LiabilityRemainingTermMonthsCount", String(l.remaining_term_months))
    if (l.payoff_at_close != null) setText(ld, "LiabilityPayoffStatusIndicator", bool(l.payoff_at_close))
    if (l.excluded_from_dti != null) setText(ld, "LiabilityExclusionIndicator", bool(l.excluded_from_dti))
    if (l.mortgage_type) setText(ld, "MortgageType", l.mortgage_type)
    if (l.heloc_maximum_balance != null) setText(ld, "HELOCMaximumBalanceAmount", num(l.heloc_maximum_balance))
    if (l.payment_includes_ti != null)
      setText(ld, "LiabilityPaymentIncludesTaxesInsuranceIndicator", bool(l.payment_includes_ti))

    if (l.holder_name) {
      const holder = lib.ele("LIABILITY_HOLDER").ele("NAME")
      setText(holder, "FullName", l.holder_name)
    }
  }
}

// ---------------------------------------------------------------------------
// PARTIES
// ---------------------------------------------------------------------------

type PartyLabels = {
  LOAN_LABEL: string
  LO_INDIV_LABEL: string
  LO_CO_LABEL: string
  PRIMARY_BORROWER_LABEL: string
  ENTITY_LABEL: string
}

function renderParties(parent: XMLBuilder, data: LoanData, labels: PartyLabels): void {
  const { loan, borrowers, primary_declaration, origin_company, has_entity_borrower } = data
  const parties = parent.ele("PARTIES")

  // 1. Primary individual borrower
  renderIndividualParty(parties, {
    label: labels.PRIMARY_BORROWER_LABEL,
    seq: "1",
    firstName: loan.applicant_first_name,
    middleName: loan.applicant_middle_name,
    lastName: loan.applicant_last_name,
    suffix: loan.applicant_name_suffix,
    dob: loan.applicant_dob,
    ssn: loan.applicant_ssn,
    citizenship: loan.applicant_citizenship_type,
    marital: loan.applicant_marital_status,
    email: loan.applicant_email,
    phone: loan.applicant_phone,
    address: loan.contact_address,
    city: loan.contact_city,
    state: loan.contact_state,
    zip: loan.contact_zip,
    residencyBasis: loan.applicant_current_residence_basis,
    residencyMonths: loan.applicant_current_residence_months,
    roleType: has_entity_borrower ? "Guarantor" : "Borrower",
    classification: "Primary",
    declaration: primary_declaration,
    signedDate: loan.applicant_signed_date,
  })

  // 2. Co-borrowers & guarantors
  for (let i = 0; i < borrowers.length; i++) {
    const b = borrowers[i]
    const label = `PARTY_${b.role.toUpperCase()}_${i + 2}`
    const relDecl = data.declarations.find((d) => d.borrower_id === b.id) ?? null
    renderIndividualParty(parties, {
      label,
      seq: String(i + 2),
      firstName: b.first_name,
      middleName: b.middle_name,
      lastName: b.last_name,
      suffix: b.name_suffix,
      dob: b.dob,
      ssn: b.ssn,
      citizenship: b.citizenship_type,
      marital: b.marital_status,
      email: b.email,
      phone: b.phone,
      address: b.current_address,
      city: b.current_city,
      state: b.current_state,
      zip: b.current_zip,
      residencyBasis: b.residency_basis,
      residencyMonths: b.residency_months,
      roleType: b.role,
      classification: b.classification_type ?? "Secondary",
      declaration: relDecl,
      signedDate: b.signed_date,
    })
  }

  // 3. Entity borrower (LLC)
  if (has_entity_borrower) {
    const ep = parties.ele("PARTY", { "xlink:label": labels.ENTITY_LABEL })
    const le = ep.ele("LEGAL_ENTITY").ele("LEGAL_ENTITY_DETAIL")
    setText(le, "FullName", loan.entity_legal_name)
    setText(le, "OrganizationType", loan.entity_org_type ?? "LLC")
    if (loan.entity_state_of_formation)
      setText(le, "OrganizationStateOfFormationName", loan.entity_state_of_formation)
    if (loan.entity_formation_date)
      setText(le, "OrganizationFormationDate", isoDate(loan.entity_formation_date))

    if (loan.entity_ein) {
      const tin = ep.ele("TAXPAYER_IDENTIFIERS").ele("TAXPAYER_IDENTIFIER")
      setText(tin, "TaxpayerIdentifierType", "EmployerIdentificationNumber")
      setText(tin, "TaxpayerIdentifierValue", sanitizeDigits(loan.entity_ein))
    }

    if (loan.entity_address) {
      const addr = ep.ele("ADDRESSES").ele("ADDRESS")
      setText(addr, "AddressLineText", loan.entity_address)
      setText(addr, "CityName", loan.entity_city)
      setText(addr, "StateCode", loan.entity_state)
      setText(addr, "PostalCode", loan.entity_zip)
      setText(addr, "CountryCode", "US")
    }

    const role = ep.ele("ROLES").ele("ROLE")
    role.ele("ROLE_DETAIL", { PartyRoleType: "Borrower" })
  }

  // 4. Loan Originator — individual
  const lo = parties.ele("PARTY", { "xlink:label": labels.LO_INDIV_LABEL })
  if (loan.originator_first_name || loan.originator_last_name) {
    const ind = lo.ele("INDIVIDUAL").ele("NAME")
    setText(ind, "FirstName", loan.originator_first_name)
    setText(ind, "LastName", loan.originator_last_name)
  }
  const loRole = lo.ele("ROLES").ele("ROLE")
  loRole.ele("ROLE_DETAIL", { PartyRoleType: "LoanOriginator" })
  if (loan.originator_nmls_individual) {
    const lod = loRole.ele("LOAN_ORIGINATOR").ele("LOAN_ORIGINATOR_DETAIL")
    setText(lod, "LoanOriginatorIdentifier", loan.originator_nmls_individual)
    setText(lod, "LoanOriginatorIdentifierType", "NationwideMortgageLicensingSystemAndRegistry")
  }

  // 5. Loan Origination Company
  const co = parties.ele("PARTY", { "xlink:label": labels.LO_CO_LABEL })
  const coLe = co.ele("LEGAL_ENTITY").ele("LEGAL_ENTITY_DETAIL")
  setText(coLe, "FullName", origin_company.name)
  if (origin_company.nmls) {
    const coId = co.ele("LEGAL_ENTITY").ele("LEGAL_ENTITY_IDENTIFIERS").ele("LEGAL_ENTITY_IDENTIFIER")
    setText(coId, "LegalEntityIdentifier", origin_company.nmls)
    setText(coId, "LegalEntityIdentifierType", "NationwideMortgageLicensingSystemAndRegistry")
  }
  if (origin_company.address) {
    const coAddr = co.ele("ADDRESSES").ele("ADDRESS")
    setText(coAddr, "AddressLineText", origin_company.address)
    setText(coAddr, "CityName", origin_company.city)
    setText(coAddr, "StateCode", origin_company.state)
    setText(coAddr, "PostalCode", origin_company.zip)
    setText(coAddr, "CountryCode", "US")
  }
  const coRole = co.ele("ROLES").ele("ROLE")
  coRole.ele("ROLE_DETAIL", { PartyRoleType: "LoanOriginationCompany" })
}

type PartyArgs = {
  label: string
  seq: string
  firstName: string | null
  middleName: string | null
  lastName: string | null
  suffix: string | null
  dob: string | null
  ssn: string | null
  citizenship: string | null
  marital: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  residencyBasis: string | null
  residencyMonths: number | null
  roleType: string                        // Borrower | CoBorrower | Guarantor
  classification: string
  declaration: LoanDeclaration | null
  signedDate: string | null
}

function renderIndividualParty(parties: XMLBuilder, p: PartyArgs): void {
  const party = parties.ele("PARTY", { "xlink:label": p.label, SequenceNumber: p.seq })

  // INDIVIDUAL / NAME
  const ind = party.ele("INDIVIDUAL")
  const name = ind.ele("NAME")
  setText(name, "FirstName", p.firstName)
  if (p.middleName) setText(name, "MiddleName", p.middleName)
  setText(name, "LastName", p.lastName)
  if (p.suffix) setText(name, "SuffixName", p.suffix)
  if (p.dob) setText(ind, "BirthDate", isoDate(p.dob))

  // TAXPAYER_IDENTIFIERS
  if (p.ssn) {
    const tin = party.ele("TAXPAYER_IDENTIFIERS").ele("TAXPAYER_IDENTIFIER")
    setText(tin, "TaxpayerIdentifierType", "SocialSecurityNumber")
    setText(tin, "TaxpayerIdentifierValue", sanitizeDigits(p.ssn))
  }

  // ADDRESSES
  if (p.address) {
    const addr = party.ele("ADDRESSES").ele("ADDRESS")
    setText(addr, "AddressLineText", p.address)
    setText(addr, "CityName", p.city)
    setText(addr, "StateCode", p.state)
    setText(addr, "PostalCode", p.zip)
    setText(addr, "CountryCode", "US")
  }

  // CONTACT_POINTS
  const cp = party.ele("CONTACT_POINTS")
  if (p.email) {
    const ce = cp.ele("CONTACT_POINT")
    setText(ce, "ContactPointRoleType", "Home")
    const ceDetail = ce.ele("CONTACT_POINT_EMAIL")
    setText(ceDetail, "ContactPointEmailValue", p.email)
  }
  if (p.phone) {
    const ct = cp.ele("CONTACT_POINT")
    setText(ct, "ContactPointRoleType", "Mobile")
    const ctDetail = ct.ele("CONTACT_POINT_TELEPHONE")
    setText(ctDetail, "ContactPointTelephoneValue", sanitizeDigits(p.phone))
  }

  // RESIDENCES
  if (p.address && p.residencyBasis) {
    const res = party.ele("RESIDENCES").ele("RESIDENCE")
    const rd = res.ele("RESIDENCE_DETAIL")
    setText(rd, "BorrowerResidencyType", "Current")
    setText(rd, "BorrowerResidencyBasisType", p.residencyBasis)
    if (p.residencyMonths != null) {
      setText(rd, "BorrowerResidencyDurationMonthsCount", String(p.residencyMonths))
    }
    const ra = res.ele("ADDRESS")
    setText(ra, "AddressLineText", p.address)
    setText(ra, "CityName", p.city)
    setText(ra, "StateCode", p.state)
    setText(ra, "PostalCode", p.zip)
    setText(ra, "CountryCode", "US")
  }

  // ROLES > ROLE
  const roles = party.ele("ROLES")
  const role = roles.ele("ROLE")
  const rd = role.ele("ROLE_DETAIL", { PartyRoleType: p.roleType })
  const bd = rd.ele("BORROWER_DETAIL")
  setText(bd, "BorrowerApplicationSignedDate", isoDate(p.signedDate))
  setText(bd, "BorrowerClassificationType", p.classification)
  setText(bd, "CreditReportAuthorizationIndicator", "true")
  if (p.marital) setText(bd, "MaritalStatusType", p.marital)

  // BORROWER > DECLARATIONS
  if (p.declaration) {
    const borr = role.ele("BORROWER")
    const decls = borr.ele("DECLARATIONS").ele("DECLARATION")
    const dd = decls.ele("DECLARATION_DETAIL")
    if (p.citizenship) setText(dd, "CitizenshipResidencyType", p.citizenship)
    setText(dd, "IntentToOccupyType", p.declaration.intent_to_occupy ? "Yes" : "No")
    if (p.declaration.homeowner_past_3yrs != null)
      setText(dd, "HomeownerPastThreeYearsType", p.declaration.homeowner_past_3yrs ? "Yes" : "No")
    setText(dd, "BankruptcyIndicator", bool(p.declaration.bankruptcy))
    setText(dd, "OutstandingJudgmentsIndicator", bool(p.declaration.outstanding_judgments))
    setText(dd, "PartyToLawsuitIndicator", bool(p.declaration.party_to_lawsuit))
    setText(dd, "PresentlyDelinquentIndicator", bool(p.declaration.presently_delinquent_federal_debt))
    setText(dd, "UndisclosedBorrowedFundsIndicator", bool(p.declaration.undisclosed_borrowed_funds))
    if (p.declaration.undisclosed_borrowed_funds && p.declaration.undisclosed_borrowed_funds_amount != null)
      setText(dd, "UndisclosedBorrowedFundsAmount", num(p.declaration.undisclosed_borrowed_funds_amount))
    setText(dd, "UndisclosedMortgageApplicationIndicator", bool(p.declaration.undisclosed_mortgage_application))
    setText(dd, "UndisclosedCreditApplicationIndicator", bool(p.declaration.undisclosed_credit_application))
    setText(dd, "UndisclosedComakerOfNoteIndicator", bool(p.declaration.undisclosed_comaker))
    setText(dd, "PriorPropertyDeedInLieuConveyedIndicator", bool(p.declaration.prior_deed_in_lieu))
    setText(dd, "PriorPropertyShortSaleCompletedIndicator", bool(p.declaration.prior_short_sale))
    setText(dd, "PriorPropertyForeclosureCompletedIndicator", bool(p.declaration.prior_foreclosure))
    setText(dd, "PropertyProposedCleanEnergyLienIndicator", bool(p.declaration.proposed_clean_energy_lien))

    if (p.declaration.bankruptcy && p.declaration.bankruptcy_chapter) {
      const bkd = decls.ele("BANKRUPTCY_DETAIL")
      setText(bkd, "BankruptcyChapterType", p.declaration.bankruptcy_chapter)
      if (p.declaration.bankruptcy_filed_date)
        setText(bkd, "BankruptcyFiledDate", isoDate(p.declaration.bankruptcy_filed_date))
      if (p.declaration.bankruptcy_discharged_date)
        setText(bkd, "BankruptcyDischargedDate", isoDate(p.declaration.bankruptcy_discharged_date))
    }
  }
}

// ---------------------------------------------------------------------------
// RELATIONSHIPS — XLink arcroles
// ---------------------------------------------------------------------------

function renderRelationships(parent: XMLBuilder, data: LoanData, labels: PartyLabels & { PROPERTY_LABEL: string }): void {
  const rels = parent.ele("RELATIONSHIPS")
  const URN = "urn:fdc:mismo.org:2009:residential"

  // primary borrower ↔ loan
  rels.ele("RELATIONSHIP", {
    "xlink:from": labels.PRIMARY_BORROWER_LABEL,
    "xlink:to": labels.LOAN_LABEL,
    "xlink:arcrole": `${URN}/PARTY_IsAssociatedWith_LOAN`,
  })

  // entity ↔ loan
  if (data.has_entity_borrower) {
    rels.ele("RELATIONSHIP", {
      "xlink:from": labels.ENTITY_LABEL,
      "xlink:to": labels.LOAN_LABEL,
      "xlink:arcrole": `${URN}/PARTY_IsAssociatedWith_LOAN`,
    })
  }

  // co-borrowers / guarantors ↔ loan
  for (let i = 0; i < data.borrowers.length; i++) {
    const b = data.borrowers[i]
    rels.ele("RELATIONSHIP", {
      "xlink:from": `PARTY_${b.role.toUpperCase()}_${i + 2}`,
      "xlink:to": labels.LOAN_LABEL,
      "xlink:arcrole": `${URN}/PARTY_IsAssociatedWith_LOAN`,
    })
  }

  // loan officer ↔ loan
  rels.ele("RELATIONSHIP", {
    "xlink:from": labels.LO_INDIV_LABEL,
    "xlink:to": labels.LOAN_LABEL,
    "xlink:arcrole": `${URN}/PARTY_IsAssociatedWith_LOAN`,
  })

  // origination company ↔ loan
  rels.ele("RELATIONSHIP", {
    "xlink:from": labels.LO_CO_LABEL,
    "xlink:to": labels.LOAN_LABEL,
    "xlink:arcrole": `${URN}/PARTY_IsAssociatedWith_LOAN`,
  })

  // subject property ↔ loan
  rels.ele("RELATIONSHIP", {
    "xlink:from": labels.PROPERTY_LABEL,
    "xlink:to": labels.LOAN_LABEL,
    "xlink:arcrole": `${URN}/PROPERTY_IsCollateralFor_LOAN`,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setText(parent: XMLBuilder, name: string, value: unknown): void {
  if (value == null || value === "") return
  parent.ele(name).txt(String(value))
}

function putId(parent: XMLBuilder, value: string, type: string, otherDesc?: string): void {
  const id = parent.ele("LOAN_IDENTIFIER")
  setText(id, "LoanIdentifier", value)
  setText(id, "LoanIdentifierType", type)
  if (otherDesc && type === "Other") setText(id, "LoanIdentifierTypeOtherDescription", otherDesc)
}

function num(v: number | string | null | undefined, dp: number = 2): string | null {
  if (v == null || v === "") return null
  const n = Number(v)
  if (!isFinite(n)) return null
  return n.toFixed(dp)
}

function bool(v: boolean | null | undefined): string {
  return v ? "true" : "false"
}

function isoDate(v: string | null | undefined): string | null {
  if (!v) return null
  // Accept timestamps; trim to date part
  return String(v).slice(0, 10)
}

function sanitizeDigits(v: string | null | undefined): string | null {
  if (!v) return null
  return String(v).replace(/\D/g, "")
}

function mapLoanPurpose(v: string | null): string {
  if (!v) return "Purchase"
  const normalized = String(v).toLowerCase()
  if (normalized.includes("purchase")) return "Purchase"
  if (normalized.includes("refi") || normalized.includes("refinance")) return "Refinance"
  if (normalized.includes("mod")) return "MortgageModification"
  return "Other"
}
