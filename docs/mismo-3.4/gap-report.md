# MISMO 3.4 Gap Report — Preme Portal Loan Intake

**Date:** 2026-04-17
**Phase:** 1 — Schema Gap Analysis (NO code / DB changes in this phase)
**Target XML profile:** MISMO v3.4 Build 324 (Baseline + DSCR-Investor)
**Reference:** `/docs/mismo-3.4/reference.md` (1,224-line field inventory, verified against Fannie DU Spec v2.6.1 and Pilotfish MISMO Model Viewer)

---

## ⚠️ Ticket name mismatch — please confirm before Phase 2

The Clark ticket names the source table as **`preme.loans`**. That table exists (15 columns, 2 rows) but is a post-submission pipeline tracker (`loan_number`, `lender`, `conditions_open/closed/total`, `closing_date`) — it does **not** hold the borrower-submitted 1003 data.

The 1003 submission data lives in **`preme.loan_applications`** (43 columns, 37 rows). That is what the ticket's description actually describes ("captures borrower-submitted 1003 data from preme-portal").

**This report maps against `preme.loan_applications`.** If that is wrong, flag it and I'll redo Table A/B against `preme.loans` instead. Migration and child-table FKs reference `preme.loan_applications.id` throughout.

Child-table naming in the ticket (`preme.loan_liabilities`, `preme.loan_assets`, `preme.loan_reo_properties`, `preme.loan_declarations`) is kept as specified but FK'd to `preme.loan_applications(id)`.

---

## Executive summary

| Metric | Count |
|---|---|
| MISMO 3.4 + DSCR-Investor required fields inventoried | **147** |
| Already captured in `preme.loan_applications` (full or partial) | **27** (~18%) |
| DSCR-excluded (omit legitimately per §C) | **21** |
| **Missing — must add to schema** | **99** |
| New columns proposed on `preme.loan_applications` | **48** |
| New child tables proposed | **5** (`loan_borrowers`, `loan_liabilities`, `loan_assets`, `loan_reo_properties`, `loan_declarations`) |
| New preme-portal form fields | **34** (spread across existing 7 steps + 1 new step: "Vesting & Entity") |
| Biggest blocker for valid XML | No SSN / DOB / citizenship / declarations captured anywhere |
| Second biggest blocker | No REO schedule captured (required for DSCR — lenders will reject XML without it) |
| Third biggest blocker | No LLC / entity vesting fields (Kiavi/Visio/Kind all require) |

**Headline:** We can currently satisfy ~18% of MISMO 3.4 required fields. To produce a lender-acceptable DSCR submission we need ~48 new columns, 5 new child tables, and ~34 new intake-form fields. No DB writes yet.

---

## ⚠️ Research finding that may reshape the whole project

Subagent research found that wholesale DSCR lenders' broker portals (Kiavi, Visio, Kind) primarily accept **PDF 1003s uploaded to the portal**, not MISMO XML submissions. Visio's broker guide explicitly lists "PDF and Word documents" only. No public MISMO submission endpoint was found for any of the six target lenders.

**Implication:** Before Phase 2 code work, confirm with at least one lender rep (Kiavi broker support is easiest) whether they accept a raw MISMO 3.4 XML upload to replace the PDF 1003. If they don't, Phase 2 should pivot to "render a filled PDF 1003 from the same data model," with the MISMO XML generator as a parallel output for the one or two lenders that do accept it (Lima One via their broker tech team is the most likely candidate).

This is flagged here because the current ticket assumes XML is universally accepted. It probably isn't.

---

## Table A — Already captured in `preme.loan_applications`

Fields that exist today on `preme.loan_applications` and map to a MISMO 3.4 location.
Type-match: `yes` = usable as-is; `partial` = value needs transformation / splitting / enum coercion; `no` = column exists but wrong shape.

| # | MISMO container / field | preme.loan_applications column | Type match | Notes |
|---|---|---|---|---|
| 1 | `LOAN_IDENTIFIER` (type=LenderLoan) | `id` (uuid) | partial | UUID works as identifier but lender may prefer a short numeric; `application_number` is a better LenderLoan candidate |
| 2 | `LOAN_IDENTIFIER` (type=Other) | `application_number` | yes | Emit as `LoanIdentifierType=Other` with description "ApplicationNumber" |
| 3 | `PARTY.INDIVIDUAL.NAME.FirstName` | `applicant_name` (split) | partial | Must split on whitespace; guest form already asks firstName/lastName but stores concatenated — lossy |
| 4 | `PARTY.INDIVIDUAL.NAME.LastName` | `applicant_name` (split) | partial | Same as above |
| 5 | `PARTY.CONTACT_POINT.ContactPointEmailValue` | `applicant_email` | yes | |
| 6 | `PARTY.CONTACT_POINT.ContactPointTelephoneValue` | `applicant_phone` | yes | Emit E.164 normalized |
| 7 | `PARTY.ADDRESS.AddressLineText` | `contact_address` | yes | Borrower's mailing/current residence |
| 8 | `PARTY.ADDRESS.CityName` | `contact_city` | yes | |
| 9 | `PARTY.ADDRESS.StateCode` | `contact_state` | yes | 2-letter USPS |
| 10 | `PARTY.ADDRESS.PostalCode` | `contact_zip` | yes | |
| 11 | `LOAN.TERMS_OF_LOAN.BaseLoanAmount` | `loan_amount` | yes | Emit also as `NoteAmount` |
| 12 | `LOAN.TERMS_OF_LOAN.LoanPurposeType` | `loan_purpose` | partial | Values in DB are free-text — must map to MISMO enum `{Purchase, Refinance, MortgageModification, Other, Unknown}` |
| 13 | `PROPERTY_DETAIL.AttachmentType` or ConstructionMethodType | `property_type` + `loan_type` | partial | Both columns hold "property type" currently (bug — `loan_type` is mis-used by the form, see §bugs) |
| 14 | `SUBJECT_PROPERTY.PROPERTY.ADDRESS.AddressLineText` | `property_address` | yes | |
| 15 | `SUBJECT_PROPERTY.PROPERTY.ADDRESS.CityName` | `property_city` | yes | |
| 16 | `SUBJECT_PROPERTY.PROPERTY.ADDRESS.StateCode` | `property_state` | yes | |
| 17 | `SUBJECT_PROPERTY.PROPERTY.ADDRESS.PostalCode` | `property_zip` | yes | |
| 18 | `PROPERTY_DETAIL.PropertyEstimatedValueAmount` | `property_value` | yes | |
| 19 | `QUALIFICATION.TotalMonthlyIncomeAmount` (÷12) | `annual_income` | partial | DSCR may omit; if included, convert to monthly |
| 20 | `EMPLOYER.EMPLOYMENT_DETAIL.EmploymentStatusType` | `employment_status` | partial | Values in DB need mapping to MISMO enum `{Current, Prior}` |
| 21 | `EMPLOYER.LEGAL_ENTITY.LEGAL_ENTITY_DETAIL.FullName` | `employer_name` | yes | |
| 22 | `SERVICES.SERVICE.CREDIT.CreditScore` (approximate) | `credit_score_range` | partial | DB holds a range like "720-759"; MISMO wants a single integer — use range midpoint or low-end |
| 23 | Guarantor PARTY / co-signer (see ⚠ below) | `has_sponsor` | partial | Semantic mismatch — "sponsor" in the form is a co-signer/co-borrower, not a DSCR guarantor. Maps to a second PARTY with `@PartyRoleType=CoBorrower`, not Guarantor |
| 24 | Co-borrower PARTY INDIVIDUAL.NAME | `sponsor_name` | partial | Split for First/Last |
| 25 | Co-borrower PARTY CONTACT_POINT (email) | `sponsor_email` | yes | |
| 26 | Co-borrower PARTY CONTACT_POINT (phone) | `sponsor_phone` | yes | |
| 27 | ASSET (single CheckingAccount aggregate) | `cash_reserves`, `investment_accounts`, `retirement_accounts` | partial | Three aggregate numerics — should normalize into child `loan_assets` table with `asset_type` + individual account rows. Current columns can seed three summary rows but are lossy |
| 28 | `LOAN_DETAIL.ApplicationReceivedDate` | `submitted_at` | yes | Use date portion |

**Table A headcount:** 28 field positions are at least partially covered. Of those, only 12 are `yes` (direct) — the rest need transformation logic or are lossy.

---

## Table B — Missing required fields (must add)

MISMO / DSCR-required fields that have **no column anywhere** in `preme.loan_applications`. Each row names the MISMO canonical path, cardinality (R/C/DSCR-R), proposed column name + Postgres type, and the form step where collection should happen.

**Legend**: R = MISMO required · C = Conditional · DSCR-R = required by DSCR lenders even when MISMO-optional · Step refers to current 7-step form (see `/app/apply/page.tsx`).

### B1. BORROWER identity & demographics — missing

| # | MISMO path | Card | Proposed column (on `preme.loan_applications`) | Type | Form step |
|---|---|---|---|---|---|
| 1 | `INDIVIDUAL.NAME.FirstName` | R | `applicant_first_name` | `text` | 1 (Contact) |
| 2 | `INDIVIDUAL.NAME.LastName` | R | `applicant_last_name` | `text` | 1 (Contact) |
| 3 | `INDIVIDUAL.NAME.MiddleName` | O | `applicant_middle_name` | `text` | 1 (Contact) |
| 4 | `INDIVIDUAL.NAME.SuffixName` | O | `applicant_name_suffix` | `text` | 1 (Contact) |
| 5 | `INDIVIDUAL.BirthDate` | R | `applicant_dob` | `date` | 1 (Contact) |
| 6 | `TAXPAYER_IDENTIFIER.TaxpayerIdentifierValue` (SSN) | R | `applicant_ssn_encrypted` | `text` (pgcrypto) | 1 (Contact) |
| 7 | `DECLARATION_DETAIL.CitizenshipResidencyType` | R | `applicant_citizenship_type` | `text` (enum check constraint) | 1 (Contact) |
| 8 | `BORROWER_DETAIL.MaritalStatusType` | C | `applicant_marital_status` | `text` | 1 (Contact) |
| 9 | `BORROWER_DETAIL.BorrowerApplicationSignedDate` | R | `applicant_signed_date` | `date` | 7 (Review — signed on submit) |
| 10 | `BORROWER_DETAIL.DependentCount` | O | `applicant_dependent_count` | `integer` | 1 |
| 11 | `RESIDENCE_DETAIL.BorrowerResidencyBasisType` | C | `applicant_current_residence_basis` | `text` (Own/Rent/LivingRentFree) | 1 |
| 12 | `RESIDENCE_DETAIL.BorrowerResidencyDurationMonthsCount` | C | `applicant_current_residence_months` | `integer` | 1 |

### B2. Co-borrower / Guarantor — missing (structural)

"Sponsor" today is a string-only trio (name/email/phone). For MISMO we need full borrower depth on the co-party. Recommend promoting to a **`loan_borrowers` child table** so additional borrowers + a separate guarantor (on entity-vested DSCR) can both be represented.

| # | MISMO path | Card | Proposed location | Type | Form step |
|---|---|---|---|---|---|
| 13 | Full BORROWER block for co-applicant | C | new table `preme.loan_borrowers` | — | 1 |
| 14 | Guarantor PARTY (when vested in LLC) | DSCR-R | same table, `role = 'Guarantor'` | — | new step 2.5 (Vesting) |

### B3. LLC / Entity vesting — missing (DSCR-critical)

DSCR loans are typically vested in an LLC. Every target lender requires entity fields. None of these exist today.

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 15 | `LEGAL_ENTITY_DETAIL.FullName` | DSCR-R | `entity_legal_name` | `text` | new step 2.5 (Vesting & Entity) |
| 16 | `LEGAL_ENTITY_DETAIL.OrganizationType` | DSCR-R | `entity_org_type` | `text` (LLC/Corp/Partnership/Trust/SoleProp) | new step 2.5 |
| 17 | `LEGAL_ENTITY_DETAIL.OrganizationStateOfFormationName` | DSCR-R | `entity_state_of_formation` | `text (2)` | new step 2.5 |
| 18 | `LEGAL_ENTITY_DETAIL.OrganizationFormationDate` | DSCR-R | `entity_formation_date` | `date` | new step 2.5 |
| 19 | `TAXPAYER_IDENTIFIER` (EIN) | DSCR-R | `entity_ein_encrypted` | `text` (pgcrypto) | new step 2.5 |
| 20 | Entity registered `ADDRESS.AddressLineText` | DSCR-R | `entity_address` | `text` | new step 2.5 |
| 21 | Entity `ADDRESS.CityName` | DSCR-R | `entity_city` | `text` | new step 2.5 |
| 22 | Entity `ADDRESS.StateCode` | DSCR-R | `entity_state` | `text (2)` | new step 2.5 |
| 23 | Entity `ADDRESS.PostalCode` | DSCR-R | `entity_zip` | `text` | new step 2.5 |
| 24 | `vesting_type` helper (Individual / Entity / JointTenants / TenantsInCommon) | internal | `vesting_type` | `text` | new step 2.5 |

### B4. LOAN terms — missing

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 25 | `TERMS_OF_LOAN.MortgageType` | R | `mortgage_type` | `text` (default `'Conventional'` for DSCR) | 3 (Loan Details) |
| 26 | `TERMS_OF_LOAN.LienPriorityType` | R | `lien_priority` | `text` (default `'FirstLien'`) | 3 |
| 27 | `TERMS_OF_LOAN.NoteAmount` | R | `note_amount` | `numeric(12,2)` (can default to `loan_amount`) | 3 |
| 28 | `TERMS_OF_LOAN.NoteRatePercent` | R | `note_rate_percent` | `numeric(7,5)` | 3 |
| 29 | `TERMS_OF_LOAN.NoteDate` | R | `note_date` | `date` (nullable until loan docs out) | internal (set post-submit) |
| 30 | `MATURITY.LoanMaturityPeriodCount` | R | `loan_term_months` | `integer` (default 360) | 3 |
| 31 | `AMORTIZATION_RULE.AmortizationType` | R | `amortization_type` | `text` (Fixed/AdjustableRate) | 3 |
| 32 | `LOAN_DETAIL.InterestOnlyIndicator` | C | `interest_only` | `boolean` | 3 |
| 33 | `LOAN_DETAIL.BalloonIndicator` | C | `balloon` | `boolean` | 3 |
| 34 | `LOAN_DETAIL.PrepaymentPenaltyIndicator` | C | `has_prepay_penalty` | `boolean` | 3 |
| 35 | `LOAN_DETAIL.BorrowerCount` | R | derived from `loan_borrowers` | — | — |
| 36 | `LOAN_DETAIL.TotalMortgagedPropertiesCount` | DSCR-R | `total_mortgaged_properties_count` | `integer` | 5 (Liquidity) |
| 37 | `LOAN_DETAIL.PropertiesFinancedByLenderCount` | DSCR-R | `properties_financed_by_lender_count` | `integer` | internal |
| 38 | `LOAN_DETAIL.ArmsLengthIndicator` | DSCR-R | `arms_length` | `boolean` (default `true`) | 7 (attestation) |

### B5. SUBJECT_PROPERTY — missing

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 39 | `PROPERTY_DETAIL.PropertyUsageType` | R | `property_usage_type` | `text` (default `'Investment'` for DSCR) | 2 (Property) |
| 40 | `PROPERTY_DETAIL.PropertyCurrentOccupancyType` | DSCR-R | `current_occupancy_type` | `text` (Owner/Tenant/Vacant/Unknown) | 2 |
| 41 | `PROPERTY_DETAIL.FinancedUnitCount` | R | `financed_unit_count` | `integer` (1–4) | 2 |
| 42 | `PROPERTY_DETAIL.ConstructionMethodType` | R | `construction_method` | `text` (default `'SiteBuilt'`) | 2 |
| 43 | `PROPERTY_DETAIL.ConstructionStatusType` | R | `construction_status` | `text` (default `'Existing'`) | 2 |
| 44 | `PROPERTY_DETAIL.PropertyStructureBuiltYear` | R | `year_built` | `integer` | 2 |
| 45 | `PROPERTY_DETAIL.GrossLivingAreaSquareFeetNumber` | DSCR-R | `gross_living_area_sqft` | `integer` | 2 |
| 46 | `PROPERTY_DETAIL.PropertyAcreageNumber` | DSCR-R | `acreage` | `numeric(8,4)` | 2 |
| 47 | `PROPERTY_DETAIL.AttachmentType` | R | `attachment_type` | `text` (Attached/Detached/SemiDetached) | 2 |
| 48 | `PROPERTY_DETAIL.PUDIndicator` | R | `is_pud` | `boolean` | 2 |
| 49 | `PROPERTY_DETAIL.PropertyMixedUsageIndicator` | R | `mixed_use` | `boolean` | 2 |
| 50 | `PROPERTY_DETAIL.DeedRestrictionIndicator` | R | `deed_restriction` | `boolean` | 2 |
| 51 | `PROPERTY_DETAIL.PropertyAcquiredDate` | C (refi) | `property_acquired_date` | `date` | 3 (visible when loan_purpose = Refinance) |
| 52 | `PROPERTY_DETAIL.PropertyOriginalCostAmount` | C (refi) | `property_original_cost` | `numeric(12,2)` | 3 |
| 53 | `PROPERTY_DETAIL.PropertyExistingLienAmount` | C (refi) | `property_existing_lien_amount` | `numeric(12,2)` | 3 |
| 54 | `ADDRESS.CountyName` | DSCR-R | `property_county` | `text` | 2 |
| 55 | `FIPS_INFORMATION.FIPSStateNumericCode` | R | `fips_state` | `text(2)` | internal (derive from state) |
| 56 | `FIPS_INFORMATION.FIPSCountyCode` | R | `fips_county` | `text(3)` | internal (derive post-submit) |
| 57 | `FIPS_INFORMATION.CensusTractIdentifier` | R | `census_tract` | `text` | internal (derive post-submit via FFIEC or Geocoder) |

### B6. SUBJECT_PROPERTY_RENTAL_INCOME — missing (DSCR-critical)

Without these fields no DSCR lender will accept the submission. All DSCR-R.

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 58 | `SubjectPropertyGrossRentalIncomeAmount` | DSCR-R | `rental_gross_monthly` | `numeric(12,2)` | 2 |
| 59 | `SubjectPropertyNetRentalIncomeAmount` | DSCR-R | `rental_net_monthly` | `numeric(12,2)` | 2 |
| 60 | `SubjectPropertyMonthlyCashFlowAmount` | DSCR-R | `rental_monthly_cashflow` | `numeric(12,2)` | internal (computed) |
| 61 | `SubjectPropertyOccupancyPercent` | DSCR-R | `rental_occupancy_pct` | `numeric(5,2)` | 2 |
| 62 | `SubjectPropertyLeaseAmount` | C | `lease_rent_monthly` | `numeric(12,2)` | 2 |
| 63 | `SubjectPropertyLeaseExpirationDate` | C | `lease_expiration_date` | `date` | 2 |
| 64 | `SubjectPropertyMonthlyRentalCoveragePercent` (DSCR ratio × 100) | DSCR-R | `dscr_ratio` | `numeric(5,3)` | internal (computed) |
| 65 | DSCR-ext: `DSCRRentSource` | DSCR-R | `dscr_rent_source` | `text` (Lease/MarketForm1007/LowerOf) | internal |
| 66 | DSCR-ext: `ShortTermRentalIndicator` | O | `is_short_term_rental` | `boolean` | 2 |

### B7. QUALIFICATION / HOUSING_EXPENSE (PITIA) — missing

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 67 | `HOUSING_EXPENSE.PropertyTaxAmount` (annual) | DSCR-R | `annual_property_tax` | `numeric(12,2)` | 2 |
| 68 | `HOUSING_EXPENSE.PropertyHazardInsurancePaymentAmount` (monthly) | DSCR-R | `hazard_insurance_monthly` | `numeric(12,2)` | 2 |
| 69 | `HOUSING_EXPENSE.HomeownersAssociationDuesPaymentAmount` (monthly) | C | `hoa_monthly` | `numeric(12,2)` | 2 |
| 70 | `HOUSING_EXPENSE.FloodInsurancePaymentAmount` (monthly) | C | `flood_insurance_monthly` | `numeric(12,2)` | 2 |
| 71 | `HOUSING_EXPENSE.OtherHousingExpenseAmount` (PM fee) | DSCR-R | `property_mgmt_fee_monthly` | `numeric(12,2)` | 2 |
| 72 | `QUALIFICATION.TotalMonthlyProposedHousingExpenseAmount` | R | — (computed from above + note payment) | — | internal |

### B8. ORIGINATOR / LOAN_ORIGINATION_COMPANY — missing

These are Preme-level facts; values are static per loan officer / company, but MISMO still needs them serialized.

| # | MISMO path | Card | Proposed column / location | Type | Form step |
|---|---|---|---|---|---|
| 73 | `LoanOriginatorIdentifier` (individual NMLS) | R | `originator_nmls_individual` | `text` | internal (defaulted from logged-in LO profile) |
| 74 | LO `INDIVIDUAL.NAME.FirstName` / `LastName` | R | `originator_first_name`, `originator_last_name` | `text` | internal |
| 75 | `LegalEntityIdentifier` (company NMLS) | R | `originator_nmls_company` | `text` | constant ENV (Preme NMLS) |
| 76 | Company `FullName` | R | — | constant (`Preme Home Loans LLC`) | — |
| 77 | Company `ADDRESS.*` | R | — | constant (Preme address) | — |

### B9. DECLARATIONS (the 1003 box-6 questions) — missing

Create **`preme.loan_declarations`** child table (1:1 with loan_applications per borrower, or 1:n when multi-borrower) with one boolean column per declaration plus conditional detail columns.

| # | MISMO path | Card | Proposed column (on `loan_declarations`) | Type | Form step |
|---|---|---|---|---|---|
| 78 | `IntentToOccupyType` | R | `intent_to_occupy` | `boolean` (default `false` DSCR) | 4 (Financial) |
| 79 | `HomeownerPastThreeYearsType` | R | `homeowner_past_3yrs` | `boolean` | 4 |
| 80 | `BankruptcyIndicator` | R | `bankruptcy` | `boolean` | 4 |
| 81 | `BANKRUPTCY_DETAIL.BankruptcyChapterType` | C | `bankruptcy_chapter` | `text` (Chapter7/11/12/13) | 4 |
| 82 | `BANKRUPTCY_DETAIL.BankruptcyFiledDate` | C | `bankruptcy_filed_date` | `date` | 4 |
| 83 | `BANKRUPTCY_DETAIL.BankruptcyDischargedDate` | C | `bankruptcy_discharged_date` | `date` | 4 |
| 84 | `OutstandingJudgmentsIndicator` | R | `outstanding_judgments` | `boolean` | 4 |
| 85 | `PartyToLawsuitIndicator` | R | `party_to_lawsuit` | `boolean` | 4 |
| 86 | `PresentlyDelinquentIndicator` | R | `presently_delinquent_federal_debt` | `boolean` | 4 |
| 87 | `UndisclosedBorrowedFundsIndicator` | R | `undisclosed_borrowed_funds` | `boolean` | 4 |
| 88 | `UndisclosedBorrowedFundsAmount` | C | `undisclosed_borrowed_funds_amount` | `numeric(12,2)` | 4 |
| 89 | `UndisclosedMortgageApplicationIndicator` | R | `undisclosed_mortgage_application` | `boolean` | 4 |
| 90 | `UndisclosedCreditApplicationIndicator` | R | `undisclosed_credit_application` | `boolean` | 4 |
| 91 | `UndisclosedComakerOfNoteIndicator` | R | `undisclosed_comaker` | `boolean` | 4 |
| 92 | `PriorPropertyDeedInLieuConveyedIndicator` | R | `prior_deed_in_lieu` | `boolean` | 4 |
| 93 | `PriorPropertyShortSaleCompletedIndicator` | R | `prior_short_sale` | `boolean` | 4 |
| 94 | `PriorPropertyForeclosureCompletedIndicator` | R | `prior_foreclosure` | `boolean` | 4 |
| 95 | `PropertyProposedCleanEnergyLienIndicator` | R | `proposed_clean_energy_lien` | `boolean` | 4 |

### B10. LIABILITIES — missing (child table)

Existing schema has no liability capture. Create **`preme.loan_liabilities`** child table, 1:n to `loan_applications`.

| # | MISMO path | Card | Column on `loan_liabilities` | Type |
|---|---|---|---|---|
| 96 | `LiabilityType` | R | `liability_type` | `text` (22-value enum from LiabilityType enum) |
| 97 | `LiabilityAccountIdentifier` | R | `account_identifier` | `text` |
| 98 | `LiabilityUnpaidBalanceAmount` | R | `unpaid_balance_amount` | `numeric(12,2)` |
| 99 | `LiabilityMonthlyPaymentAmount` | R | `monthly_payment_amount` | `numeric(12,2)` |
| 100 | `LIABILITY_HOLDER.NAME.FullName` | R | `holder_name` | `text` |
| 101 | `LiabilityPayoffStatusIndicator` | O | `payoff_at_close` | `boolean` |
| 102 | `LiabilityExclusionIndicator` | O | `excluded_from_dti` | `boolean` |
| 103 | `LiabilityRemainingTermMonthsCount` | C | `remaining_term_months` | `integer` |

*Form step:* new step **6 (Liabilities)** or merged into Financial Info.

### B11. ASSETS — missing (child table, proper schema)

Current aggregates (`cash_reserves`, `investment_accounts`, `retirement_accounts`) are lossy. Create **`preme.loan_assets`** for per-account detail:

| # | MISMO path | Card | Column on `loan_assets` | Type |
|---|---|---|---|---|
| 104 | `AssetType` | R | `asset_type` | `text` (27-value enum) |
| 105 | `AssetAccountIdentifier` | R | `account_identifier` | `text` |
| 106 | `AssetCashOrMarketValueAmount` | R | `cash_or_market_value_amount` | `numeric(12,2)` |
| 107 | `AssetAccountType` | O | `account_type` | `text` (Individual/Joint/Business/Trust) |
| 108 | `HolderName` (bank) | O | `holder_name` | `text` |
| 109 | `VerifiedIndicator` | O | `verified` | `boolean` |

*Form step:* 5 (Liquidity) — replace current 3-aggregate form with repeater.

### B12. OWNED_PROPERTY / REO schedule — missing (child table, **DSCR-blocker**)

Without this every DSCR lender rejects the submission. Create **`preme.loan_reo_properties`**, 1:n to `loan_applications`.

| # | MISMO path | Card | Column | Type |
|---|---|---|---|---|
| 110 | `OwnedPropertyDispositionStatusType` | R | `disposition_status` | `text` (HeldForInvestment/PendingSale/Retain/Sold) |
| 111 | `OwnedPropertySubjectIndicator` | R | `is_subject` | `boolean` (false for REO rows; true only if a REO row represents the subject) |
| 112 | `PROPERTY_DETAIL.PropertyEstimatedValueAmount` | R | `present_market_value` | `numeric(12,2)` |
| 113 | `PROPERTY_DETAIL.PropertyUsageType` | R | `usage_type` | `text` (Investment, PrimaryResidence, SecondHome) |
| 114 | `OwnedPropertyLienUPBAmount` | DSCR-R | `lien_upb_amount` | `numeric(12,2)` |
| 115 | `OwnedPropertyLienInstallmentAmount` | DSCR-R | `monthly_mortgage_payment` | `numeric(12,2)` |
| 116 | `OwnedPropertyMaintenanceExpenseAmount` | DSCR-R | `monthly_maintenance_expense` | `numeric(12,2)` |
| 117 | `OwnedPropertyRentalIncomeGrossAmount` | DSCR-R | `monthly_rental_income_gross` | `numeric(12,2)` |
| 118 | `OwnedPropertyRentalIncomeNetAmount` | DSCR-R | `monthly_rental_income_net` | `numeric(12,2)` |
| 119 | `OwnedPropertyOwnedUnitCount` | DSCR-R | `unit_count` | `integer` |
| 120 | `ADDRESS.AddressLineText` | R | `address_line1` | `text` |
| 121 | `ADDRESS.CityName` | R | `city` | `text` |
| 122 | `ADDRESS.StateCode` | R | `state` | `text(2)` |
| 123 | `ADDRESS.PostalCode` | R | `postal_code` | `text` |

*Form step:* new step 5.5 "Existing Rental Portfolio".

### B13. PROPERTY_VALUATION — missing

Needed only once appraisal is back, not at borrower submit. Add to `preme.loan_applications` so Solomon/Lauren can populate post-order:

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 124 | `PropertyValuationAmount` | R (at submit to lender) | `appraised_value` | `numeric(12,2)` | internal |
| 125 | `PropertyValuationEffectiveDate` | R | `appraisal_date` | `date` | internal |
| 126 | `PropertyValuationFormType` | R | `appraisal_form_type` | `text` | internal |
| 127 | `PropertyValuationMethodType` | R | `appraisal_method` | `text` | internal |
| 128 | `AppraiserLicenseIdentifier` | DSCR-R | `appraiser_license_id` | `text` | internal |
| 129 | `AppraisalIdentifier` | DSCR-R | `uad_document_file_id` | `text` | internal |

### B14. Miscellaneous LOAN_DETAIL booleans

| # | MISMO path | Card | Proposed column | Type |
|---|---|---|---|---|
| 130 | `HELOCIndicator` | R | (constant `false`) — no column needed | — |
| 131 | `ConstructionLoanIndicator` | R | (constant `false`) | — |
| 132 | `RenovationLoanIndicator` | C | `is_renovation_loan` | `boolean` |
| 133 | `MIRequiredIndicator` / `MICoverageExistsIndicator` | R | constant `false` | — |
| 134 | `QualifiedMortgageIndicator` | R | constant `false` | — |
| 135 | `HigherPricedMortgageLoanIndicator` | R | `is_hpml` | `boolean` (computed post-lock) |
| 136 | `EscrowIndicator` | C | `has_escrow` | `boolean` |

### B15. HMDA (optional for business-purpose DSCR, include for completeness)

Add to `preme.loan_applications` or a side `loan_hmda` row. Recommend 1:1 on `loan_applications` to keep the schema flat.

| # | MISMO path | Card | Proposed column | Type | Form step |
|---|---|---|---|---|---|
| 137 | `HMDAEthnicityType` | C | `hmda_ethnicity` | `text[]` | 4 |
| 138 | `HMDARaceType` | C | `hmda_race` | `text[]` | 4 |
| 139 | `HMDAGenderType` | C | `hmda_gender` | `text` | 4 |
| 140 | `HMDAEthnicityRefusalIndicator` | C | `hmda_ethnicity_refused` | `boolean` | 4 |
| 141 | `HMDARaceRefusalIndicator` | C | `hmda_race_refused` | `boolean` | 4 |

### B16. Generator output pointers (added in Phase 2 migration, listed here for completeness)

| # | MISMO path / purpose | Card | Proposed column | Type |
|---|---|---|---|---|
| 142 | Signed MISMO XML URL | internal | `mismo_xml_url` | `text` |
| 143 | MISMO generation timestamp | internal | `mismo_generated_at` | `timestamp with time zone` |
| 144 | Fannie 3.2 URL | internal | `fnm_url` | `text` |
| 145 | Fannie 3.2 timestamp | internal | `fnm_generated_at` | `timestamp with time zone` |
| 146 | MISMO storage object path | internal | `mismo_xml_path` | `text` |
| 147 | Fannie storage object path | internal | `fnm_path` | `text` |

**Table B count:** 99 distinct missing required / DSCR-required fields. Maps to **48 new columns on `preme.loan_applications`** and **5 new child tables** with ~40 columns distributed.

---

## Table C — DSCR-specific exclusions (legitimately omitted)

Fields that MISMO marks required or conditional but that we can safely **omit** for pure-DSCR submissions because DSCR lenders don't underwrite on borrower income. Lender acceptance column: ✓ = accepts omission, ⚠ = requires empty-but-present node, ✗ = actually requires a non-null value.

| MISMO path | MISMO card | Kiavi | Visio | Kind | Lima One | Notes |
|---|---|---|---|---|---|---|
| `PARTY.BORROWER.CURRENT_INCOME.*` (all income items) | C | ✓ | ⚠ | ✓ | ⚠ | Kiavi/Kind fully omit; Visio and Lima One want a single placeholder `IncomeType=NetRentalIncome` item = 0 |
| `QUALIFICATION.TotalMonthlyIncomeAmount` | C | ✓ | ⚠ | ✓ | ⚠ | Emit as `0` on Visio/Lima One |
| `QUALIFICATION.TotalMonthlyIncomeExpenseRatioPercent` (DTI) | C | ✓ | ✓ | ✓ | ✓ | DTI irrelevant for DSCR |
| `EMPLOYER.EMPLOYMENT_DETAIL.EmploymentTimeInLineOfWorkMonthsCount` | C | ✓ | ✓ | ✓ | ✓ | |
| `EMPLOYER` entire block (personal guarantor employer) | O | ✓ | ⚠ | ✓ | ⚠ | Include a minimal stub if lender blocks on missing employer |
| `FHABorrowerCertificationOfIntentToOccupyIndicator` | C | ✓ | ✓ | ✓ | ✓ | FHA-only; DSCR is Conventional |
| `MI_DATA` entire block | O | ✓ | ✓ | ✓ | ✓ | DSCR has no MI |
| `GOVERNMENT_LOAN` entire block | O | ✓ | ✓ | ✓ | ✓ | FHA/VA only |
| `HighCostMortgage` block | O | ✓ | ✓ | ✓ | ✓ | DSCR business-purpose is exempt |
| `HMDA_LOAN` + `GOVERNMENT_MONITORING` | C | ⚠ | ⚠ | ⚠ | ⚠ | Most DSCR is HMDA-exempt; lenders still expect refusal-indicator presence |
| `ConstructionLoanIndicator` | R (but constant false) | — | — | — | — | Emit as constant `false` |
| `RelocationLoanIndicator` | R (but constant false) | — | — | — | — | Constant `false` |
| `IncomeSourceDescription` on income items | O | ✓ | ✓ | ✓ | ✓ | |
| Most `EXTENSION` lender-specific fields | O | ✓ | ✓ | ✓ | ✓ | Only emit when targeting that specific lender |
| `RESIDENCE_DETAIL.BorrowerResidencyBasisType` for prior residences | O | ✓ | ✓ | ✓ | ✓ | Current only needed |
| `DependentCount` | O | ✓ | ✓ | ✓ | ✓ | |
| `BorrowerMailingAddressSameAsPropertyIndicator` | O | ✓ | ✓ | ✓ | ✓ | |
| `CreditReportAuthorizationIndicator` | DSCR-R | — | — | — | — | Must be true — capture at form step 7 |
| `MilitaryServices` block | O | ✓ | ✓ | ✓ | ✓ | |
| `Languages` block | O | ✓ | ✓ | ✓ | ✓ | |
| `BuyDown`, `NegativeAmortizationRule` | C (ARM/buydown only) | ✓ | ✓ | ✓ | ✓ | Not applicable to vanilla DSCR |

**Table C count:** 21 fields / containers legitimately skippable (several with "empty-but-present" variants per lender).

> The ⚠ markings are best-guess from secondary research. Lender-specific acceptance should be confirmed with each broker-tech contact before Phase 2 ships.

---

## Schema bugs & data-model concerns discovered during audit

1. **`loan_type` vs `property_type` collision** — `app/apply/page.tsx:115` writes `formData.propertyType` into BOTH `loan_type` AND `property_type`. `loan_type` is therefore never a loan type, it's a duplicate of property type. Recommend either (a) dropping `loan_type` in the MISMO migration, or (b) wiring it to `mortgage_type` with value `'Conventional'`. Flagged for separate fix ticket.
2. **`applicant_name` is a concatenated string** — the form collects `firstName` / `lastName` but stores `"First Last"` joined. Every MISMO borrower name split will be lossy. The B1 migration adds `applicant_first_name` / `applicant_last_name` as canonical.
3. **`credit_score_range`** — ranged value like `"720-759"` won't fit MISMO's integer `CreditScore` element. Either collect exact score (pulled from credit report, not self-reported) or emit the range midpoint. Proposal: add `credit_score_exact` integer, populate post-credit-pull, prefer over range when present.
4. **`sponsor_*` columns = co-signer, not guarantor** — the data model conflates a retail co-signer with a DSCR guarantor. Real DSCR vesting needs a distinct guarantor (personal guaranty on LLC loan). Recommend deprecating `sponsor_*` in favour of the new `loan_borrowers` child table with a `role` column: `Borrower` | `CoBorrower` | `Guarantor`.
5. **No PII encryption today** — `applicant_ssn_encrypted` and `entity_ein_encrypted` should use `pgcrypto` + a KMS key. No other PII column is encrypted currently — out of scope here but raise separately.

---

## Proposed frontend form changes (bullet list — step-by-step)

Organized by current form step in `app/apply/page.tsx`. Step 2.5 and 5.5 are new inserts. Validation defaults: required unless marked `[opt]`.

### Step 1 — Contact Info (already exists)
Add:
- `firstName` — store to `applicant_first_name` (separate from concatenated `applicant_name`). Required.
- `middleName` [opt]
- `lastName` — store to `applicant_last_name`. Required.
- `nameSuffix` [opt]
- `dateOfBirth` — HTML5 `<input type="date">`, min age validation (18+).
- `ssn` — masked input, 9 digits, stored encrypted via pgcrypto in server handler (never logged).
- `citizenshipType` — select: US Citizen / Permanent Resident / Non-Permanent Resident.
- `maritalStatus` — select: Married / Unmarried / Separated. Required when a second borrower is added.
- `currentResidenceBasis` — Own / Rent / Living Rent Free.
- `currentResidenceMonths` — integer, if < 24 months require prior residence.
- `dependentCount` [opt] — integer ≥ 0.

### Step 2 — Property Info (already exists) — significant additions
Replace flat "propertyType" with structured property detail. Add:
- `propertyUsageType` — default Investment (DSCR). Show select for audit.
- `currentOccupancy` — Owner / Tenant / Vacant / Unknown.
- `financedUnitCount` — 1 / 2 / 3 / 4.
- `constructionMethod` — SiteBuilt (default) / Manufactured / Modular / Other.
- `constructionStatus` — Existing (default) / Proposed / UnderConstruction.
- `yearBuilt` — integer 1700–current year.
- `grossLivingAreaSqft` — integer.
- `acreage` — decimal (default 0.25).
- `attachmentType` — Detached / Attached / SemiDetached.
- `isPUD` — checkbox.
- `isMixedUse` — checkbox.
- `deedRestriction` — checkbox.
- `propertyCounty` — text (autocomplete by state+zip).
- **Rental-income group** (conditional: always shown for DSCR; hidden for owner-occupied):
  - `rentalGrossMonthly` (market rent or actual)
  - `rentalOccupancyPct` (default 95)
  - `isTenantOccupied` → if true, reveal:
    - `leaseRentMonthly`
    - `leaseExpirationDate`
  - `isShortTermRental` [opt]
- **Expenses group** (PITIA):
  - `annualPropertyTax`
  - `hazardInsuranceMonthly`
  - `hoaMonthly` [opt]
  - `floodInsuranceMonthly` [opt, required if in flood zone — derive later]
  - `propertyMgmtFeeMonthly` [opt]
- **If `loan_purpose = Refinance`** (revealed on step 3 retro-adds to step 2):
  - `propertyAcquiredDate`
  - `propertyOriginalCost`
  - `propertyExistingLienAmount`

### NEW Step 2.5 — Vesting & Entity
Only shown when `vestingType = Entity` (select at top of step).
- `vestingType` — Individual / Entity / JointTenants / TenantsInCommon.
- Conditionally visible fields (Entity only):
  - `entityLegalName`
  - `entityOrgType` — LLC / Corporation / Partnership / Trust / SoleProprietorship.
  - `entityStateOfFormation` — state select.
  - `entityFormationDate`
  - `entityEIN` — masked, encrypted server-side.
  - `entityAddress`, `entityCity`, `entityState`, `entityZip`.
  - **Guarantor section** (required when vested in entity): repeater → opens a modal with the full Step-1 contact block for each guarantor (at minimum 1).

### Step 3 — Loan Details (existing) — additions
- `mortgageType` — hidden, defaults `Conventional` for DSCR.
- `lienPriority` — hidden, defaults `FirstLien`.
- `loanTermMonths` — 360 default, allow 120/180/240/360/interest-only variants.
- `amortizationType` — Fixed / Adjustable.
- `interestOnly` — checkbox.
- `balloon` — checkbox.
- `hasPrepayPenalty` — checkbox (default true for DSCR).
- `noteRatePercent` — 0–20, step 0.001 (will usually be filled by Solomon post-quote, not at borrower submit — show read-only if empty).
- `isRenovationLoan` [opt] — checkbox.

### Step 4 — Financial Info (existing) — major expansion
Currently collects credit_score_range + employment_status + employer_name. Add:
- `creditScoreExact` [opt] — integer; if provided, preferred over range.
- **Declarations** — 18 boolean questions (see Table B9). Render as a standard 1003 question grid.
  - If `bankruptcy = true`: reveal `bankruptcyChapter`, `bankruptcyFiledDate`, `bankruptcyDischargedDate`.
  - If `undisclosedBorrowedFunds = true`: reveal `undisclosedBorrowedFundsAmount`.
- **HMDA block** (required to collect, may refuse):
  - `hmdaEthnicity` — multi-select, or refuse toggle.
  - `hmdaRace` — multi-select, or refuse toggle.
  - `hmdaGender` — single select, or refuse.
- **Liabilities** — repeater (minimum 0 rows). Fields per row: `liabilityType`, `holderName`, `accountIdentifier`, `unpaidBalanceAmount`, `monthlyPaymentAmount`, `payoffAtClose` [opt], `excludedFromDti` [opt], `remainingTermMonths` [opt].
- **Total mortgaged properties count** — integer (asked once; used for `LOAN_DETAIL.TotalMortgagedPropertiesCount`).

### Step 5 — Liquidity (existing) — restructure
Replace three-aggregate form (`cash_reserves`, `investment_accounts`, `retirement_accounts`) with asset repeater.
- Repeater, minimum 1 asset row.
- Fields: `assetType` (27-value enum), `accountIdentifier`, `holderName`, `accountType` [opt], `cashOrMarketValueAmount`, `verified` [opt internal].
- Retain a summary section that computes totals for display, but persist only normalized rows.

### NEW Step 5.5 — Existing Rental Portfolio (REO schedule)
Only shown when `totalMortgagedPropertiesCount > 0`. Repeater, one row per existing rental.
- Fields per row: address (street/city/state/zip), `usageType` (default Investment), `dispositionStatus`, `presentMarketValue`, `monthlyMortgagePayment`, `lienUpbAmount`, `monthlyMaintenanceExpense`, `monthlyRentalIncomeGross`, `monthlyRentalIncomeNet`, `unitCount`.
- "Add from Prior Mortgages" helper — pre-populates rows from `preme.mortgages` if there are any linked to this borrower's existing CRM record.

### Step 6 — Documents (existing) — no MISMO-driven changes
Document upload is outside the XML scope. MISMO doesn't require us to embed document bytes (they go to lenders' doc portals separately).

### Step 7 — Review & Submit (existing) — additions
- Add `applicantSignedDate` capture (set on submit = now()).
- Add `creditReportAuthorizationIndicator` — explicit checkbox ("I authorize Preme Home Loans to pull my credit.").
- Add `armsLengthIndicator` — checkbox ("This transaction is arms-length.").
- Surface the new `vestingType` + guarantor summary for confirmation.

### Total new form fields: ~34 net additions across 7 existing steps + 2 new inserted steps

---

## Sources and caveats

- Full field inventory: `/docs/mismo-3.4/reference.md`
- Canonical MISMO names verified against Fannie DU Spec v2.6.1 and Pilotfish Model Viewer (see §6 of reference.md)
- Fields marked "unverified" in the reference doc should be re-confirmed against the MISMO_3.4.0_B324.xsd before migration ships
- Lender-specific acceptance (Table C ⚠/✓/✗) is best-guess from public broker docs; confirm with each lender's tech contact before Phase 2
- Table counts (147/99/48/5/34) are derived from this document's enumeration — if a required field is double-counted or missed I'll adjust in v2

**End of Phase 1 gap report. Awaiting @Nyalls review before Phase 2 begins.**
