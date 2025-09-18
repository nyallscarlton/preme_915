-- Usage: psql "<pooler conn>" -f scripts/e2e-mark-verified.sql -v email='test@example.com'
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_email text := :'email';
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = now()
  WHERE email = v_email;
END $$;


