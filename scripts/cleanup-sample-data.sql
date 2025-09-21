-- Cleanup sample/test data for PREME
-- Preserves the admin account by email

-- PARAMETERS (change as needed before running directly)
-- \set admin_email 'nyallscarlton@gmail.com'

-- Delete messaging (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages') THEN
    EXECUTE 'DELETE FROM public.messages';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'DELETE FROM public.notifications';
  END IF;
END$$;

-- Delete documents not tied to admin
DELETE FROM public.documents d
USING public.profiles p
WHERE d.user_id = p.id AND p.email <> 'nyallscarlton@gmail.com';

-- Delete applications not tied to admin
DELETE FROM public.applications a
USING public.profiles p
WHERE a.user_id = p.id AND p.email <> 'nyallscarlton@gmail.com';

-- Delete profiles that are not admin email
DELETE FROM public.profiles p
WHERE p.email <> 'nyallscarlton@gmail.com';

-- Optional: delete anonymous/test auth users by pattern (keep admin)
DELETE FROM auth.users u
WHERE lower(u.email) <> lower('nyallscarlton@gmail.com')
  AND (
    u.email ILIKE 'test-%@example.com' OR
    u.email ILIKE '%+test@%' OR
    u.email ILIKE '%demo%@%' OR
    u.email ILIKE '%example.com'
  );

-- Vacuum/analyze lightweight (optional; requires appropriate privileges)
-- VACUUM ANALYZE public.profiles;
-- VACUUM ANALYZE public.applications;
-- VACUUM ANALYZE public.documents;
