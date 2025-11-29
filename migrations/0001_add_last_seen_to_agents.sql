-- Migration: Add last_seen column to human_agents table
-- Original: add-last-seen-to-agents.ts (Nov 21, 2025)

-- Add last_seen column with default value
ALTER TABLE human_agents 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT NOW();

-- Update existing rows to have last_seen = created_at
UPDATE human_agents 
SET last_seen = created_at 
WHERE last_seen IS NULL;
