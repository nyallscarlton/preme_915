/**
 * One-time migration endpoint. Creates the call_reviews table.
 * Self-destructs after successful run (returns instructions to delete).
 */
import { NextResponse } from "next/server"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "No Supabase credentials" }, { status: 500 })
  }

  // Use the Supabase SQL API (available on service role)
  // PostgREST doesn't support DDL, but we can create a function via RPC
  // that creates the table, then drop it.

  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(url, key)

  // Check if table already exists
  const { error: checkErr } = await supabase.from("call_reviews").select("id").limit(1)
  if (!checkErr) {
    return NextResponse.json({ status: "table already exists" })
  }

  // Try creating via the SQL API endpoint (Supabase v2)
  try {
    const sqlRes = await fetch(`${url}/rest/v1/rpc/exec_raw_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        sql: getCreateTableSQL(),
      }),
    })

    if (sqlRes.ok) {
      return NextResponse.json({ status: "table created via RPC" })
    }
  } catch {}

  // Fallback: return the SQL for manual execution
  return NextResponse.json({
    status: "auto-creation not available",
    message: "Table needs to be created via Supabase Dashboard SQL Editor",
    sql: getCreateTableSQL(),
  })
}

function getCreateTableSQL(): string {
  return `
CREATE TABLE IF NOT EXISTS call_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,
  direction TEXT,
  caller_phone TEXT,
  caller_name TEXT,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript TEXT,
  disconnect_reason TEXT,
  lead_temperature TEXT,
  lead_score INTEGER,
  loan_type TEXT,
  caller_intent TEXT,
  call_summary TEXT,
  score_total INTEGER,
  score_opening INTEGER,
  score_rapport INTEGER,
  score_discovery INTEGER,
  score_qualification INTEGER,
  score_program_knowledge INTEGER,
  score_credit_handling INTEGER,
  score_objection_handling INTEGER,
  score_close INTEGER,
  score_call_control INTEGER,
  score_effectiveness INTEGER,
  coaching_notes TEXT,
  top_fixes TEXT[],
  severity TEXT,
  prompt_patch_applied BOOLEAN DEFAULT FALSE,
  prompt_patch_description TEXT,
  call_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_call_reviews_agent ON call_reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_reviews_call_at ON call_reviews(call_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_reviews_score ON call_reviews(score_total);
`.trim()
}
