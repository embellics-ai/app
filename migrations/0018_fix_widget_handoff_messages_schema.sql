-- Migration: Fix widget_handoff_messages schema to match code expectations
-- Date: 2025-12-15
-- Description: 
--   The widget_handoff_messages table has incorrect column names:
--   - 'role' should be 'sender_type'
--   - 'sent_at' should be 'timestamp'
--   - Missing 'sender_id' column

-- Add sender_id column
ALTER TABLE widget_handoff_messages 
ADD COLUMN IF NOT EXISTS sender_id VARCHAR;

-- Rename role to sender_type
ALTER TABLE widget_handoff_messages 
RENAME COLUMN role TO sender_type;

-- Rename sent_at to timestamp
ALTER TABLE widget_handoff_messages 
RENAME COLUMN sent_at TO timestamp;

-- Add comment for clarity
COMMENT ON TABLE widget_handoff_messages IS 'Messages exchanged during widget handoffs between users and human agents';
COMMENT ON COLUMN widget_handoff_messages.sender_type IS 'Type of sender: user, agent, or system';
COMMENT ON COLUMN widget_handoff_messages.sender_id IS 'ID of the agent if sender_type is agent (references human_agents.id)';
