-- ============================================================================
-- Multi-Agent RFP System Schema Migration
-- Version: 001
-- Description: Adds client_intake table, proposal_feedback table, and updates
--              existing tables for the 8-agent proposal generation system
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

-- Proposal status enum
DO $$ BEGIN
    CREATE TYPE proposal_status AS ENUM (
        'draft', 'intake', 'validating', 'blocked', 
        'processing', 'review', 'completed', 'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Intake status enum
DO $$ BEGIN
    CREATE TYPE intake_status AS ENUM ('draft', 'complete', 'validated', 'approved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Validation status enum
DO $$ BEGIN
    CREATE TYPE validation_status AS ENUM ('pending', 'blocked', 'warnings', 'approved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Agent name enum
DO $$ BEGIN
    CREATE TYPE agent_name AS ENUM (
        'agent_0', 'agent_1', 'agent_2', 'agent_3', 
        'agent_4', 'agent_5', 'agent_6', 'agent_7', 'agent_8'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Clearance level enum
DO $$ BEGIN
    CREATE TYPE clearance_level AS ENUM ('None', 'Secret', 'Top Secret', 'TS/SCI');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Clearance status enum
DO $$ BEGIN
    CREATE TYPE clearance_status AS ENUM ('Active', 'Current', 'Expired', 'In Progress');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CMMC level enum
DO $$ BEGIN
    CREATE TYPE cmmc_level AS ENUM ('None', 'Level 1', 'Level 2', 'Level 3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- FedRAMP level enum
DO $$ BEGIN
    CREATE TYPE fedramp_level AS ENUM ('None', 'Low', 'Moderate', 'High');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Contract type enum
DO $$ BEGIN
    CREATE TYPE contract_type AS ENUM ('FFP', 'T&M', 'Cost-Plus', 'IDIQ', 'BPA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Business structure enum
DO $$ BEGIN
    CREATE TYPE business_structure AS ENUM (
        'LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Sole Proprietor'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Personnel role enum
DO $$ BEGIN
    CREATE TYPE personnel_role AS ENUM (
        'Program Manager', 'Technical Lead', 'Security Lead', 
        'DevSecOps Lead', 'Cloud Architect', 'QA Lead', 'Other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Availability enum
DO $$ BEGIN
    CREATE TYPE availability AS ENUM (
        'Full-time', 'Part-time 50%', 'Part-time 25%', 'As-needed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- UPDATE COMPANIES TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS business_structure text,
    ADD COLUMN IF NOT EXISTS ein text,
    ADD COLUMN IF NOT EXISTS intake_complete boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_intake_date timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- UPDATE PAST_PERFORMANCE TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE past_performance
    ADD COLUMN IF NOT EXISTS customer_office text,
    ADD COLUMN IF NOT EXISTS contract_type text,
    ADD COLUMN IF NOT EXISTS poc_title text,
    ADD COLUMN IF NOT EXISTS poc_verified_date date,
    ADD COLUMN IF NOT EXISTS relevance_tags text[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS cpars_rating text,
    ADD COLUMN IF NOT EXISTS cpars_document_url text,
    ADD COLUMN IF NOT EXISTS customer_testimonial text,
    ADD COLUMN IF NOT EXISTS quantified_outcomes jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- UPDATE PERSONNEL TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE personnel
    ADD COLUMN IF NOT EXISTS clearance_status text,
    ADD COLUMN IF NOT EXISTS clearance_investigation_date date,
    ADD COLUMN IF NOT EXISTS resume_url text,
    ADD COLUMN IF NOT EXISTS commitment_letter boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS resume_updated_date date,
    ADD COLUMN IF NOT EXISTS availability text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Update certifications column to jsonb if it's not already
-- ALTER TABLE personnel ALTER COLUMN certifications TYPE jsonb USING certifications::jsonb;

-- ----------------------------------------------------------------------------
-- UPDATE LABOR_RATES TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE labor_rates
    ADD COLUMN IF NOT EXISTS year_1_rate numeric,
    ADD COLUMN IF NOT EXISTS year_2_rate numeric,
    ADD COLUMN IF NOT EXISTS year_3_rate numeric,
    ADD COLUMN IF NOT EXISTS year_4_rate numeric,
    ADD COLUMN IF NOT EXISTS year_5_rate numeric,
    ADD COLUMN IF NOT EXISTS escalation_rate numeric,
    ADD COLUMN IF NOT EXISTS basis_of_rates text,
    ADD COLUMN IF NOT EXISTS rate_justification text,
    ADD COLUMN IF NOT EXISTS gsa_schedule_number text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- CREATE CLIENT_INTAKE TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_intake (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status text DEFAULT 'draft',
    submitted_at timestamptz,
    validated_at timestamptz,
    validated_by_agent boolean DEFAULT false,
    validation_report jsonb,
    
    -- Section 1: Company Identifiers
    legal_name text,
    dba_name text,
    uei text,
    cage_code text,
    duns text,
    ein text,
    business_structure text,
    years_in_business integer,
    employee_count integer,
    annual_revenue numeric,
    primary_naics text,
    secondary_naics text[] DEFAULT '{}',
    set_aside_certifications jsonb DEFAULT '[]',
    
    -- Section 2: Security Certifications
    cmmc_level text,
    cmmc_cert_number text,
    cmmc_expiration date,
    cmmc_cert_url text,
    fedramp_level text,
    security_certifications jsonb DEFAULT '[]',
    
    -- Section 5: Technical Capabilities
    cloud_platforms jsonb DEFAULT '[]',
    iac_tools text[] DEFAULT '{}',
    container_tools text[] DEFAULT '{}',
    cicd_tools text[] DEFAULT '{}',
    security_tools jsonb DEFAULT '{"siem": [], "vulnerability_scanners": [], "cmmc_controls": []}',
    methodologies text[] DEFAULT '{}',
    proprietary_tools jsonb DEFAULT '[]',
    
    -- Section 6: Pricing Assumptions
    escalation_rate numeric,
    overhead_rate numeric,
    ga_rate numeric,
    fee_margin numeric,
    fringe_rate numeric,
    travel_budget numeric,
    license_costs numeric,
    hardware_costs numeric,
    cloud_costs numeric,
    
    -- Section 7: Facilities
    primary_office jsonb,
    additional_locations jsonb DEFAULT '[]',
    facility_clearance text,
    existing_infrastructure text,
    
    -- Subcontractors
    subcontractors jsonb DEFAULT '[]',
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz
);

-- Create index on company_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_intake_company_id ON client_intake(company_id);

-- ----------------------------------------------------------------------------
-- UPDATE PROPOSAL_JOBS TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS intake_id uuid REFERENCES client_intake(id),
    ADD COLUMN IF NOT EXISTS current_agent text,
    ADD COLUMN IF NOT EXISTS agent_progress jsonb DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS error_log jsonb DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS rfp_file_url text,
    ADD COLUMN IF NOT EXISTS rfp_text text,
    ADD COLUMN IF NOT EXISTS rfp_parsed_data jsonb,
    ADD COLUMN IF NOT EXISTS validation_status text,
    ADD COLUMN IF NOT EXISTS validation_report jsonb,
    ADD COLUMN IF NOT EXISTS content_outlines jsonb,
    ADD COLUMN IF NOT EXISTS volume_page_limits jsonb,
    ADD COLUMN IF NOT EXISTS volume_progress jsonb,
    ADD COLUMN IF NOT EXISTS volume_1_url text,
    ADD COLUMN IF NOT EXISTS volume_2_url text,
    ADD COLUMN IF NOT EXISTS volume_3_url text,
    ADD COLUMN IF NOT EXISTS volume_4_url text,
    ADD COLUMN IF NOT EXISTS compliance_score numeric,
    ADD COLUMN IF NOT EXISTS compliance_report jsonb,
    ADD COLUMN IF NOT EXISTS humanization_report jsonb,
    ADD COLUMN IF NOT EXISTS final_pdf_urls jsonb,
    ADD COLUMN IF NOT EXISTS final_docx_urls jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- CREATE PROPOSAL_FEEDBACK TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS proposal_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id text NOT NULL,
    volume_number integer NOT NULL CHECK (volume_number BETWEEN 1 AND 4),
    section text NOT NULL,
    page_number integer,
    comment text NOT NULL,
    resolved boolean DEFAULT false,
    resolution_note text,
    created_at timestamptz DEFAULT now(),
    resolved_at timestamptz
);

-- Create index on job_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_proposal_feedback_job_id ON proposal_feedback(job_id);

-- ----------------------------------------------------------------------------
-- TRIGGERS FOR UPDATED_AT
-- ----------------------------------------------------------------------------

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for past_performance
DROP TRIGGER IF EXISTS update_past_performance_updated_at ON past_performance;
CREATE TRIGGER update_past_performance_updated_at
    BEFORE UPDATE ON past_performance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for personnel
DROP TRIGGER IF EXISTS update_personnel_updated_at ON personnel;
CREATE TRIGGER update_personnel_updated_at
    BEFORE UPDATE ON personnel
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for labor_rates
DROP TRIGGER IF EXISTS update_labor_rates_updated_at ON labor_rates;
CREATE TRIGGER update_labor_rates_updated_at
    BEFORE UPDATE ON labor_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for client_intake
DROP TRIGGER IF EXISTS update_client_intake_updated_at ON client_intake;
CREATE TRIGGER update_client_intake_updated_at
    BEFORE UPDATE ON client_intake
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for proposal_jobs
DROP TRIGGER IF EXISTS update_proposal_jobs_updated_at ON proposal_jobs;
CREATE TRIGGER update_proposal_jobs_updated_at
    BEFORE UPDATE ON proposal_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------

-- Enable RLS on new tables
ALTER TABLE client_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_feedback ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (you can restrict based on auth later)
CREATE POLICY "Allow all operations on client_intake" ON client_intake
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on proposal_feedback" ON proposal_feedback
    FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- COMMENTS
-- ----------------------------------------------------------------------------

COMMENT ON TABLE client_intake IS 'Stores client intake form data with 7 sections for proposal generation';
COMMENT ON TABLE proposal_feedback IS 'Stores user feedback/comments on generated proposal volumes';
COMMENT ON COLUMN proposal_jobs.current_agent IS 'Current agent in the 8-agent pipeline (agent_0 through agent_8)';
COMMENT ON COLUMN proposal_jobs.agent_progress IS 'JSON tracking status of each agent in the pipeline';
COMMENT ON COLUMN proposal_jobs.rfp_parsed_data IS 'Structured JSON from Agent 1 RFP parsing';
COMMENT ON COLUMN proposal_jobs.content_outlines IS 'Volume outlines and compliance matrix from Agent 3';
COMMENT ON COLUMN proposal_jobs.volume_page_limits IS 'Page limits per volume from RFP requirements';













