-- ============================================================================
--  URLA PDF output pointers (the 1003)
--  Date: 2026-04-17
-- ============================================================================

BEGIN;

ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS urla_pdf_url       text,
  ADD COLUMN IF NOT EXISTS urla_pdf_path      text,
  ADD COLUMN IF NOT EXISTS urla_generated_at  timestamptz;

COMMIT;
