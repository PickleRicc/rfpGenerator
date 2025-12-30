-- Migration: Add modular function status tracking columns
-- Purpose: Track the status of each modular Inngest function in the pipeline
-- Created: 2025-12-27

-- Add company_data column (required for modular volume generation)
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS company_data JSONB DEFAULT NULL;

COMMENT ON COLUMN proposal_jobs.company_data IS 'Cached company data from preparation phase: {company, pastPerformance, personnel, laborRates}';

-- Add preparation phase status
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS preparation_phase_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN proposal_jobs.preparation_phase_status IS 'Status of preparation phase: pending, running, complete, failed, blocked';

-- Add volume generation status (JSONB to track each volume independently)
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS volume_generation_status JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN proposal_jobs.volume_generation_status IS 'Status of each volume generation: {"volume1": "pending|generating|complete|failed", ...}';

-- Add assembly status
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS assembly_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN proposal_jobs.assembly_status IS 'Status of final assembly: pending, running, complete, failed';

-- Add final scoring status
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS final_scoring_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN proposal_jobs.final_scoring_status IS 'Status of final scoring: pending, running, complete, failed';

-- Add final compliance report (JSONB to store comprehensive report)
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS final_compliance_report JSONB DEFAULT NULL;

COMMENT ON COLUMN proposal_jobs.final_compliance_report IS 'Final comprehensive compliance report with cross-volume analysis';

-- Add quality checks (JSONB array to store QA results)
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS quality_checks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN proposal_jobs.quality_checks IS 'Quality assurance check results from final assembly';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_prep_status ON proposal_jobs(preparation_phase_status);
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_assembly_status ON proposal_jobs(assembly_status);
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_scoring_status ON proposal_jobs(final_scoring_status);
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_vol_gen_status ON proposal_jobs USING gin(volume_generation_status);

-- Note: The status column is TEXT type, so 'needs_revision' can be used directly
-- No enum alteration needed

