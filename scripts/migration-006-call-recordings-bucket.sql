-- Migration 006: Create call-recordings storage bucket for persistent Retell recordings
-- Run with service_role key via Supabase SQL Editor or supabase db push

-- 1. Create the storage bucket (private, no public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  52428800,  -- 50 MB max per file
  ARRAY['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policy: service_role can do anything (implicit via Supabase, no policy needed)

-- 3. RLS policy: authenticated users with admin or lender role can read/download recordings
CREATE POLICY "Admins and lenders can read call recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND (
    -- Check user role from profiles table
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'lender', 'lo')
    )
  )
);

-- 4. RLS policy: only service_role can upload (no authenticated user uploads)
-- service_role bypasses RLS by default, so no INSERT policy needed for regular users.
-- Explicitly deny authenticated user uploads by not creating an INSERT policy.

-- 5. RLS policy: no public access (bucket is private + no anon policies)
-- No SELECT/INSERT/UPDATE/DELETE policies for anon role.

-- 6. RLS policy: admins can delete old recordings for cleanup
CREATE POLICY "Admins can delete call recordings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'call-recordings'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);
