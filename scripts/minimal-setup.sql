-- Drop everything and start completely fresh
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a very simple profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamp with time zone DEFAULT now()
);

-- No RLS for now to avoid permission issues
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
