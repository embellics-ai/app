-- Migration: Fix combined_cost column type from integer to real
-- Issue: Retell sends decimal values like 10.5, but column was integer

ALTER TABLE chat_analytics 
ALTER COLUMN combined_cost TYPE real USING combined_cost::real;

-- Add comment
COMMENT ON COLUMN chat_analytics.combined_cost IS 'Total cost (supports decimal values from Retell)';
