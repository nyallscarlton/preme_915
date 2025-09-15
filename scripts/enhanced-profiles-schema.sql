-- Extending existing profiles table for loan portal functionality
-- Add additional fields to the existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS role text DEFAULT 'applicant' CHECK (role IN ('admin', 'applicant')),
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Update the trigger function to handle the new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    first_name, 
    last_name, 
    avatar_url,
    role,
    created_at
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'applicant'),
    timezone('utc'::text, now())
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin user if it doesn't exist
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'admin@preme.com',
  crypt('demo123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"first_name": "Admin", "last_name": "User", "role": "admin"}'::jsonb
) ON CONFLICT (email) DO NOTHING;

-- Create corresponding profile for admin
INSERT INTO public.profiles (
  id,
  first_name,
  last_name,
  full_name,
  role,
  phone,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Admin',
  'User',
  'Admin User',
  'admin',
  '555-0100',
  now()
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  first_name = 'Admin',
  last_name = 'User',
  full_name = 'Admin User',
  phone = '555-0100';
