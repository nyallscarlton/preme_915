-- ============================================================================
--  MISMO 3.4 Gap Migration — Phase 1 DRAFT (DO NOT EXECUTE)
--  Date      : 2026-04-17
--  Ticket    : MISMO 3.4 XML Generator for Preme Portal (Phase 1)
--  Companion : /docs/mismo-3.4/gap-report.md
--  Target    : preme.loan_applications  (NOTE: ticket says "preme.loans" but
--              the 1003 submission table is loan_applications — see gap-report.md)
--
--  This migration adds 48 MISMO-required columns to preme.loan_applications
--  and creates 5 child tables for multi-valued MISMO containers.
--
--  All DDL is idempotent (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so
--  re-runs are safe. No data backfill — encrypted PII columns remain NULL
--  until the form captures them.
--
--  Execution plan (when approved):
--    1. Run this migration against Supabase Preme (hriipovloelnqrlwtswy).
--    2. Validate with `\d preme.loan_applications` and child-table introspection.
--    3. Update app/api/applications/*.ts to accept the new fields.
--    4. Roll out preme-portal form changes (see gap-report.md § Proposed frontend).
--    5. Backfill minimum required MISMO fields for existing 37 rows
--       (human-assisted — can't derive SSN/DOB from what we have).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Extensions (assumed present; enable if not)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- for SSN / EIN encryption helpers

-- ---------------------------------------------------------------------------
-- 1. preme.loan_applications — add MISMO-required columns
-- ---------------------------------------------------------------------------

-- B1 Borrower identity (primary applicant)
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS applicant_first_name       text,
  ADD COLUMN IF NOT EXISTS applicant_middle_name      text,
  ADD COLUMN IF NOT EXISTS applicant_last_name        text,
  ADD COLUMN IF NOT EXISTS applicant_name_suffix      text,
  ADD COLUMN IF NOT EXISTS applicant_dob              date,
  ADD COLUMN IF NOT EXISTS applicant_ssn_encrypted    text,  -- pgcrypto payload
  ADD COLUMN IF NOT EXISTS applicant_citizenship_type text,
  ADD COLUMN IF NOT EXISTS applicant_marital_status   text,
  ADD COLUMN IF NOT EXISTS applicant_signed_date      date,
  ADD COLUMN IF NOT EXISTS applicant_dependent_count  integer,
  ADD COLUMN IF NOT EXISTS applicant_current_residence_basis  text,
  ADD COLUMN IF NOT EXISTS applicant_current_residence_months integer,
  ADD COLUMN IF NOT EXISTS credit_score_exact         integer;

ALTER TABLE preme.loan_applications
  ADD CONSTRAINT loan_applications_citizenship_chk
    CHECK (applicant_citizenship_type IS NULL OR applicant_citizenship_type IN
      ('USCitizen','PermanentResidentAlien','NonPermanentResidentAlien','Other')) NOT VALID,
  ADD CONSTRAINT loan_applications_marital_chk
    CHECK (applicant_marital_status IS NULL OR applicant_marital_status IN
      ('Married','Unmarried','Separated')) NOT VALID,
  ADD CONSTRAINT loan_applications_residence_basis_chk
    CHECK (applicant_current_residence_basis IS NULL OR applicant_current_residence_basis IN
      ('Own','Rent','LivingRentFree')) NOT VALID;

-- B3 Vesting & Entity (DSCR-critical)
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS vesting_type              text,
  ADD COLUMN IF NOT EXISTS entity_legal_name         text,
  ADD COLUMN IF NOT EXISTS entity_org_type           text,
  ADD COLUMN IF NOT EXISTS entity_state_of_formation text,
  ADD COLUMN IF NOT EXISTS entity_formation_date     date,
  ADD COLUMN IF NOT EXISTS entity_ein_encrypted      text,
  ADD COLUMN IF NOT EXISTS entity_address            text,
  ADD COLUMN IF NOT EXISTS entity_city               text,
  ADD COLUMN IF NOT EXISTS entity_state              text,
  ADD COLUMN IF NOT EXISTS entity_zip                text;

ALTER TABLE preme.loan_applications
  ADD CONSTRAINT loan_applications_vesting_type_chk
    CHECK (vesting_type IS NULL OR vesting_type IN
      ('Individual','Entity','JointTenants','TenantsInCommon')) NOT VALID,
  ADD CONSTRAINT loan_applications_entity_org_type_chk
    CHECK (entity_org_type IS NULL OR entity_org_type IN
      ('LLC','Corporation','Partnership','Trust','SoleProprietorship','Other')) NOT VALID;

-- B4 Loan terms
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS mortgage_type                     text DEFAULT 'Conventional',
  ADD COLUMN IF NOT EXISTS lien_priority                     text DEFAULT 'FirstLien',
  ADD COLUMN IF NOT EXISTS note_amount                       numeric(12,2),
  ADD COLUMN IF NOT EXISTS note_rate_percent                 numeric(7,5),
  ADD COLUMN IF NOT EXISTS note_date                         date,
  ADD COLUMN IF NOT EXISTS loan_term_months                  integer DEFAULT 360,
  ADD COLUMN IF NOT EXISTS amortization_type                 text,
  ADD COLUMN IF NOT EXISTS interest_only                     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS balloon                           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_prepay_penalty                boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_mortgaged_properties_count  integer,
  ADD COLUMN IF NOT EXISTS properties_financed_by_lender_count integer,
  ADD COLUMN IF NOT EXISTS arms_length                       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_renovation_loan                boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hpml                           boolean,
  ADD COLUMN IF NOT EXISTS has_escrow                        boolean;

ALTER TABLE preme.loan_applications
  ADD CONSTRAINT loan_applications_mortgage_type_chk
    CHECK (mortgage_type IS NULL OR mortgage_type IN
      ('Conventional','FHA','VA','USDARuralDevelopment','LocalAgency','PublicAndIndian','Other')) NOT VALID,
  ADD CONSTRAINT loan_applications_lien_priority_chk
    CHECK (lien_priority IS NULL OR lien_priority IN
      ('FirstLien','SecondLien','ThirdLien','Other')) NOT VALID,
  ADD CONSTRAINT loan_applications_amortization_type_chk
    CHECK (amortization_type IS NULL OR amortization_type IN
      ('Fixed','AdjustableRate','GraduatedPayment','Step','Other')) NOT VALID;

-- B5 Subject property detail
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS property_usage_type           text DEFAULT 'Investment',
  ADD COLUMN IF NOT EXISTS current_occupancy_type        text,
  ADD COLUMN IF NOT EXISTS financed_unit_count           integer,
  ADD COLUMN IF NOT EXISTS construction_method           text DEFAULT 'SiteBuilt',
  ADD COLUMN IF NOT EXISTS construction_status           text DEFAULT 'Existing',
  ADD COLUMN IF NOT EXISTS year_built                    integer,
  ADD COLUMN IF NOT EXISTS gross_living_area_sqft        integer,
  ADD COLUMN IF NOT EXISTS acreage                       numeric(8,4),
  ADD COLUMN IF NOT EXISTS attachment_type               text,
  ADD COLUMN IF NOT EXISTS is_pud                        boolean,
  ADD COLUMN IF NOT EXISTS mixed_use                     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deed_restriction              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS property_acquired_date        date,
  ADD COLUMN IF NOT EXISTS property_original_cost        numeric(12,2),
  ADD COLUMN IF NOT EXISTS property_existing_lien_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS property_county               text,
  ADD COLUMN IF NOT EXISTS fips_state                    text,
  ADD COLUMN IF NOT EXISTS fips_county                   text,
  ADD COLUMN IF NOT EXISTS census_tract                  text;

ALTER TABLE preme.loan_applications
  ADD CONSTRAINT loan_applications_property_usage_chk
    CHECK (property_usage_type IS NULL OR property_usage_type IN
      ('Investment','PrimaryResidence','SecondHome','Other')) NOT VALID,
  ADD CONSTRAINT loan_applications_occupancy_chk
    CHECK (current_occupancy_type IS NULL OR current_occupancy_type IN
      ('Owner','Tenant','Vacant','Unknown')) NOT VALID,
  ADD CONSTRAINT loan_applications_construction_method_chk
    CHECK (construction_method IS NULL OR construction_method IN
      ('SiteBuilt','Manufactured','Modular','OnFrameModular','Container',
       'ThreeDimensionalPrintingTechnology','Other')) NOT VALID,
  ADD CONSTRAINT loan_applications_construction_status_chk
    CHECK (construction_status IS NULL OR construction_status IN
      ('Existing','Proposed','Subject','UnderConstruction')) NOT VALID,
  ADD CONSTRAINT loan_applications_attachment_chk
    CHECK (attachment_type IS NULL OR attachment_type IN
      ('Attached','Detached','SemiDetached')) NOT VALID,
  ADD CONSTRAINT loan_applications_financed_unit_count_chk
    CHECK (financed_unit_count IS NULL OR financed_unit_count BETWEEN 1 AND 4) NOT VALID;

-- B6 Subject-property rental income (DSCR-critical)
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS rental_gross_monthly        numeric(12,2),
  ADD COLUMN IF NOT EXISTS rental_net_monthly          numeric(12,2),
  ADD COLUMN IF NOT EXISTS rental_monthly_cashflow     numeric(12,2),
  ADD COLUMN IF NOT EXISTS rental_occupancy_pct        numeric(5,2) DEFAULT 95,
  ADD COLUMN IF NOT EXISTS lease_rent_monthly          numeric(12,2),
  ADD COLUMN IF NOT EXISTS lease_expiration_date       date,
  ADD COLUMN IF NOT EXISTS dscr_ratio                  numeric(5,3),
  ADD COLUMN IF NOT EXISTS dscr_rent_source            text,
  ADD COLUMN IF NOT EXISTS is_short_term_rental        boolean DEFAULT false;

ALTER TABLE preme.loan_applications
  ADD CONSTRAINT loan_applications_dscr_rent_source_chk
    CHECK (dscr_rent_source IS NULL OR dscr_rent_source IN
      ('Lease','MarketForm1007','LowerOf')) NOT VALID;

-- B7 PITIA breakdown
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS annual_property_tax          numeric(12,2),
  ADD COLUMN IF NOT EXISTS hazard_insurance_monthly    numeric(12,2),
  ADD COLUMN IF NOT EXISTS hoa_monthly                 numeric(12,2),
  ADD COLUMN IF NOT EXISTS flood_insurance_monthly     numeric(12,2),
  ADD COLUMN IF NOT EXISTS property_mgmt_fee_monthly   numeric(12,2);

-- B8 Originator (LO + company NMLS)
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS originator_nmls_individual  text,
  ADD COLUMN IF NOT EXISTS originator_first_name       text,
  ADD COLUMN IF NOT EXISTS originator_last_name        text,
  ADD COLUMN IF NOT EXISTS originator_nmls_company     text;

-- B13 Property valuation (filled post-appraisal)
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS appraised_value             numeric(12,2),
  ADD COLUMN IF NOT EXISTS appraisal_date              date,
  ADD COLUMN IF NOT EXISTS appraisal_form_type         text,
  ADD COLUMN IF NOT EXISTS appraisal_method            text,
  ADD COLUMN IF NOT EXISTS appraiser_license_id        text,
  ADD COLUMN IF NOT EXISTS uad_document_file_id        text;

-- B15 HMDA demographics
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS hmda_ethnicity             text[],
  ADD COLUMN IF NOT EXISTS hmda_race                  text[],
  ADD COLUMN IF NOT EXISTS hmda_gender                text,
  ADD COLUMN IF NOT EXISTS hmda_ethnicity_refused     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hmda_race_refused          boolean DEFAULT false;

-- Attestations
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS credit_report_authorization_indicator boolean DEFAULT false;

-- Indexes on commonly-joined new columns
CREATE INDEX IF NOT EXISTS loan_applications_vesting_type_idx
  ON preme.loan_applications (vesting_type);

CREATE INDEX IF NOT EXISTS loan_applications_property_usage_idx
  ON preme.loan_applications (property_usage_type);

-- ---------------------------------------------------------------------------
-- 2. preme.loan_borrowers — co-borrower + guarantor rows
-- ---------------------------------------------------------------------------
-- One row per non-primary party. Primary borrower data stays on
-- loan_applications to avoid forcing every caller to join.

CREATE TABLE IF NOT EXISTS preme.loan_borrowers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id    uuid NOT NULL REFERENCES preme.loan_applications(id) ON DELETE CASCADE,
  role                   text NOT NULL,  -- 'CoBorrower' | 'Guarantor'
  classification_type    text,           -- 'Primary' | 'Secondary'
  first_name             text,
  middle_name            text,
  last_name              text,
  name_suffix            text,
  dob                    date,
  ssn_encrypted          text,
  citizenship_type       text,
  marital_status         text,
  email                  text,
  phone                  text,
  current_address        text,
  current_city           text,
  current_state          text,
  current_zip            text,
  residency_basis        text,
  residency_months       integer,
  credit_score_exact     integer,
  signed_date            date,
  joint_with_primary     boolean DEFAULT true,  -- JointAssetLiabilityReportingType
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loan_borrowers_role_chk
    CHECK (role IN ('CoBorrower','Guarantor')),
  CONSTRAINT loan_borrowers_classification_chk
    CHECK (classification_type IS NULL OR classification_type IN ('Primary','Secondary')),
  CONSTRAINT loan_borrowers_citizenship_chk
    CHECK (citizenship_type IS NULL OR citizenship_type IN
      ('USCitizen','PermanentResidentAlien','NonPermanentResidentAlien','Other')),
  CONSTRAINT loan_borrowers_marital_chk
    CHECK (marital_status IS NULL OR marital_status IN
      ('Married','Unmarried','Separated')),
  CONSTRAINT loan_borrowers_residency_chk
    CHECK (residency_basis IS NULL OR residency_basis IN
      ('Own','Rent','LivingRentFree'))
);

CREATE INDEX IF NOT EXISTS loan_borrowers_app_idx
  ON preme.loan_borrowers (loan_application_id);

-- ---------------------------------------------------------------------------
-- 3. preme.loan_liabilities — per-line liabilities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS preme.loan_liabilities (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id        uuid NOT NULL REFERENCES preme.loan_applications(id) ON DELETE CASCADE,
  owner_party                text NOT NULL DEFAULT 'Borrower',  -- 'Borrower' | 'CoBorrower' | 'Joint' | 'Entity'
  liability_type             text NOT NULL,
  liability_type_other_description text,
  account_identifier         text,
  unpaid_balance_amount      numeric(12,2) NOT NULL DEFAULT 0,
  monthly_payment_amount     numeric(12,2) NOT NULL DEFAULT 0,
  holder_name                text,
  remaining_term_months      integer,
  payoff_at_close            boolean DEFAULT false,
  excluded_from_dti          boolean DEFAULT false,
  payment_includes_ti        boolean,                           -- for mortgage liabilities
  mortgage_type              text,                              -- when liability_type=MortgageLoan
  heloc_maximum_balance      numeric(12,2),                     -- when liability_type=HELOC
  linked_reo_property_id     uuid,                              -- optional FK to loan_reo_properties
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loan_liabilities_type_chk
    CHECK (liability_type IN (
      'BorrowerEstimatedTotalMonthlyLiabilityPayment','CollectionsJudgmentsAndLiens',
      'DeferredStudentLoan','DelinquentTaxes','FirstPositionMortgageLien','Garnishments',
      'HELOC','HomeownersAssociationLien','Installment','LeasePayment','MonetaryJudgment',
      'MortgageLoan','Open30DayChargeAccount','Other','PersonalLoan','Revolving',
      'SecondPositionMortgageLien','Taxes','TaxLien','ThirdPositionMortgageLien',
      'UnsecuredHomeImprovementLoanInstallment','UnsecuredHomeImprovementLoanRevolving'
    ))
);

CREATE INDEX IF NOT EXISTS loan_liabilities_app_idx
  ON preme.loan_liabilities (loan_application_id);

-- ---------------------------------------------------------------------------
-- 4. preme.loan_assets — per-account asset rows
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS preme.loan_assets (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id        uuid NOT NULL REFERENCES preme.loan_applications(id) ON DELETE CASCADE,
  owner_party                text NOT NULL DEFAULT 'Borrower',
  asset_type                 text NOT NULL,
  asset_type_other_description text,
  account_identifier         text,
  holder_name                text,
  account_type               text,                              -- Individual/Joint/BusinessAccount/Trust/Other
  cash_or_market_value_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_value_amount           numeric(12,2),
  verified                   boolean DEFAULT false,
  liquidity_indicator        boolean,
  funds_source_type          text,
  description                text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loan_assets_type_chk
    CHECK (asset_type IN (
      'CheckingAccount','SavingsAccount','MoneyMarketFund','CertificateOfDepositTimeDeposit',
      'Stock','Bond','MutualFund','RetirementFund','Automobile','LifeInsurance','TrustAccount',
      'BridgeLoanNotDeposited','CashOnHand','EarnestMoneyCashDeposit','GiftsNotDeposited',
      'GiftsTotal','ProceedsFromSaleOfNonRealEstateAsset','ProceedsFromSaleOfRealEstateAsset',
      'SecuredBorrowedFundsNotDeposited','NetEquity','PendingNetSaleProceedsFromRealEstateAssets',
      'RelocationMoney','TrustFunds','UnsecuredBorrowedFunds','OtherLiquidAssets',
      'OtherNonLiquidAssets','Other'
    )),
  CONSTRAINT loan_assets_account_type_chk
    CHECK (account_type IS NULL OR account_type IN
      ('Individual','Joint','BusinessAccount','Trust','Other'))
);

CREATE INDEX IF NOT EXISTS loan_assets_app_idx
  ON preme.loan_assets (loan_application_id);

-- ---------------------------------------------------------------------------
-- 5. preme.loan_reo_properties — existing rental portfolio (DSCR-blocker)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS preme.loan_reo_properties (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id            uuid NOT NULL REFERENCES preme.loan_applications(id) ON DELETE CASCADE,
  is_subject                     boolean NOT NULL DEFAULT false,
  disposition_status             text NOT NULL,                 -- HeldForInvestment / PendingSale / Retain / Sold
  usage_type                     text DEFAULT 'Investment',
  address_line1                  text NOT NULL,
  address_line2                  text,
  city                           text NOT NULL,
  state                          text NOT NULL,
  postal_code                    text NOT NULL,
  county                         text,
  present_market_value           numeric(12,2) NOT NULL DEFAULT 0,
  lien_upb_amount                numeric(12,2) DEFAULT 0,
  monthly_mortgage_payment       numeric(12,2) DEFAULT 0,
  monthly_maintenance_expense    numeric(12,2) DEFAULT 0,
  monthly_rental_income_gross    numeric(12,2) DEFAULT 0,
  monthly_rental_income_net      numeric(12,2) DEFAULT 0,
  unit_count                     integer DEFAULT 1,
  property_acquired_date         date,
  property_original_cost         numeric(12,2),
  linked_mortgage_id             uuid,                          -- optional FK to preme.mortgages
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loan_reo_disposition_chk
    CHECK (disposition_status IN ('HeldForInvestment','PendingSale','Retain','Sold')),
  CONSTRAINT loan_reo_usage_chk
    CHECK (usage_type IN ('Investment','PrimaryResidence','SecondHome','Other'))
);

CREATE INDEX IF NOT EXISTS loan_reo_properties_app_idx
  ON preme.loan_reo_properties (loan_application_id);

-- Optional back-FK for loan_liabilities.linked_reo_property_id once the table exists
ALTER TABLE preme.loan_liabilities
  ADD CONSTRAINT loan_liabilities_reo_fk
    FOREIGN KEY (linked_reo_property_id)
    REFERENCES preme.loan_reo_properties(id)
    ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 6. preme.loan_declarations — the 1003 declaration questions (box 6)
-- ---------------------------------------------------------------------------
-- One row per borrower (primary, co-, guarantor). Primary borrower row FKs
-- loan_application_id with borrower_id = NULL; other borrowers use borrower_id.

CREATE TABLE IF NOT EXISTS preme.loan_declarations (
  id                                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id                       uuid NOT NULL REFERENCES preme.loan_applications(id) ON DELETE CASCADE,
  borrower_id                               uuid REFERENCES preme.loan_borrowers(id) ON DELETE CASCADE,
  intent_to_occupy                          boolean NOT NULL DEFAULT false,
  homeowner_past_3yrs                       boolean,
  bankruptcy                                boolean DEFAULT false,
  bankruptcy_chapter                        text,
  bankruptcy_filed_date                     date,
  bankruptcy_discharged_date                date,
  outstanding_judgments                     boolean DEFAULT false,
  party_to_lawsuit                          boolean DEFAULT false,
  presently_delinquent_federal_debt         boolean DEFAULT false,
  undisclosed_borrowed_funds                boolean DEFAULT false,
  undisclosed_borrowed_funds_amount         numeric(12,2),
  undisclosed_mortgage_application          boolean DEFAULT false,
  undisclosed_credit_application            boolean DEFAULT false,
  undisclosed_comaker                       boolean DEFAULT false,
  prior_deed_in_lieu                        boolean DEFAULT false,
  prior_short_sale                          boolean DEFAULT false,
  prior_foreclosure                         boolean DEFAULT false,
  proposed_clean_energy_lien                boolean DEFAULT false,
  special_borrower_seller_relationship      boolean,                -- purchase only
  created_at                                timestamptz NOT NULL DEFAULT now(),
  updated_at                                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loan_declarations_bankruptcy_chapter_chk
    CHECK (bankruptcy_chapter IS NULL OR bankruptcy_chapter IN
      ('Chapter7','Chapter11','Chapter12','Chapter13')),

  -- only one primary-borrower declaration row per application
  CONSTRAINT loan_declarations_uniq_primary
    UNIQUE (loan_application_id, borrower_id)
);

CREATE INDEX IF NOT EXISTS loan_declarations_app_idx
  ON preme.loan_declarations (loan_application_id);

-- ---------------------------------------------------------------------------
-- 7. updated_at triggers (match existing preme convention)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION preme.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER loan_borrowers_updated_at       BEFORE UPDATE ON preme.loan_borrowers       FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER loan_liabilities_updated_at     BEFORE UPDATE ON preme.loan_liabilities     FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER loan_assets_updated_at          BEFORE UPDATE ON preme.loan_assets          FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER loan_reo_properties_updated_at  BEFORE UPDATE ON preme.loan_reo_properties  FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER loan_declarations_updated_at    BEFORE UPDATE ON preme.loan_declarations    FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 8. RLS — enable on new tables; mirror loan_applications policies
-- ---------------------------------------------------------------------------
-- NOTE: actual policy bodies should mirror whatever loan_applications has
-- today. Only enabling RLS here; policy statements are commented out until
-- a human confirms the correct policy expressions.

ALTER TABLE preme.loan_borrowers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE preme.loan_liabilities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE preme.loan_assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE preme.loan_reo_properties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE preme.loan_declarations    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 9. Safety: do NOT DROP columns on this migration
-- ---------------------------------------------------------------------------
-- Known bugs (see gap-report.md):
--   - loan_applications.loan_type duplicates property_type (form bug)
--   - sponsor_* columns are semantically a co-signer, not a guarantor
-- These are intentionally LEFT IN PLACE for this migration. A follow-up
-- migration will deprecate them once the frontend writes applicant_first_name,
-- applicant_last_name, mortgage_type, and loan_borrowers rows instead.

COMMIT;

-- ============================================================================
--  Post-migration validation (run manually after apply, do not include above):
--    \d preme.loan_applications            -- should show ~91 columns
--    \d preme.loan_borrowers
--    \d preme.loan_liabilities
--    \d preme.loan_assets
--    \d preme.loan_reo_properties
--    \d preme.loan_declarations
--    SELECT count(*) FROM preme.loan_applications;   -- must still be 37
-- ============================================================================
