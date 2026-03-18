/**
 * One-time setup route to create the call_reviews table.
 * DELETE THIS FILE after running once.
 */
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const supabase = createAdminClient()

  // Create table using individual column inserts via RPC won't work,
  // but we can check if table exists and if not, create via raw SQL workaround
  // Using the trick: create a function that creates the table, call it, then drop it

  // Step 1: Try to query the table
  const { error: checkError } = await supabase.from("call_reviews").select("id").limit(1)

  if (!checkError) {
    return NextResponse.json({ status: "table already exists" })
  }

  // Table doesn't exist — we need to create it via SQL
  // Since we can't run DDL through PostgREST, return the SQL for manual execution
  return NextResponse.json({
    status: "table does not exist",
    instruction: "Run the SQL in scripts/migration-004-call-reviews.sql via Supabase Dashboard > SQL Editor",
    sql_preview: "CREATE TABLE call_reviews (id UUID PRIMARY KEY, call_id TEXT UNIQUE, ...)",
  })
}
