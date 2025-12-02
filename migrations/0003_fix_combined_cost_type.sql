-- Migration: Fix combined_cost column type from integer to real
-- Issue: Retell sends decimal values like 10.5, but column was integer

-- Create chat_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_analytics (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL UNIQUE,
    agent_id TEXT NOT NULL,
    agent_name TEXT,
    agent_version TEXT,
    chat_type TEXT,
    chat_status TEXT,
    start_timestamp TIMESTAMP,
    end_timestamp TIMESTAMP,
    duration INTEGER,
    message_count INTEGER,
    tool_calls_count INTEGER,
    dynamic_variables JSONB,
    user_sentiment TEXT,
    chat_successful BOOLEAN,
    combined_cost REAL,
    product_costs JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS chat_analytics_tenant_chat_idx ON chat_analytics(tenant_id, chat_id);
CREATE INDEX IF NOT EXISTS chat_analytics_tenant_agent_idx ON chat_analytics(tenant_id, agent_id, start_timestamp);
CREATE INDEX IF NOT EXISTS chat_analytics_sentiment_idx ON chat_analytics(tenant_id, user_sentiment, start_timestamp);

-- Only alter the column type if it exists and is not already real
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_analytics' 
        AND column_name = 'combined_cost'
        AND data_type != 'real'
    ) THEN
        ALTER TABLE chat_analytics 
        ALTER COLUMN combined_cost TYPE real USING combined_cost::real;
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN chat_analytics.combined_cost IS 'Total cost (supports decimal values from Retell)';
