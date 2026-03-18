-- Migration 005: Supabase Storage bucket and RLS policies for document uploads
-- Run manually: psql or Supabase SQL Editor

-- 1. Create the "documents" storage bucket (public for signed URL access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies for storage.objects on the "documents" bucket

-- Allow authenticated users to upload documents to their own application folders
-- Path pattern: applications/{applicationId}/{category}/{filename}
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'applications'
);

-- Allow authenticated users to read documents from applications they own
-- (Checks that the application's user_id matches the requesting user)
CREATE POLICY "Authenticated users can read their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'applications'
  AND EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id::text = (storage.foldername(name))[2]
      AND la.user_id = auth.uid()
  )
);

-- Allow authenticated users to delete documents from their own applications
CREATE POLICY "Authenticated users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'applications'
  AND EXISTS (
    SELECT 1 FROM public.loan_applications la
    WHERE la.id::text = (storage.foldername(name))[2]
      AND la.user_id = auth.uid()
  )
);

-- Allow service_role full access (used by API routes for guest uploads)
-- Note: service_role bypasses RLS by default, but explicit policies
-- ensure clarity if RLS is ever forced on for service_role.
CREATE POLICY "Service role can manage all documents"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- Allow public read access for documents (since bucket is public)
-- This enables direct URL access to uploaded documents
CREATE POLICY "Public read access for documents"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'documents');
