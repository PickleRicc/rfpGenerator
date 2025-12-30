-- Migration: Volume Section Progress Tracking
-- Purpose: Add field to track section-level progress within each volume
-- Created: 2025-12-27

-- Add volume_section_progress JSONB column to proposal_jobs
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS volume_section_progress jsonb DEFAULT '{}'::jsonb;

-- Add index for volume section queries
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_volume_section_progress ON proposal_jobs USING gin(volume_section_progress);

-- Add comment for documentation
COMMENT ON COLUMN proposal_jobs.volume_section_progress IS 'Section-level progress per volume: {"volume1": {"sections": [{"name": "Executive Summary", "status": "complete", "progress": 100, "timeSeconds": 42}, ...]}, ...}';






