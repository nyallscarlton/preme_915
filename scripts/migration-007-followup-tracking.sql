-- Migration 007: Add follow-up tracking columns to loan_applications
-- Supports automated abandoned-application follow-up emails

ALTER TABLE loan_applications
  ADD COLUMN IF NOT EXISTS last_followup_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS followup_count integer NOT NULL DEFAULT 0;

-- Index for efficient querying of draft applications needing follow-ups
CREATE INDEX IF NOT EXISTS idx_loan_applications_followup
  ON loan_applications (status, submitted_at, last_followup_at, created_at)
  WHERE status = 'draft' AND submitted_at IS NULL;
