-- Migration: Volume Compliance Details
-- Purpose: Add field to store detailed compliance score breakdowns from Agent5
-- Created: 2025-12-27

-- Add volume_compliance_details JSONB column to proposal_jobs
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS volume_compliance_details jsonb DEFAULT '{}'::jsonb;

-- Add index for volume compliance queries
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_volume_compliance_details ON proposal_jobs USING gin(volume_compliance_details);

-- Add comment for documentation
COMMENT ON COLUMN proposal_jobs.volume_compliance_details IS 'Detailed compliance breakdown per volume: {"volume1": {"requirementScores": [...], "strengths": [...], "criticalGaps": [...], "overallScore": 92}, ...}';






