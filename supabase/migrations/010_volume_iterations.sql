-- Migration: Volume Iteration Tracking
-- Purpose: Add fields to track per-volume iteration, scoring, and approval workflow
-- Created: 2025-12-23

-- Add volume iteration tracking to proposal_jobs
ALTER TABLE proposal_jobs
    ADD COLUMN IF NOT EXISTS current_volume integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS volume_iterations jsonb DEFAULT '{"volume1": 0, "volume2": 0, "volume3": 0, "volume4": 0}'::jsonb,
    ADD COLUMN IF NOT EXISTS volume_scores jsonb DEFAULT '{"volume1": null, "volume2": null, "volume3": null, "volume4": null}'::jsonb,
    ADD COLUMN IF NOT EXISTS volume_status jsonb DEFAULT '{"volume1": "pending", "volume2": "pending", "volume3": "pending", "volume4": "pending"}'::jsonb,
    ADD COLUMN IF NOT EXISTS awaiting_user_approval boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS current_volume_insights jsonb,
    ADD COLUMN IF NOT EXISTS user_feedback_history jsonb DEFAULT '[]'::jsonb;

-- Drop old final draft tables (no longer needed)
DROP TABLE IF EXISTS draft_revisions CASCADE;

-- Add index for volume queries
CREATE INDEX IF NOT EXISTS idx_proposal_jobs_current_volume ON proposal_jobs(job_id, current_volume);

-- Add comments for documentation
COMMENT ON COLUMN proposal_jobs.current_volume IS 'Which volume (1-4) is currently being iterated';
COMMENT ON COLUMN proposal_jobs.volume_iterations IS 'Track iteration count per volume (max 5): {"volume1": 0, "volume2": 0, "volume3": 0, "volume4": 0}';
COMMENT ON COLUMN proposal_jobs.volume_scores IS 'Compliance score per volume: {"volume1": 75, "volume2": 82, "volume3": 90, "volume4": 88}';
COMMENT ON COLUMN proposal_jobs.volume_status IS 'Status per volume: pending | iterating | approved | blocked';
COMMENT ON COLUMN proposal_jobs.awaiting_user_approval IS 'Pipeline paused waiting for human review';
COMMENT ON COLUMN proposal_jobs.current_volume_insights IS 'Consultant insights for the volume currently being iterated';
COMMENT ON COLUMN proposal_jobs.user_feedback_history IS 'Array of feedback objects: [{volume: 1, iteration: 2, feedback: "...", timestamp: "..."}]';








