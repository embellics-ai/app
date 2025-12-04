-- Migration: Remove unused retell_transcript_messages table
-- Date: 2024-12-04
-- Description: 
--   Drop retell_transcript_messages table since it's intentionally not being used.
--   Messages are already stored in widget_chat_history during conversations.
--   This table was originally planned for post-chat analytics but deemed redundant.

-- IMPORTANT: This migration is OPTIONAL
-- Only run if you're certain you don't need retell_transcript_messages
-- The table is harmless if left empty, but removing it simplifies the schema

-- Drop the table and its index
DROP TABLE IF EXISTS retell_transcript_messages CASCADE;

-- Note: The index retell_transcript_messages_chat_idx will be dropped automatically with CASCADE
