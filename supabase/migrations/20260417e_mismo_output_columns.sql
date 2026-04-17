-- ============================================================================
--  MISMO generator output pointers
--  Date: 2026-04-17
--  Adds the columns that storage.writeLoanGenOutputs writes back to.
-- ============================================================================

BEGIN;

ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS mismo_xml_url     text,
  ADD COLUMN IF NOT EXISTS mismo_xml_path    text,
  ADD COLUMN IF NOT EXISTS mismo_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS fnm_url           text,
  ADD COLUMN IF NOT EXISTS fnm_path          text,
  ADD COLUMN IF NOT EXISTS fnm_generated_at  timestamptz;

CREATE INDEX IF NOT EXISTS loan_applications_mismo_gen_idx
  ON preme.loan_applications (mismo_generated_at DESC NULLS LAST);

COMMIT;
