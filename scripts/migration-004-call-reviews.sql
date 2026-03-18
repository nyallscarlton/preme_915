-- Migration 004: Call Reviews (Voice Agent Sales Coaching)
-- Auto-generated scorecards from post-call AI analysis

CREATE TABLE IF NOT EXISTS call_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,

  -- Call metadata
  direction TEXT,  -- inbound/outbound
  caller_phone TEXT,
  caller_name TEXT,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript TEXT,
  disconnect_reason TEXT,

  -- Post-call analysis (from Retell)
  lead_temperature TEXT,
  lead_score INTEGER,
  loan_type TEXT,
  caller_intent TEXT,
  call_summary TEXT,

  -- Coaching scorecard (10 categories, each 1-10)
  score_total INTEGER,  -- sum out of 100
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

  -- Coaching content
  coaching_notes TEXT,  -- full coaching analysis markdown
  top_fixes TEXT[],  -- array of top 3 fixes
  severity TEXT,  -- CRITICAL, HIGH, MODERATE, LOW

  -- Self-improvement tracking
  prompt_patch_applied BOOLEAN DEFAULT FALSE,
  prompt_patch_description TEXT,

  -- Timestamps
  call_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for MC dashboard queries
CREATE INDEX IF NOT EXISTS idx_call_reviews_agent ON call_reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_reviews_call_at ON call_reviews(call_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_reviews_score ON call_reviews(score_total);
CREATE INDEX IF NOT EXISTS idx_call_reviews_severity ON call_reviews(severity);
