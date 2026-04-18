-- ============================================================================
--  Borrower Profiles — cross-application prefill store
--  Date      : 2026-04-17
--  Depends on: 20260417_mismo_3.4_gaps.sql, 20260417b_pii_encryption.sql
--
--  Goal: reduce intake friction. A borrower who starts a second loan (or
--  converts from guest to account) gets identity / entity / HMDA fields
--  prefilled.
--
--  Link strategy:
--    - auth.users.id  →  borrower_profiles.user_id   (account users)
--    - verified email →  borrower_profiles.email     (guests + pre-account)
--  When a guest later creates an account with the same verified email,
--  the row is linked by setting user_id.
--
--  We store only STABLE facts (identity, entity, HMDA, residence basis,
--  last employer, last-known credit score). Loan-specific data (amounts,
--  subject property, per-loan REO schedule) stays on loan_applications.
-- ============================================================================

BEGIN;

-- citext extension — must exist before the table uses citext type
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS preme.borrower_profiles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid,                                  -- FK to auth.users.id; nullable for guest-only profiles
  email                  citext NOT NULL,                       -- case-insensitive; primary lookup for guest flow
  email_verified         boolean NOT NULL DEFAULT false,

  -- Identity
  first_name             text,
  middle_name            text,
  last_name              text,
  name_suffix            text,
  dob                    date,
  ssn_encrypted          text,                                  -- preme.encrypt_pii output
  citizenship_type       text,
  marital_status         text,
  dependent_count        integer,

  -- Contact
  phone                  text,
  preferred_contact_method text,                                -- 'email' | 'sms' | 'call'
  contact_address        text,
  contact_city           text,
  contact_state          text,
  contact_zip            text,

  -- Residence
  current_residence_basis   text,                               -- Own/Rent/LivingRentFree
  current_residence_months  integer,

  -- Entity (vesting LLC / corp) — prefilled on subsequent DSCR apps
  vesting_type              text,                               -- Individual/Entity/JointTenants/TenantsInCommon
  entity_legal_name         text,
  entity_org_type           text,
  entity_state_of_formation text,
  entity_formation_date     date,
  entity_ein_encrypted      text,                               -- preme.encrypt_pii output
  entity_address            text,
  entity_city               text,
  entity_state              text,
  entity_zip                text,

  -- Last-known professional info
  employer_name           text,
  employment_status       text,
  credit_score_exact      integer,

  -- HMDA demographics (borrower can opt to save once, refused for HMDA-exempt DSCR)
  hmda_ethnicity          text[],
  hmda_race               text[],
  hmda_gender             text,
  hmda_ethnicity_refused  boolean,
  hmda_race_refused       boolean,

  -- Metadata
  last_application_id     uuid REFERENCES preme.loan_applications(id) ON DELETE SET NULL,
  applications_count      integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Enum constraints
  CONSTRAINT bp_citizenship_chk
    CHECK (citizenship_type IS NULL OR citizenship_type IN
      ('USCitizen','PermanentResidentAlien','NonPermanentResidentAlien','Other')),
  CONSTRAINT bp_marital_chk
    CHECK (marital_status IS NULL OR marital_status IN
      ('Married','Unmarried','Separated')),
  CONSTRAINT bp_residence_chk
    CHECK (current_residence_basis IS NULL OR current_residence_basis IN
      ('Own','Rent','LivingRentFree')),
  CONSTRAINT bp_vesting_chk
    CHECK (vesting_type IS NULL OR vesting_type IN
      ('Individual','Entity','JointTenants','TenantsInCommon')),
  CONSTRAINT bp_entity_org_chk
    CHECK (entity_org_type IS NULL OR entity_org_type IN
      ('LLC','Corporation','Partnership','Trust','SoleProprietorship','Other'))
);

-- Unique-per-person indexes. email unique globally; user_id unique when set.
CREATE UNIQUE INDEX IF NOT EXISTS borrower_profiles_email_uniq
  ON preme.borrower_profiles (email);

CREATE UNIQUE INDEX IF NOT EXISTS borrower_profiles_user_id_uniq
  ON preme.borrower_profiles (user_id) WHERE user_id IS NOT NULL;

-- updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER borrower_profiles_updated_at
    BEFORE UPDATE ON preme.borrower_profiles
    FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Link loan_applications rows to their borrower profile (nullable for legacy)
-- ---------------------------------------------------------------------------
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS borrower_profile_id uuid
    REFERENCES preme.borrower_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS loan_applications_borrower_profile_idx
  ON preme.loan_applications (borrower_profile_id);

-- ---------------------------------------------------------------------------
-- RLS — borrower sees only their own profile
-- ---------------------------------------------------------------------------

ALTER TABLE preme.borrower_profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies before re-creating (idempotent re-run safety)
DROP POLICY IF EXISTS bp_select_own          ON preme.borrower_profiles;
DROP POLICY IF EXISTS bp_insert_own          ON preme.borrower_profiles;
DROP POLICY IF EXISTS bp_update_own          ON preme.borrower_profiles;
DROP POLICY IF EXISTS bp_service_role_all    ON preme.borrower_profiles;

-- authenticated borrowers: SELECT + UPDATE their own row
CREATE POLICY bp_select_own ON preme.borrower_profiles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY bp_update_own ON preme.borrower_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- authenticated borrowers may insert their own profile row on first save
CREATE POLICY bp_insert_own ON preme.borrower_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- service_role gets everything (used by server-side handlers via createAdminClient)
CREATE POLICY bp_service_role_all ON preme.borrower_profiles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Helper RPC: upsert a profile from a submitted loan application
-- ---------------------------------------------------------------------------
-- Called at end of /api/applications submit. Takes the loan_application_id,
-- pulls the stable fields, and upserts into borrower_profiles by email.
-- Also links loan_applications.borrower_profile_id back.

CREATE OR REPLACE FUNCTION preme.upsert_profile_from_application(p_loan_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  la preme.loan_applications%ROWTYPE;
  profile_id uuid;
BEGIN
  SELECT * INTO la FROM preme.loan_applications WHERE id = p_loan_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'loan_application % not found', p_loan_application_id;
  END IF;
  IF la.applicant_email IS NULL OR la.applicant_email = '' THEN
    RAISE EXCEPTION 'loan_application % has no applicant_email', p_loan_application_id;
  END IF;

  INSERT INTO preme.borrower_profiles (
    user_id, email, email_verified,
    first_name, middle_name, last_name, name_suffix, dob, ssn_encrypted,
    citizenship_type, marital_status, dependent_count,
    phone, contact_address, contact_city, contact_state, contact_zip,
    current_residence_basis, current_residence_months,
    vesting_type, entity_legal_name, entity_org_type, entity_state_of_formation,
    entity_formation_date, entity_ein_encrypted,
    entity_address, entity_city, entity_state, entity_zip,
    employer_name, employment_status, credit_score_exact,
    hmda_ethnicity, hmda_race, hmda_gender, hmda_ethnicity_refused, hmda_race_refused,
    last_application_id, applications_count
  ) VALUES (
    la.user_id, la.applicant_email::citext, false,
    la.applicant_first_name, la.applicant_middle_name, la.applicant_last_name,
    la.applicant_name_suffix, la.applicant_dob, la.applicant_ssn_encrypted,
    la.applicant_citizenship_type, la.applicant_marital_status, la.applicant_dependent_count,
    la.applicant_phone, la.contact_address, la.contact_city, la.contact_state, la.contact_zip,
    la.applicant_current_residence_basis, la.applicant_current_residence_months,
    la.vesting_type, la.entity_legal_name, la.entity_org_type, la.entity_state_of_formation,
    la.entity_formation_date, la.entity_ein_encrypted,
    la.entity_address, la.entity_city, la.entity_state, la.entity_zip,
    la.employer_name, la.employment_status, la.credit_score_exact,
    la.hmda_ethnicity, la.hmda_race, la.hmda_gender, la.hmda_ethnicity_refused, la.hmda_race_refused,
    la.id, 1
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id                  = COALESCE(EXCLUDED.user_id, preme.borrower_profiles.user_id),
    first_name               = COALESCE(EXCLUDED.first_name, preme.borrower_profiles.first_name),
    middle_name              = COALESCE(EXCLUDED.middle_name, preme.borrower_profiles.middle_name),
    last_name                = COALESCE(EXCLUDED.last_name, preme.borrower_profiles.last_name),
    name_suffix              = COALESCE(EXCLUDED.name_suffix, preme.borrower_profiles.name_suffix),
    dob                      = COALESCE(EXCLUDED.dob, preme.borrower_profiles.dob),
    ssn_encrypted            = COALESCE(EXCLUDED.ssn_encrypted, preme.borrower_profiles.ssn_encrypted),
    citizenship_type         = COALESCE(EXCLUDED.citizenship_type, preme.borrower_profiles.citizenship_type),
    marital_status           = COALESCE(EXCLUDED.marital_status, preme.borrower_profiles.marital_status),
    dependent_count          = COALESCE(EXCLUDED.dependent_count, preme.borrower_profiles.dependent_count),
    phone                    = COALESCE(EXCLUDED.phone, preme.borrower_profiles.phone),
    contact_address          = COALESCE(EXCLUDED.contact_address, preme.borrower_profiles.contact_address),
    contact_city             = COALESCE(EXCLUDED.contact_city, preme.borrower_profiles.contact_city),
    contact_state            = COALESCE(EXCLUDED.contact_state, preme.borrower_profiles.contact_state),
    contact_zip              = COALESCE(EXCLUDED.contact_zip, preme.borrower_profiles.contact_zip),
    current_residence_basis  = COALESCE(EXCLUDED.current_residence_basis, preme.borrower_profiles.current_residence_basis),
    current_residence_months = COALESCE(EXCLUDED.current_residence_months, preme.borrower_profiles.current_residence_months),
    vesting_type             = COALESCE(EXCLUDED.vesting_type, preme.borrower_profiles.vesting_type),
    entity_legal_name        = COALESCE(EXCLUDED.entity_legal_name, preme.borrower_profiles.entity_legal_name),
    entity_org_type          = COALESCE(EXCLUDED.entity_org_type, preme.borrower_profiles.entity_org_type),
    entity_state_of_formation= COALESCE(EXCLUDED.entity_state_of_formation, preme.borrower_profiles.entity_state_of_formation),
    entity_formation_date    = COALESCE(EXCLUDED.entity_formation_date, preme.borrower_profiles.entity_formation_date),
    entity_ein_encrypted     = COALESCE(EXCLUDED.entity_ein_encrypted, preme.borrower_profiles.entity_ein_encrypted),
    entity_address           = COALESCE(EXCLUDED.entity_address, preme.borrower_profiles.entity_address),
    entity_city              = COALESCE(EXCLUDED.entity_city, preme.borrower_profiles.entity_city),
    entity_state             = COALESCE(EXCLUDED.entity_state, preme.borrower_profiles.entity_state),
    entity_zip               = COALESCE(EXCLUDED.entity_zip, preme.borrower_profiles.entity_zip),
    employer_name            = COALESCE(EXCLUDED.employer_name, preme.borrower_profiles.employer_name),
    employment_status        = COALESCE(EXCLUDED.employment_status, preme.borrower_profiles.employment_status),
    credit_score_exact       = COALESCE(EXCLUDED.credit_score_exact, preme.borrower_profiles.credit_score_exact),
    hmda_ethnicity           = COALESCE(EXCLUDED.hmda_ethnicity, preme.borrower_profiles.hmda_ethnicity),
    hmda_race                = COALESCE(EXCLUDED.hmda_race, preme.borrower_profiles.hmda_race),
    hmda_gender              = COALESCE(EXCLUDED.hmda_gender, preme.borrower_profiles.hmda_gender),
    hmda_ethnicity_refused   = COALESCE(EXCLUDED.hmda_ethnicity_refused, preme.borrower_profiles.hmda_ethnicity_refused),
    hmda_race_refused        = COALESCE(EXCLUDED.hmda_race_refused, preme.borrower_profiles.hmda_race_refused),
    last_application_id      = la.id,
    applications_count       = preme.borrower_profiles.applications_count + 1,
    updated_at               = now()
  RETURNING id INTO profile_id;

  UPDATE preme.loan_applications
    SET borrower_profile_id = profile_id
    WHERE id = p_loan_application_id;

  RETURN profile_id;
END $$;

REVOKE ALL ON FUNCTION preme.upsert_profile_from_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION preme.upsert_profile_from_application(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Helper RPC: load a profile for prefill
-- ---------------------------------------------------------------------------
-- Looks up by auth.uid() if present, else by provided email. Returns the
-- profile as a composite row. Decryption of SSN/EIN is NOT done here —
-- the client-facing prefill path intentionally returns ssn_encrypted only
-- and the frontend shows "•••-••-1234" from preme.ssn_last4 if decryption
-- is needed. Borrowers should re-enter SSN rather than seeing it prefilled.

CREATE OR REPLACE FUNCTION preme.get_profile_for_prefill(p_email text DEFAULT NULL)
RETURNS preme.borrower_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  p preme.borrower_profiles%ROWTYPE;
  jwt_sub uuid := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
BEGIN
  IF jwt_sub IS NOT NULL THEN
    SELECT * INTO p FROM preme.borrower_profiles WHERE user_id = jwt_sub LIMIT 1;
    IF FOUND THEN RETURN p; END IF;
  END IF;
  IF p_email IS NOT NULL AND p_email <> '' THEN
    SELECT * INTO p FROM preme.borrower_profiles WHERE email = p_email::citext LIMIT 1;
    IF FOUND THEN RETURN p; END IF;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION preme.get_profile_for_prefill(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION preme.get_profile_for_prefill(text) TO service_role, authenticated;

COMMIT;
