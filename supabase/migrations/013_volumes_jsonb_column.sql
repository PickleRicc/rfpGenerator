-- ============================================================================
-- Add volumes JSONB column to proposal_jobs
-- Version: 013
-- Description: Adds a volumes JSONB column to store volume content in a
--              structured format for the volume-by-volume generation system
-- ============================================================================

-- Add volumes JSONB column
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS volumes jsonb DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_volumes 
    ON proposal_jobs USING gin(volumes);

-- Add comment
COMMENT ON COLUMN proposal_jobs.volumes IS 'JSONB storage for volume content: {"volume1": "...", "volume2": "...", "volume3": "...", "volume4": "..."}';





