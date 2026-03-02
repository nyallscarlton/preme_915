-- Preme Home Loans Portal — Migration 001: Foundation
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)

-- ============================================================
-- 1. PROFILES TABLE (auto-created on user signup)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'applicant' CHECK (role IN ('applicant', 'lender', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'applicant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Lenders and admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 2. ADD user_id TO loan_applications
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_loan_applications_user_id
  ON loan_applications(user_id);

CREATE INDEX IF NOT EXISTS idx_loan_applications_email
  ON loan_applications(applicant_email);

CREATE INDEX IF NOT EXISTS idx_loan_applications_guest_token
  ON loan_applications(guest_token);

-- ============================================================
-- 3. FIX RLS POLICIES on loan_applications
-- ============================================================

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Enable insert for all" ON loan_applications;
DROP POLICY IF EXISTS "Enable read access for all" ON loan_applications;
DROP POLICY IF EXISTS "Enable update for all" ON loan_applications;
DROP POLICY IF EXISTS "Enable delete for all" ON loan_applications;
DROP POLICY IF EXISTS "Allow all inserts" ON loan_applications;
DROP POLICY IF EXISTS "Allow all reads" ON loan_applications;
DROP POLICY IF EXISTS "Allow all updates" ON loan_applications;

-- Guest insert (anyone can submit an application)
CREATE POLICY "Anyone can submit applications"
  ON loan_applications FOR INSERT
  WITH CHECK (true);

-- Authenticated users see own apps (by user_id or email)
CREATE POLICY "Users can read own applications"
  ON loan_applications FOR SELECT
  USING (
    auth.uid() = user_id
    OR applicant_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Guest token access (unauthenticated)
CREATE POLICY "Guest token access"
  ON loan_applications FOR SELECT
  USING (
    guest_token IS NOT NULL
    AND is_guest = true
  );

-- Lenders and admins see all
CREATE POLICY "Lenders and admins read all applications"
  ON loan_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- Lenders and admins can update
CREATE POLICY "Lenders and admins update applications"
  ON loan_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- Users can update own apps (limited)
CREATE POLICY "Users can update own applications"
  ON loan_applications FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. LOAN DOCUMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  document_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE loan_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upload own docs"
  ON loan_documents FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can read own docs"
  ON loan_documents FOR SELECT
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Lenders/admins read all docs"
  ON loan_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

CREATE POLICY "Lenders/admins update doc status"
  ON loan_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- ============================================================
-- 5. CONDITIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'submitted', 'approved', 'waived')),
  due_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conditions"
  ON conditions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications la
      WHERE la.id = conditions.application_id
      AND (la.user_id = auth.uid() OR la.applicant_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Lenders/admins manage conditions"
  ON conditions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- ============================================================
-- 6. MESSAGES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM loan_applications la
      WHERE la.id = messages.application_id
      AND (la.user_id = auth.uid() OR la.applicant_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

CREATE POLICY "Authenticated users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark as read"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications la
      WHERE la.id = messages.application_id
      AND (la.user_id = auth.uid() OR la.applicant_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- ============================================================
-- 7. STATUS HISTORY TABLE + TRIGGER
-- ============================================================

CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own app history"
  ON status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM loan_applications la
      WHERE la.id = status_history.application_id
      AND (la.user_id = auth.uid() OR la.applicant_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- Auto-track status changes
CREATE OR REPLACE FUNCTION public.track_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_history (application_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_status_change ON loan_applications;
CREATE TRIGGER on_status_change
  AFTER UPDATE OF status ON loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.track_status_change();

-- ============================================================
-- 8. STORAGE BUCKET for documents
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('loan-documents', 'loan-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'loan-documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'loan-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('lender', 'admin')
      )
    )
  );

-- ============================================================
-- 9. ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE loan_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE conditions;
