-- PREME Loan Applications Portal - Simplified Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Loan applications table (simplified - no foreign key to auth.users yet)
CREATE TABLE IF NOT EXISTS loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    applicant_email VARCHAR(255) NOT NULL,
    applicant_name VARCHAR(255),
    applicant_phone VARCHAR(50),
    application_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'on_hold')),
    
    -- Contact Info
    contact_address TEXT,
    contact_city VARCHAR(100),
    contact_state VARCHAR(50),
    contact_zip VARCHAR(20),
    
    -- Loan Details
    loan_amount DECIMAL(15,2),
    loan_purpose TEXT,
    loan_type VARCHAR(100),
    
    -- Property Information
    property_address TEXT,
    property_city VARCHAR(100),
    property_state VARCHAR(50),
    property_zip VARCHAR(20),
    property_type VARCHAR(50),
    property_value DECIMAL(15,2),
    
    -- Financial Information
    annual_income DECIMAL(15,2),
    employment_status VARCHAR(50),
    employer_name VARCHAR(200),
    credit_score_range VARCHAR(50),
    
    -- Sponsor Information
    has_sponsor BOOLEAN DEFAULT false,
    sponsor_name VARCHAR(200),
    sponsor_email VARCHAR(255),
    sponsor_phone VARCHAR(50),
    
    -- Liquidity Information
    cash_reserves DECIMAL(15,2),
    investment_accounts DECIMAL(15,2),
    retirement_accounts DECIMAL(15,2),
    
    -- Guest token for magic link access
    guest_token VARCHAR(255),
    is_guest BOOLEAN DEFAULT false,
    
    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loan_applications_email ON loan_applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_applications_number ON loan_applications(application_number);
CREATE INDEX IF NOT EXISTS idx_loan_applications_guest_token ON loan_applications(guest_token);

-- Enable Row Level Security
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (for guest applications)
CREATE POLICY "Anyone can insert applications" ON loan_applications
    FOR INSERT WITH CHECK (true);

-- Policy: Users can view their own applications by email
CREATE POLICY "Users can view own applications" ON loan_applications
    FOR SELECT USING (true);

-- Policy: Users can update their own applications
CREATE POLICY "Users can update own applications" ON loan_applications
    FOR UPDATE USING (true);
