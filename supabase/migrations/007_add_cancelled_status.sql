-- Migration: Add 'cancelled' status to proposal_jobs
-- This allows jobs to be marked as cancelled instead of failed when user cancels

-- First, check if we're using an ENUM type or a CHECK constraint
-- If ENUM, add the new value; if CHECK, update the constraint

-- For ENUM types (PostgreSQL 9.1+)
DO $$ 
BEGIN
    -- Try to add 'cancelled' to the enum if it exists
    ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
    WHEN undefined_object THEN
        -- Enum doesn't exist, that's fine
        NULL;
END $$;

-- For CHECK constraints on the status column
-- First drop the existing constraint if it exists, then recreate with new value
DO $$
BEGIN
    -- Try to drop the existing check constraint
    ALTER TABLE proposal_jobs DROP CONSTRAINT IF EXISTS proposal_jobs_status_check;
    
    -- Add new check constraint with 'cancelled' included
    ALTER TABLE proposal_jobs ADD CONSTRAINT proposal_jobs_status_check 
        CHECK (status IN ('draft', 'intake', 'validating', 'blocked', 'processing', 'review', 'completed', 'failed', 'cancelled'));
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist yet, that's fine
        NULL;
    WHEN others THEN
        -- Some other error, log but continue
        RAISE NOTICE 'Could not update status check constraint: %', SQLERRM;
END $$;

-- Add comment
COMMENT ON COLUMN proposal_jobs.status IS 'Job status: draft, intake, validating, blocked, processing, review, completed, failed, or cancelled';












