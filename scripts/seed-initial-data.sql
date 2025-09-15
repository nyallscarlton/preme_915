-- Seed initial data for PREME Loan Applications Portal

-- Insert default admin user
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@preme.com', '$2b$10$dummy_hash_for_demo', 'admin', 'Admin', 'User', '555-0100'),
('550e8400-e29b-41d4-a716-446655440001', 'demo@example.com', '$2b$10$dummy_hash_for_demo', 'applicant', 'Demo', 'Applicant', '555-0101')
ON CONFLICT (email) DO NOTHING;

-- Insert default checklist templates
INSERT INTO checklist_templates (id, name, description, loan_type, created_by) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Standard Mortgage Application', 'Standard checklist for residential mortgage applications', 'mortgage', '550e8400-e29b-41d4-a716-446655440000'),
('660e8400-e29b-41d4-a716-446655440001', 'Commercial Loan Application', 'Checklist for commercial property loans', 'commercial', '550e8400-e29b-41d4-a716-446655440000'),
('660e8400-e29b-41d4-a716-446655440002', 'Personal Loan Application', 'Checklist for personal loans', 'personal', '550e8400-e29b-41d4-a716-446655440000')
ON CONFLICT (id) DO NOTHING;

-- Insert checklist template items for Standard Mortgage
INSERT INTO checklist_template_items (template_id, item_name, description, is_required, sort_order) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Income Verification', 'W-2 forms, pay stubs, tax returns', true, 1),
('660e8400-e29b-41d4-a716-446655440000', 'Credit Report', 'Recent credit report from all three bureaus', true, 2),
('660e8400-e29b-41d4-a716-446655440000', 'Bank Statements', 'Last 3 months of bank statements', true, 3),
('660e8400-e29b-41d4-a716-446655440000', 'Property Appraisal', 'Professional property appraisal', true, 4),
('660e8400-e29b-41d4-a716-446655440000', 'Insurance Documentation', 'Homeowners insurance policy', true, 5),
('660e8400-e29b-41d4-a716-446655440000', 'Employment Verification', 'Letter from employer', true, 6),
('660e8400-e29b-41d4-a716-446655440000', 'Asset Documentation', 'Investment accounts, retirement funds', false, 7),
('660e8400-e29b-41d4-a716-446655440000', 'Debt Documentation', 'Current loan statements, credit card balances', true, 8);

-- Insert checklist template items for Commercial Loan
INSERT INTO checklist_template_items (template_id, item_name, description, is_required, sort_order) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'Business Financial Statements', 'Last 3 years of business financials', true, 1),
('660e8400-e29b-41d4-a716-446655440001', 'Business Tax Returns', 'Corporate tax returns', true, 2),
('660e8400-e29b-41d4-a716-446655440001', 'Commercial Property Appraisal', 'Professional commercial appraisal', true, 3),
('660e8400-e29b-41d4-a716-446655440001', 'Business License', 'Current business license and permits', true, 4),
('660e8400-e29b-41d4-a716-446655440001', 'Cash Flow Projections', 'Business cash flow analysis', true, 5),
('660e8400-e29b-41d4-a716-446655440001', 'Personal Guarantor Information', 'Personal financial information of guarantors', true, 6);

-- Insert checklist template items for Personal Loan
INSERT INTO checklist_template_items (template_id, item_name, description, is_required, sort_order) VALUES
('660e8400-e29b-41d4-a716-446655440002', 'Income Verification', 'Pay stubs and employment letter', true, 1),
('660e8400-e29b-41d4-a716-446655440002', 'Credit Report', 'Recent credit report', true, 2),
('660e8400-e29b-41d4-a716-446655440002', 'Bank Statements', 'Last 2 months of bank statements', true, 3),
('660e8400-e29b-41d4-a716-446655440002', 'Identification', 'Government-issued photo ID', true, 4),
('660e8400-e29b-41d4-a716-446655440002', 'Proof of Address', 'Utility bill or lease agreement', true, 5);

-- Insert sample loan application
INSERT INTO loan_applications (
    id, applicant_id, application_number, status, loan_amount, loan_purpose, 
    loan_term_months, property_address, property_type, property_value, 
    down_payment, annual_income, employment_status, employer_name, 
    employment_years, credit_score, existing_debts, cash_reserves
) VALUES (
    '770e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    'PREME-2024-001',
    'submitted',
    450000.00,
    'Primary residence purchase',
    360,
    '123 Main Street, Beverly Hills, CA 90210',
    'Single Family Home',
    500000.00,
    100000.00,
    120000.00,
    'Full-time',
    'Tech Corp Inc.',
    5,
    750,
    25000.00,
    150000.00
) ON CONFLICT (id) DO NOTHING;
