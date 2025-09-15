-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table with simpler structure
DROP TABLE IF EXISTS profiles CASCADE;
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'investor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applications table
DROP TABLE IF EXISTS applications CASCADE;
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  loan_type TEXT NOT NULL,
  loan_amount DECIMAL(12,2) NOT NULL,
  property_address TEXT,
  status TEXT DEFAULT 'draft',
  application_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
DROP TABLE IF EXISTS documents CASCADE;
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  document_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE applications ADD CONSTRAINT fk_applications_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_application_id FOREIGN KEY (application_id) REFERENCES applications(id);
ALTER TABLE documents ADD CONSTRAINT fk_documents_user_id FOREIGN KEY (user_id) REFERENCES profiles(user_id);

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_application_id ON documents(application_id);

-- Insert a test user to verify the setup works
INSERT INTO profiles (user_id, email, first_name, last_name) 
VALUES (uuid_generate_v4(), 'test@example.com', 'Test', 'User')
ON CONFLICT (email) DO NOTHING;
