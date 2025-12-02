-- Migration: Make chat_id nullable in widget_handoffs table
-- This allows handoffs to be created even when there's no active Retell chat session

-- Create widget_handoffs table if it doesn't exist
CREATE TABLE IF NOT EXISTS widget_handoffs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chat_id TEXT,  -- Initially nullable
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT NOW() NOT NULL,
    picked_up_at TIMESTAMP,
    resolved_at TIMESTAMP,
    assigned_agent_id VARCHAR REFERENCES human_agents(id) ON DELETE SET NULL,
    user_email TEXT,
    user_message TEXT,
    conversation_history JSONB,
    last_user_message TEXT,
    metadata JSONB
);

-- Make chat_id nullable if table exists but column is not nullable
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'widget_handoffs' 
        AND column_name = 'chat_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE widget_handoffs ALTER COLUMN chat_id DROP NOT NULL;
    END IF;
END $$;
