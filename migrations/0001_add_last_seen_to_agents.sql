-- Migration: Add last_seen column to human_agents table
-- Original: add-last-seen-to-agents.ts (Nov 21, 2025)

-- Create human_agents table if it doesn't exist
CREATE TABLE IF NOT EXISTS human_agents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    active_chats INTEGER NOT NULL DEFAULT 0,
    max_chats INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Create unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_agent_email ON human_agents(tenant_id, email);

-- Add last_seen column if table exists but column doesn't
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'human_agents') THEN
        ALTER TABLE human_agents ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT NOW();
        
        -- Update existing rows to have last_seen = created_at
        UPDATE human_agents 
        SET last_seen = created_at 
        WHERE last_seen IS NULL;
    END IF;
END $$;
