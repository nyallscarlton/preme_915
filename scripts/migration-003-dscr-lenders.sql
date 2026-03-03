-- ═══════════════════════════════════════════════════════
-- DSCR Lender Matching Engine — Database Migration
-- Preme Home Loans — Marathon Empire Holdings
-- ═══════════════════════════════════════════════════════

-- 1. DSCR Lenders Table
CREATE TABLE IF NOT EXISTS dscr_lenders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  contact_email TEXT,
  min_fico INT,
  min_loan NUMERIC,
  max_loan NUMERIC,
  min_dscr NUMERIC,
  max_units INT,
  min_purchase_price NUMERIC,
  min_sq_ft INT,
  max_acreage NUMERIC,
  llc_layering TEXT,        -- 'true','false','exception',NULL
  section8 TEXT,            -- 'true','false','higher_rate','expanded','exception',NULL
  subordinate TEXT,         -- 'true','false','solar','series3',NULL
  first_time_buyer TEXT,    -- 'true','false','exception',NULL
  report_credit BOOLEAN,
  state_req BOOLEAN,
  blanket_loans BOOLEAN,
  follows_trid BOOLEAN DEFAULT false,
  recourse TEXT,
  max_seller_concessions NUMERIC,
  total_lender_fees NUMERIC,
  max_term TEXT,
  ppp TEXT,
  if_unrented TEXT,
  ltv JSONB NOT NULL,
  states TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Match Results Table (audit trail)
CREATE TABLE IF NOT EXISTS dscr_match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID,
  application_snapshot JSONB NOT NULL,
  qualified_count INT NOT NULL,
  disqualified_count INT NOT NULL,
  results JSONB NOT NULL,
  matched_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_dscr_lenders_active ON dscr_lenders(active);
CREATE INDEX IF NOT EXISTS idx_dscr_lenders_states ON dscr_lenders USING GIN(states);
CREATE INDEX IF NOT EXISTS idx_dscr_match_results_app ON dscr_match_results(application_id);
CREATE INDEX IF NOT EXISTS idx_dscr_match_results_date ON dscr_match_results(created_at DESC);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_dscr_lender_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_dscr_lender_updated_at ON dscr_lenders;
CREATE TRIGGER set_dscr_lender_updated_at
  BEFORE UPDATE ON dscr_lenders
  FOR EACH ROW EXECUTE FUNCTION update_dscr_lender_timestamp();

-- 5. RLS Policies (admin/service_role access only)
ALTER TABLE dscr_lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dscr_match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on dscr_lenders"
  ON dscr_lenders FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on dscr_match_results"
  ON dscr_match_results FOR ALL
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- 6. SEED ALL 38 LENDERS
-- Sources: dscr-matching-engine.js (22 with full data)
--          dscr-lender-matcher.jsx (16 additional)
-- ═══════════════════════════════════════════════════════

INSERT INTO dscr_lenders (id, name, short_name, contact_email, min_fico, min_loan, max_loan, min_dscr, max_units, min_purchase_price, min_sq_ft, max_acreage, llc_layering, section8, subordinate, first_time_buyer, report_credit, state_req, blanket_loans, follows_trid, recourse, max_seller_concessions, total_lender_fees, max_term, ppp, if_unrented, ltv, states)
VALUES
-- ── 1. UWM ──
('UWM', 'United Wholesale Mortgage', 'UWM', '', 620, 0, 2000000, 0, 4, 0, 600, 20,
 'false', NULL, 'true', 'false', true, true, false, true,
 'RECOURSE', 0.06, 1433, '30yr', '3yr', 'NO PROBLEM',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NV','NJ','NY','NC','ND','OR','SD','TN','UT','VT']),

-- ── 2. PRMG ──
('PRMG', 'PRMG', 'PRMG', 'Mike.Miller@PRMG.NET', 660, 75000, 2000000, 0.75, 4, NULL, 600, 5,
 'false', NULL, NULL, 'false', true, true, false, true,
 'RECOURSE', 0.03, 1285, NULL, NULL, 'MAX LTV 70%',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.7,"fnRT":0.7,"fnCO":0.6}'::jsonb,
 ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']),

-- ── 3. NewRez ──
('NewRez', 'NewRez', 'NewRez', 'peter.mcguire@newrez.com', 680, 100000, 1000000, 0, 4, NULL, 500, 20,
 'false', 'true', 'false', 'false', true, true, false, true,
 'RECOURSE', 0.02, 1475, '40yr', '3yr', '110% max',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0.8,"condotelRT":0.8,"condotelCO":0.75,"strPurch":0.8,"strRT":0.75,"strCO":0.7,"fnPurch":0.7,"fnRT":0.7,"fnCO":0}'::jsonb,
 ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']),

-- ── 4. KIND Lending ──
('KIND', 'KIND Lending', 'KIND', 'fuzz@kindlending.com', 620, 100000, 3000000, 0, 4, NULL, 600, 20,
 'false', NULL, NULL, 'false', true, true, false, false,
 'RECOURSE', 0.03, 1915, '40yr', '5yr', '70LTV Max',
 '{"purchaseSF":0.85,"rtSF":0.85,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.7,"condotelPurch":0.75,"condotelRT":0.75,"condotelCO":0.7,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.75,"fnRT":0.75,"fnCO":0.65}'::jsonb,
 ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']),

-- ── 5. Emporium ──
('Emporium', 'Emporium', 'Emporium', 'chris.leone@emporiumtpo.com', 700, 100000, 3000000, 1, 4, NULL, 500, 20,
 'true', 'true', 'false', 'false', false, false, false, false,
 'RECOURSE', 0.03, 1860, '40yr', '5yr', 'NO PROBLEM',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.75,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0.7,"fnRT":0.7,"fnCO":0.7}'::jsonb,
 ARRAY['AZ','CA','ID','IA','MN','NV','ND','OR','SD']),

-- ── 6. Ice Cap Group ──
('IceCap', 'Ice Cap Group', 'Ice Cap', 'dharben@icecapgroup.com', 660, 150000, 6250000, 0.75, 9, NULL, 700, 2,
 'true', 'true', 'false', 'false', false, false, true, false,
 'RECOURSE', NULL, 1830, '30yr', '5yr', '5%LTV Ded',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.75,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.7,"mixedCO":0.65,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0.75,"fnRT":0.75,"fnCO":0.65}'::jsonb,
 '{}'::text[]),

-- ── 7. OakTree Funding ──
('OakTree', 'OakTree Funding', 'OakTree', 'vdinapoli@oaktreefunding.com', 620, 150000, 3000000, 0.75, 8, NULL, NULL, NULL,
 'true', 'exception', 'true', 'true', true, true, true, false,
 'RECOURSE', 0.02, 2070, '40yr', NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.7,"purchase34":0.8,"rt34":0.8,"cashout34":0.7,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.75,"mixedCO":0.7,"nwCondoPurch":0.7,"nwCondoRT":0.7,"nwCondoCO":0.65,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.75,"strCO":0.75,"fnPurch":0.75,"fnRT":0.75,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','FL','GA','ID','IL','LA','MA','MI','MN','MT','NE','NV','NJ','NC','OR','PA','TN','UT','VT','VA']),

-- ── 8. Logan Finance ──
('Logan', 'Logan Finance', 'Logan', 'dmcmullen@loganfinance.com', 660, 125000, 3000000, 0, 4, NULL, NULL, NULL,
 'false', 'true', NULL, 'true', false, false, false, false,
 NULL, 0.02, 2465, NULL, '5yr', 'NO PROBLEM',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.75,"fnRT":0.75,"fnCO":0.7}'::jsonb,
 ARRAY['AZ','CA','ID','MN','NV','NM','NC','ND','OR','SD','UT','VT']),

-- ── 9. DeepHaven Mortgage ──
('DeepHaven', 'DeepHaven Mortgage', 'DeepHaven', 'jwilson@deephavenmortgage.com', 660, 100000, 2000000, 0.75, 9, NULL, 600, 20,
 'true', 'true', 'true', 'false', true, true, true, true,
 'RECOURSE', 0.03, 2489, '30yr', '5yr', '70%LTV',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.7,"fnRT":0.7,"fnCO":0.6}'::jsonb,
 ARRAY['AZ','CA','ID','IL','MI','MN','NV','NJ','NC','ND','OR','RI','SD','UT','VA']),

-- ── 10. Forward Lending ──
('Forward', 'Forward Lending', 'Forward', 'lhopkins@forwardlendingmtg.com', 620, 100000, 3500000, 0.75, 4, NULL, 600, 25,
 'false', NULL, NULL, 'false', true, true, false, false,
 NULL, 0.03, 2145, '40yr', '6mo Interest', '70%LTV',
 '{"purchaseSF":0.85,"rtSF":0.85,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0.75,"fnRT":0.75,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','IL','MI','MN','NV','NJ','NC','ND','OR','SD','UT','VA']),

-- ── 11. HomeX Mortgage ──
('HomeX', 'HomeX Mortgage', 'HomeX', 'arestrepo@homexmortgage.com', 620, 100000, 2500000, 0, 4, NULL, 500, 10,
 'false', 'true', 'true', 'true', true, true, false, false,
 'RECOURSE', 0.06, 2509, '40yr', '5yr', 'LOX needed',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.8,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.8,"purchase34":0.8,"rt34":0.8,"cashout34":0.8,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.8,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.75,"strCO":0.75,"fnPurch":0.7,"fnRT":0.65,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NE','NV','OR','UT','VA']),

-- ── 12. American Heritage Lending ──
('AmHeritage', 'American Heritage Lending', 'Am Heritage', 'jennifer.sullivan@ahlend.com', 660, 75000, 3000000, 0, 4, NULL, 500, 10,
 'true', NULL, 'false', 'false', false, false, false, false,
 NULL, 0.06, 1795, '40yr', '5yr', 'NO PROBLEM',
 '{"purchaseSF":0.85,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.7,"condotelPurch":0.7,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.75,"fnPurch":0.75,"fnRT":0.7,"fnCO":0.7}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','ND','OR','SD','UT','VT']),

-- ── 13. VISIO Lending ──
('VISIO', 'VISIO Lending', 'VISIO', 'matt.priester@visiolending.com', 680, 75000, NULL, 0.75, 4, 125000, 500, 5,
 'true', NULL, 'false', 'true', false, false, false, false,
 'RECOURSE', 0.03, 3265, '30yr', '5yr', 'NO PROBLEM',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 '{}'::text[]),

-- ── 14. Constructive Mortgage ──
('Constructive', 'Constructive Mortgage', 'Constructive', 'tantonson@cmwholesale.com', 660, 50000, 2000000, 0.75, 8, 75000, 700, 10,
 'true', 'expanded', 'false', 'false', false, false, true, false,
 'RECOURSE', 0.02, 2355, '30yr', '5yr', 'NOT ALLOWED',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.65,"nwCondoRT":0.65,"nwCondoCO":0.65,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 '{}'::text[]),

-- ── 15. Cake Home ──
('Cake', 'Cake Home', 'Cake', 'kyle.pontello@cakehome.com', 620, 75000, 3500000, 0.75, 4, 115000, NULL, 20,
 'false', NULL, 'solar', NULL, true, true, false, true,
 'RECOURSE', 0.06, 1595, '30yr', NULL, '5%LTV red',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0.7,"mfgRT":0.7,"mfgCO":0.7,"mixedPurch":0.7,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0.75,"condotelRT":0.75,"condotelCO":0.65,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.65,"fnRT":0.65,"fnCO":0.6}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','MT','NV','NJ','NC','OR','TN','UT','VA']),

-- ── 16. Kiavi ──
('Kiavi', 'Kiavi', 'Kiavi', 'andrew.noska@kiavi.com', 660, 75000, 1500000, 1, 4, 100000, 1, NULL,
 'true', 'true', 'false', 'false', true, false, false, false,
 'RECOURSE', NULL, 1999, '30yr', '3yr', '70%LTV max',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.8,"purchaseDuplex":0.75,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0,"strRT":0,"strCO":0,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 '{}'::text[]),

-- ── 17. Angel Oak Mortgage ──
('AngelOak', 'Angel Oak Mortgage', 'Angel Oak', 'grant.twenter@angeloakms.com', 680, 100000, 2000000, 0, 4, 115000, 450, 10,
 'true', 'true', 'true', 'false', true, true, false, false,
 'RECOURSE', 0.06, 1915, '30yr', '4yr', 'NO PROBLEM',
 '{"purchaseSF":0.85,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.85,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.85,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0.7,"fnRT":0.7,"fnCO":0.65}'::jsonb,
 ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WV','WI','WY']),

-- ── 18. Lendz Financial ──
('Lendz', 'Lendz Financial', 'Lendz', 'mike.boghos@lendzfinancial.com', 620, 100000, 3500000, 0, 8, NULL, 500, 20,
 'true', 'true', 'series3', 'false', false, true, true, false,
 'RECOURSE', 0.06, 1905, '40yr', '5yr', 'NO PROBLEM',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.7,"mixedCO":0.65,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0.8,"condotelRT":0.75,"condotelCO":0.75,"strPurch":0.75,"strRT":0.7,"strCO":0.7,"fnPurch":0.75,"fnRT":0.7,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NV','NJ','NC','ND','OR','SD','UT','VA']),

-- ── 19. NexBank ──
('NexBank', 'NexBank', 'NexBank', 'stacey.faul@nexbank.com', 700, 200000, 2000000, 0.75, 4, NULL, 0, 10,
 'false', NULL, NULL, 'false', true, true, false, true,
 'RECOURSE', 0.04, 1615, '30yr', 'NO', 'NO PROBLEM',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']),

-- ── 20. NQM Funding ──
('NQM', 'NQM Funding', 'NQM', 'apierson@nqmf.com', 640, 75000, 3000000, 0, 10, 115000, 400, 2,
 'exception', 'true', 'true', 'exception', false, false, NULL, false,
 'NON-Recourse', NULL, 1890, '40yr', NULL, '75% 1007 rents',
 '{"purchaseSF":0.85,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.85,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.85,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.75,"mixedCO":0.7,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0.7,"condotelRT":0.7,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.75,"fnPurch":0.7,"fnRT":0.7,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NV','NJ','NY','NC','ND','OR','RI','SD','UT','VA']),

-- ── 21. ACRA Lending ──
('ACRA', 'ACRA Lending', 'ACRA', 'gidon.magier@acralending.com', 600, 100000, 3000000, 0, 4, NULL, NULL, 25,
 'true', 'false', 'true', NULL, NULL, true, false, false,
 'RECOURSE', NULL, 2365, '40yr', '5yr', '5%LTV ded',
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0.7,"mfgRT":0.65,"mfgCO":0.65,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.7,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.7,"strRT":0.65,"strCO":0.65,"fnPurch":0.75,"fnRT":0.7,"fnCO":0.7}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NV','NJ','NC','ND','OR','SD','TN','UT','VA']),

-- ── 22. Conventus Lending ──
('Conventus', 'Conventus Lending', 'Conventus', 'austin@cvlending.com', 660, 100000, 3000000, 0.8, 8, NULL, 500, 9,
 'true', 'false', 'false', 'false', false, true, true, false,
 'RECOURSE', NULL, 999, '30yr', '5yr', '10% reduction in rent',
 '{"purchaseSF":0.8,"rtSF":0.75,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.7,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.65,"nwCondoRT":0.65,"nwCondoCO":0.65,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.65,"strRT":0.65,"strCO":0.65,"fnPurch":0.65,"fnRT":0.65,"fnCO":0.65}'::jsonb,
 ARRAY['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']),

-- ═══════════════════════════════════════════════════════
-- REMAINING 16 LENDERS (from JSX prototype, extended fields TBD)
-- ═══════════════════════════════════════════════════════

-- ── 23. AmWest ──
('AmWest', 'AmWest', 'AmWest', NULL, 640, 75000, 2500000, 0, 4, NULL, NULL, NULL,
 NULL, NULL, NULL, 'true', true, true, false, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.55,"nwCondoRT":0.55,"nwCondoCO":0.5,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0.7,"fnRT":0.65,"fnCO":0.55}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NV','ND','OR','SD','UT','VT']),

-- ── 24. Plaza ──
('Plaza', 'Plaza', 'Plaza', NULL, 640, 100000, 3500000, 0.75, 4, NULL, NULL, NULL,
 'false', NULL, 'true', 'false', NULL, true, false, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.7,"cashout34":0.7,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.8,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.7,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AL','AK','AZ','CA','ME','MI','MN','MS','NV','OR','RI','SD','TN','UT','VA','WA','WY']),

-- ── 25. NewFI ──
('NewFI', 'NewFI', 'NewFI', NULL, 640, 100000, 2500000, 0.8, 4, NULL, NULL, NULL,
 'true', 'true', 'true', 'false', true, true, false, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.8,"mixedRT":0.8,"mixedCO":0.75,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.75,"strRT":0.75,"strCO":0.75,"fnPurch":0.75,"fnRT":0.75,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','MS','NV','NJ','NC','ND','OR','PA','SD','UT','VT','VA']),

-- ── 26. REMN ──
('REMN', 'REMN', 'REMN', NULL, 660, 125000, 2000000, 0.75, 4, NULL, NULL, NULL,
 NULL, 'true', NULL, NULL, NULL, true, NULL, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.7,"purchaseDuplex":0.75,"rtDuplex":0.75,"cashoutDuplex":0.7,"purchase34":0.75,"rt34":0.75,"cashout34":0.7,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.7,"condotelPurch":0.75,"condotelRT":0.75,"condotelCO":0.7,"strPurch":0.75,"strRT":0.7,"strCO":0.7,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AK','IA','MI','MN','NV','ND','OR','SD','UT','VT']),

-- ── 27. RCN Capital ──
('RCN', 'RCN Capital', 'RCN', NULL, 660, 55000, 2000000, 1.05, 9, NULL, NULL, NULL,
 'true', 'higher_rate', 'false', 'true', false, false, true, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0.7,"nwCondoRT":0.7,"nwCondoCO":0.65,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.7,"strRT":0.7,"strCO":0.65,"fnPurch":0.65,"fnRT":0.65,"fnCO":0.6}'::jsonb,
 ARRAY['AZ','CA','MN','OR']),

-- ── 28. The Lender ──
('TheLender', 'The Lender', 'The Lender', NULL, 640, 100000, 3500000, 0, 8, NULL, NULL, NULL,
 'true', NULL, NULL, 'false', NULL, true, NULL, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.85,"rtSF":0.8,"cashoutSF":0.8,"purchaseDuplex":0.85,"rtDuplex":0.8,"cashoutDuplex":0.8,"purchase34":0.85,"rt34":0.8,"cashout34":0.8,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.7,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.75,"fnPurch":0.75,"fnRT":0.65,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','IA','MI','MN','NV','NJ','NY','NC','ND','OR','SD','UT','VT','VA']),

-- ── 29. AD Mortgage ──
('ADMortgage', 'AD Mortgage', 'AD Mortgage', NULL, 620, 100000, 3000000, 0, 8, NULL, NULL, NULL,
 'true', NULL, 'true', 'true', true, true, false, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0.7,"mfgRT":0.7,"mfgCO":0.7,"mixedPurch":0.7,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.7,"condotelPurch":0.75,"condotelRT":0.75,"condotelCO":0.65,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.7,"fnRT":0.7,"fnCO":0.7}'::jsonb,
 ARRAY['AZ','CA','HI','ID','MI','MN','NV','NJ','ND','OR','SD','UT','VT','VA']),

-- ── 30. Champions ──
('Champions', 'Champions', 'Champions', NULL, 620, 100000, 3000000, 0.5, 4, NULL, NULL, NULL,
 NULL, NULL, NULL, 'true', NULL, true, NULL, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.75,"cashoutSF":0.75,"purchaseDuplex":0.75,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.75,"strRT":0.7,"strCO":0.7,"fnPurch":0.7,"fnRT":0.65,"fnCO":0.65}'::jsonb,
 ARRAY['MI','MN','IA','NV','ND','OR','SD','UT']),

-- ── 31. Orion ──
('Orion', 'Orion', 'Orion', NULL, 620, 100000, 2500000, 0.85, 4, NULL, NULL, NULL,
 'true', NULL, NULL, 'false', false, true, NULL, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.8,"nwCondoRT":0.8,"nwCondoCO":0.75,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0.75,"fnRT":0.65,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','ID','IA','KS','MI','MN','MT','NE','NV','NJ','NY','NC','ND','OR','SD','TN','UT','VT','VA','WV','WI']),

-- ── 32. Valere ──
('Valere', 'Valere', 'Valere', NULL, 620, 100000, 3000000, 0, NULL, NULL, NULL, NULL,
 'true', 'true', NULL, 'false', false, true, NULL, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.85,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.85,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.85,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.75,"mixedRT":0.7,"mixedCO":0.7,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.85,"strRT":0.8,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AZ','CA','ID','IL','MI','MN','NV','NJ','NY','NC','ND','OR','SD','UT','VT','VA','WV']),

-- ── 33. Lendsure ──
('Lendsure', 'Lendsure', 'Lendsure', NULL, 660, 100000, 3000000, 0.75, 10, NULL, NULL, NULL,
 'false', NULL, 'false', 'exception', false, false, true, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.85,"rtSF":0.75,"cashoutSF":0.75,"purchaseDuplex":0.85,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.85,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.7,"mixedRT":0.65,"mixedCO":0.6,"nwCondoPurch":0.75,"nwCondoRT":0.75,"nwCondoCO":0.75,"condotelPurch":0.75,"condotelRT":0.65,"condotelCO":0.65,"strPurch":0.75,"strRT":0.75,"strCO":0.75,"fnPurch":0.65,"fnRT":0.6,"fnCO":0}'::jsonb,
 ARRAY['AZ','CA','ID','MI','MN','NV','NJ','NC','ND','OR','SD','UT','VT']),

-- ── 34. Vontive ──
('Vontive', 'Vontive', 'Vontive', NULL, 680, 100000, 2000000, 1.05, 10, NULL, NULL, NULL,
 'true', NULL, 'false', NULL, false, false, true, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.75,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.75,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 '{}'::text[]),

-- ── 35. Carrington ──
('Carrington', 'Carrington', 'Carrington', NULL, 620, 100000, 3000000, 0.75, 4, NULL, NULL, NULL,
 'false', 'false', 'true', 'true', true, false, false, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.85,"rtSF":0.85,"cashoutSF":0.75,"purchaseDuplex":0.75,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.75,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.75,"strRT":0.75,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AZ','CA','DE','ID','IL','MA','MI','NV','NJ','NY','NC','ND','OR','RI','SD','UT','VT','WV']),

-- ── 36. EasyStreet ──
('EasyStreet', 'EasyStreet', 'EasyStreet', NULL, 660, 75000, 2000000, 0, NULL, NULL, NULL, NULL,
 'true', 'true', 'false', 'true', false, false, NULL, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.8,"strRT":0.8,"strCO":0.75,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 '{}'::text[]),

-- ── 37. Silver Hill ──
('SilverHill', 'Silver Hill', 'Silver Hill', NULL, 660, 100000, 2000000, 0.75, 4, NULL, NULL, NULL,
 'true', 'true', 'false', 'false', false, false, true, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.75,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.75,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.75,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0.8,"mixedRT":0.8,"mixedCO":0.75,"nwCondoPurch":0.7,"nwCondoRT":0.7,"nwCondoCO":0.7,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0.6,"strRT":0.6,"strCO":0.6,"fnPurch":0,"fnRT":0,"fnCO":0}'::jsonb,
 ARRAY['AZ','CA','NV','NJ','NY','OR']),

-- ── 38. Finance of America ──
('FOA', 'Finance of America', 'FOA', NULL, 660, 75000, 2000000, 1.1, 10, NULL, NULL, NULL,
 'true', 'true', 'false', 'false', false, false, true, false,
 NULL, NULL, NULL, NULL, NULL, NULL,
 '{"purchaseSF":0.8,"rtSF":0.8,"cashoutSF":0.75,"purchaseDuplex":0.8,"rtDuplex":0.8,"cashoutDuplex":0.75,"purchase34":0.8,"rt34":0.8,"cashout34":0.75,"mfgPurch":0,"mfgRT":0,"mfgCO":0,"mixedPurch":0,"mixedRT":0,"mixedCO":0,"nwCondoPurch":0,"nwCondoRT":0,"nwCondoCO":0,"condotelPurch":0,"condotelRT":0,"condotelCO":0,"strPurch":0,"strRT":0,"strCO":0,"fnPurch":0.65,"fnRT":0.65,"fnCO":0.65}'::jsonb,
 ARRAY['AZ','CA','NV'])

ON CONFLICT (id) DO NOTHING;
