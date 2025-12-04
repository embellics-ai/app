-- Migration: Consolidate handoff tables and fix naming
-- Date: 2024-12-04
-- Description: 
--   1. Drop legacy conversations and messages tables (replaced by widget_handoffs)
--   2. Rename conversation_messages to widget_chat_history (clearer naming)

-- Drop legacy handoff tables (replaced by widget_handoffs + widget_handoff_messages)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Rename conversation_messages to widget_chat_history for clarity
ALTER TABLE conversation_messages RENAME TO widget_chat_history;

-- Note: widget_handoffs and widget_handoff_messages already exist and are better designed
-- These tables have more features: after-hours email support, metadata, conversation history, etc.
