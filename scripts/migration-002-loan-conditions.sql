-- Preme Home Loans Portal — Migration 002: Loan Condition Management System
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
--
-- This migration creates the wholesale lender condition tracking system.
-- The existing "conditions" table (from migration-001) is applicant-facing.
-- This system tracks underwriting conditions from wholesale lenders (Logan Finance, etc.)

-- ============================================================
-- 1. LOANS TABLE (wholesale lender submissions)
-- ============================================================
-- Separate from loan_applications (consumer submissions to Preme).
-- This tracks deals submitted to wholesale lenders like Logan Finance.

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL,
  borrower_name TEXT,
  property_address TEXT,
  lender TEXT NOT NULL,
  loan_amount DECIMAL(12,2),
  loan_type TEXT,
  loan_program TEXT,
  closing_date DATE,
  status TEXT NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Active', 'Closed', 'Cancelled', 'Suspended')),
  conditions_total INTEGER NOT NULL DEFAULT 0,
  conditions_open INTEGER NOT NULL DEFAULT 0,
  conditions_closed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loans_loan_number
  ON loans(loan_number);

CREATE INDEX IF NOT EXISTS idx_loans_status
  ON loans(status);

CREATE INDEX IF NOT EXISTS idx_loans_lender
  ON loans(lender);

-- ============================================================
-- 2. LOAN_CONDITIONS TABLE
-- ============================================================
-- Named loan_conditions to avoid collision with existing "conditions" table.
-- Stores normalized underwriting conditions from any lender.

CREATE TABLE IF NOT EXISTS loan_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  external_id TEXT,
  lender TEXT NOT NULL,
  condition_type TEXT,
  title TEXT NOT NULL,
  description TEXT,
  description_details TEXT,
  category TEXT,
  prior_to TEXT,
  status TEXT NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open', 'Received', 'Cleared', 'Waived', 'Closed')),
  sub_status TEXT,
  action_owner TEXT
    CHECK (action_owner IS NULL OR action_owner IN (
      'broker', 'title_company', 'lender_internal',
      'insurance_agent', 'closing_auto', 'other'
    )),
  action_owner_name TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
  action_summary TEXT,
  created_date TIMESTAMPTZ,
  received_date TIMESTAMPTZ,
  cleared_date TIMESTAMPTZ,
  waived_date TIMESTAMPTZ,
  status_date TIMESTAMPTZ,
  source TEXT,
  requested_from TEXT,
  is_received BOOLEAN NOT NULL DEFAULT FALSE,
  is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  is_waived BOOLEAN NOT NULL DEFAULT FALSE,
  allow_to_clear BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  last_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_loan_conditions_loan_id
  ON loan_conditions(loan_id);

CREATE INDEX IF NOT EXISTS idx_loan_conditions_status
  ON loan_conditions(status);

CREATE INDEX IF NOT EXISTS idx_loan_conditions_action_owner
  ON loan_conditions(action_owner);

-- For import matching: find existing condition by lender external_id
CREATE INDEX IF NOT EXISTS idx_loan_conditions_external_id
  ON loan_conditions(external_id);

-- For filtering by priority and blocking
CREATE INDEX IF NOT EXISTS idx_loan_conditions_priority
  ON loan_conditions(priority) WHERE status = 'Open';

CREATE INDEX IF NOT EXISTS idx_loan_conditions_blocking
  ON loan_conditions(is_blocking) WHERE is_blocking = TRUE;

-- ============================================================
-- 3. CONDITION_HISTORY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS condition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id UUID NOT NULL REFERENCES loan_conditions(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_source TEXT
    CHECK (change_source IS NULL OR change_source IN ('import', 'manual', 'agent')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_condition_history_condition_id
  ON condition_history(condition_id);

-- ============================================================
-- 4. LENDER_IMPORTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS lender_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id),
  lender TEXT NOT NULL,
  import_source TEXT
    CHECK (import_source IS NULL OR import_source IN ('excel_upload', 'api', 'browser_scrape')),
  file_name TEXT,
  conditions_created INTEGER NOT NULL DEFAULT 0,
  conditions_updated INTEGER NOT NULL DEFAULT 0,
  conditions_unchanged INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_lender_imports_loan_id
  ON lender_imports(loan_id);

-- ============================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================

-- Generic updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to loans
DROP TRIGGER IF EXISTS set_loans_updated_at ON loans;
CREATE TRIGGER set_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apply to loan_conditions
DROP TRIGGER IF EXISTS set_loan_conditions_updated_at ON loan_conditions;
CREATE TRIGGER set_loan_conditions_updated_at
  BEFORE UPDATE ON loan_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

-- Loans table RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Lenders and admins can do everything with loans
CREATE POLICY "Lenders and admins full access to loans"
  ON loans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- Service role (API routes) bypasses RLS automatically

-- Loan conditions RLS
ALTER TABLE loan_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders and admins full access to loan_conditions"
  ON loan_conditions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- Condition history RLS
ALTER TABLE condition_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders and admins read condition_history"
  ON condition_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- Lender imports RLS
ALTER TABLE lender_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lenders and admins read lender_imports"
  ON lender_imports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('lender', 'admin')
    )
  );

-- ============================================================
-- 7. HELPER: Recalculate loan condition counts
-- ============================================================
-- Called after imports or manual status changes.

CREATE OR REPLACE FUNCTION public.recalculate_loan_condition_counts(target_loan_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE loans SET
    conditions_total = (
      SELECT COUNT(*) FROM loan_conditions WHERE loan_id = target_loan_id
    ),
    conditions_open = (
      SELECT COUNT(*) FROM loan_conditions
      WHERE loan_id = target_loan_id AND status = 'Open'
    ),
    conditions_closed = (
      SELECT COUNT(*) FROM loan_conditions
      WHERE loan_id = target_loan_id AND status = 'Closed'
    )
  WHERE id = target_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
