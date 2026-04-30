-- ============================================================================
--  PII Encryption + Access Audit
--  Date      : 2026-04-17
--  Depends on: 20260417_mismo_3.4_gaps.sql (must run first)
--
--  Goal: protect SSN + EIN at rest.
--    - Encryption key lives in Supabase Vault (`vault.secrets` name='mismo_pii_key'),
--      never in app env vars or source code.
--    - Writes go through preme.encrypt_pii(text) RETURNS text
--    - Reads go through preme.decrypt_pii(ciphertext text, purpose text) RETURNS text
--      and write one row to preme.pii_access_log per call.
--    - Both functions are SECURITY DEFINER and EXECUTE is granted only to service_role.
--      Anon / authenticated cannot call them.
--    - GLBA Safeguards Rule baseline: encryption at rest + access controls + audit log.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Master key in Vault — one-time bootstrap
-- ---------------------------------------------------------------------------
-- vault.create_secret(new_secret text, new_name text, new_description text)
-- Only creates if the name doesn't already exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'mismo_pii_key') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'base64'),
      'mismo_pii_key',
      'AES-256 key for encrypting borrower SSN + entity EIN in preme.loan_applications and preme.loan_borrowers'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. PII access audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS preme.pii_access_log (
  id                     bigserial PRIMARY KEY,
  accessed_at            timestamptz NOT NULL DEFAULT now(),
  actor_role             text NOT NULL,       -- e.g. 'service_role', 'authenticated'
  actor_sub              text,                -- JWT sub claim (user id) if present
  actor_ip               inet,                -- request.headers.x-forwarded-for if captured
  loan_application_id    uuid,
  field_name             text,                -- 'applicant_ssn' | 'entity_ein' | etc.
  purpose                text NOT NULL,       -- free-text reason ('mismo_generation', 'lender_submission', 'admin_view')
  succeeded              boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS pii_access_log_app_idx ON preme.pii_access_log (loan_application_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS pii_access_log_actor_idx ON preme.pii_access_log (actor_sub, accessed_at DESC);

ALTER TABLE preme.pii_access_log ENABLE ROW LEVEL SECURITY;

-- Nobody reads pii_access_log directly except service_role (admins).
-- No SELECT policy = no row visible to anon/authenticated.

-- ---------------------------------------------------------------------------
-- 3. Encrypt function
-- ---------------------------------------------------------------------------
-- Returns base64 ciphertext (pgp_sym_encrypt output cast text via encode).

CREATE OR REPLACE FUNCTION preme.encrypt_pii(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k text;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN RETURN NULL; END IF;

  SELECT decrypted_secret INTO k
    FROM vault.decrypted_secrets
    WHERE name = 'mismo_pii_key'
    LIMIT 1;
  IF k IS NULL THEN
    RAISE EXCEPTION 'PII encryption key not configured in vault';
  END IF;

  RETURN encode(extensions.pgp_sym_encrypt(plaintext, k, 'cipher-algo=aes256'), 'base64');
END $$;

REVOKE ALL ON FUNCTION preme.encrypt_pii(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION preme.encrypt_pii(text) FROM anon;
REVOKE ALL ON FUNCTION preme.encrypt_pii(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION preme.encrypt_pii(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Decrypt function — with audit log
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION preme.decrypt_pii(
  ciphertext          text,
  purpose             text,
  loan_application_id uuid DEFAULT NULL,
  field_name          text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k         text;
  plain     text;
  caller    text := current_setting('role', true);
  jwt_sub   text := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  xff       text := NULLIF(current_setting('request.headers.x-forwarded-for', true), '');
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN RETURN NULL; END IF;
  IF purpose IS NULL OR purpose = '' THEN
    RAISE EXCEPTION 'decrypt_pii requires a non-empty purpose';
  END IF;

  SELECT decrypted_secret INTO k
    FROM vault.decrypted_secrets
    WHERE name = 'mismo_pii_key'
    LIMIT 1;
  IF k IS NULL THEN
    RAISE EXCEPTION 'PII encryption key not configured in vault';
  END IF;

  BEGIN
    plain := extensions.pgp_sym_decrypt(decode(ciphertext, 'base64'), k);

    INSERT INTO preme.pii_access_log
      (actor_role, actor_sub, actor_ip, loan_application_id, field_name, purpose, succeeded)
    VALUES
      (COALESCE(caller, 'unknown'), jwt_sub, xff::inet, loan_application_id, field_name, purpose, true);

    RETURN plain;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO preme.pii_access_log
      (actor_role, actor_sub, actor_ip, loan_application_id, field_name, purpose, succeeded)
    VALUES
      (COALESCE(caller, 'unknown'), jwt_sub, xff::inet, loan_application_id, field_name, purpose, false);
    RAISE;
  END;
END $$;

REVOKE ALL ON FUNCTION preme.decrypt_pii(text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION preme.decrypt_pii(text, text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION preme.decrypt_pii(text, text, uuid, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION preme.decrypt_pii(text, text, uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Convenience helper: last-4 for UI display without decrypt log bloat
-- ---------------------------------------------------------------------------
-- Returns "***-**-1234" style mask. Still requires decrypt but marks purpose=ui_mask
-- so we can filter it out of compliance reports when needed.

CREATE OR REPLACE FUNCTION preme.ssn_last4(ciphertext text, loan_application_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  plain text;
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN RETURN NULL; END IF;
  plain := preme.decrypt_pii(ciphertext, 'ui_mask', loan_application_id, 'applicant_ssn');
  IF plain IS NULL OR length(plain) < 4 THEN RETURN NULL; END IF;
  RETURN '***-**-' || right(regexp_replace(plain, '\D', '', 'g'), 4);
END $$;

REVOKE ALL ON FUNCTION preme.ssn_last4(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION preme.ssn_last4(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION preme.ssn_last4(text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION preme.ssn_last4(text, uuid) TO service_role;

COMMIT;

-- Verify (run manually after apply):
--   SELECT preme.encrypt_pii('123-45-6789') AS ct;
--   SELECT preme.decrypt_pii(preme.encrypt_pii('123-45-6789'), 'test');
--   SELECT count(*) FROM preme.pii_access_log WHERE purpose = 'test';
