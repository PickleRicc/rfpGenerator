-- ============================================================================
-- Migration 006: Add missing 'role' column to personnel table
-- Description: Adds the role column required by the multi-agent system
-- ============================================================================

-- Add the role column to personnel table
ALTER TABLE personnel 
    ADD COLUMN IF NOT EXISTS role text;

-- Add comment explaining the column
COMMENT ON COLUMN personnel.role IS 'Personnel role for proposal (Program Manager, Technical Lead, Security Lead, DevSecOps Lead, Cloud Architect, QA Lead, Other)';

-- Create an index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_personnel_role ON personnel(role);

