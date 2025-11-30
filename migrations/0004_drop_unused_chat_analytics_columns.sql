-- Migration: Drop unused columns from chat_analytics table
-- Date: 2025-11-29
-- Description: Remove transcript and chat_summary columns as they are not used for analytics

-- Drop the unused columns
ALTER TABLE chat_analytics DROP COLUMN IF EXISTS transcript;
ALTER TABLE chat_analytics DROP COLUMN IF EXISTS chat_summary;
