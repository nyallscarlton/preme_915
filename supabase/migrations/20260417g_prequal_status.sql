-- ============================================================================
--  Pre-qualification phase 1 support
--  Date: 2026-04-17
--  Adds pre_qualified status + timestamps + cached lender-match result.
-- ============================================================================

BEGIN;

-- Widen status enum to include pre_qualified
ALTER TABLE preme.loan_applications
  DROP CONSTRAINT IF EXISTS loan_applications_status_check;

ALTER TABLE preme.loan_applications
  ADD CONSTRAINT loan_applications_status_check
  CHECK (status IN (
    'pre_qualified',
    'sent','opened','submitted','under_review','approved','rejected',
    'on_hold','archived','closed','withdrawn'
  ));

-- New columns
ALTER TABLE preme.loan_applications
  ADD COLUMN IF NOT EXISTS is_pre_qual              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_qualified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS pre_qual_lender_match    jsonb,
  ADD COLUMN IF NOT EXISTS pre_qual_to_full_sent_at timestamptz;   -- when admin resent full-app link

CREATE INDEX IF NOT EXISTS loan_applications_prequal_idx
  ON preme.loan_applications (status, pre_qualified_at DESC NULLS LAST)
  WHERE status = 'pre_qualified';

COMMIT;
