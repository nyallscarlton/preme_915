-- ============================================================================
--  Borrower LLCs — reusable entity registry
--  Date: 2026-07-22
--
--  A borrower can hold multiple LLCs and pick one per deal. The application
--  form offers a dropdown of these; the borrower portal has a "My LLCs" tab
--  to manage them (EIN, formation info, docs live in the documents bucket
--  under llcs/<llc_id>/).
--
--  Access is server-side only (service role via API routes) — no anon/authed
--  policies on purpose.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS preme.borrower_llcs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid,                          -- auth.users.id; nullable for guest-created
  email               citext NOT NULL,               -- fallback link for guests, same strategy as borrower_profiles
  legal_name          text NOT NULL,
  org_type            text NOT NULL DEFAULT 'LLC',
  state_of_formation  text,
  formation_date      date,
  ein_encrypted       text,                          -- preme.encrypt_pii output
  address             text,
  city                text,
  state               text,
  zip                 text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bl_org_type_chk CHECK (org_type IN
    ('LLC','Corporation','Partnership','Trust','SoleProprietorship','Other'))
);

CREATE INDEX IF NOT EXISTS bl_user_idx  ON preme.borrower_llcs (user_id);
CREATE INDEX IF NOT EXISTS bl_email_idx ON preme.borrower_llcs (email);

ALTER TABLE preme.borrower_llcs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS bl_set_updated_at ON preme.borrower_llcs;
CREATE TRIGGER bl_set_updated_at
  BEFORE UPDATE ON preme.borrower_llcs
  FOR EACH ROW EXECUTE FUNCTION preme.set_updated_at();

COMMIT;

NOTIFY pgrst, 'reload schema';
