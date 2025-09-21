-- Admin setup for PREME
-- Connection: postgresql://postgres.hriipovloelnqrlwtswy:2Yungnyalls!@aws-1-us-east-2.pooler.supabase.com:6543/postgres

-- 1) Ensure is_admin flag exists on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2) Grant admin to owner email
UPDATE public.profiles
SET is_admin = true, role = COALESCE(role, 'admin')
WHERE email = 'nyallscarlton@gmail.com';

-- 3) Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4) Add admin-allow policies (do not DROP existing user policies)
-- Profiles: allow admins to read/write all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins can read all profiles'
  ) THEN
    CREATE POLICY "Admins can read all profiles" ON public.profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles" ON public.profiles
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )
      );
  END IF;
END$$;

-- Applications: allow admins to read/write all applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'applications' AND policyname = 'Admins can read all applications'
  ) THEN
    CREATE POLICY "Admins can read all applications" ON public.applications
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'applications' AND policyname = 'Admins can update all applications'
  ) THEN
    CREATE POLICY "Admins can update all applications" ON public.applications
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )
      );
  END IF;
END$$;

-- Documents: allow admins to read/write all documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'Admins can read all documents'
  ) THEN
    CREATE POLICY "Admins can read all documents" ON public.documents
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'Admins can update all documents'
  ) THEN
    CREATE POLICY "Admins can update all documents" ON public.documents
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )
      );
  END IF;
END$$;


