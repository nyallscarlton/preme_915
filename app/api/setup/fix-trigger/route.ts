import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// One-time setup endpoint to fix the profiles trigger
// The trigger was inserting into 'id' instead of 'user_id'
export async function POST(request: Request) {
  // Simple auth check — only allow with a secret header
  const authHeader = request.headers.get("x-setup-key")
  if (authHeader !== "preme-setup-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Try using the service role key (may fail if invalid)
  const supabase = createClient(supabaseUrl, serviceKey)

  const sql = `
    -- Fix the trigger to use user_id column instead of id
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
      VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'applicant')
      );
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      -- Don't block signup if profile creation fails
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Recreate the trigger
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

    -- Also add an RLS policy allowing users to insert their own profile
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'profiles'
      ) THEN
        CREATE POLICY "Users can insert own profile"
          ON profiles FOR INSERT
          WITH CHECK (auth.uid() = user_id);
      END IF;
    END $$;
  `

  const { error } = await supabase.rpc("exec_sql", { sql_text: sql })

  if (error) {
    // If RPC doesn't exist, return the SQL for manual execution
    return NextResponse.json({
      error: error.message,
      manual_sql: sql,
      instructions: "Run this SQL in Supabase Dashboard → SQL Editor",
    })
  }

  return NextResponse.json({ success: true })
}
