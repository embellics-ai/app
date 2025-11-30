-- Migration: Add Voice Analytics table
-- Date: 2025-11-30
-- Description: Track voice call analytics from Retell AI call.ended webhook
--              Matches chat_analytics structure for consistency (no transcripts/recordings)

-- Create voice_analytics table
CREATE TABLE IF NOT EXISTS voice_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Retell Call Metadata
  call_id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  agent_version TEXT,
  call_type TEXT, -- "inbound", "outbound", "web_call"
  call_status TEXT, -- "ended", "voicemail", "failed", etc.
  
  -- Timestamps
  start_timestamp TIMESTAMP,
  end_timestamp TIMESTAMP,
  duration INTEGER, -- Duration in seconds
  
  -- Call Data
  message_count INTEGER, -- Total messages/turns exchanged
  tool_calls_count INTEGER, -- Number of tool/function calls
  dynamic_variables JSONB, -- Collected variables (booking_uid, user_intention, etc.)
  
  -- Call Analysis (AI-generated)
  user_sentiment TEXT, -- "positive", "negative", "neutral", "frustrated", "satisfied"
  call_successful BOOLEAN, -- Whether call achieved its goal
  
  -- Cost Tracking
  combined_cost REAL, -- Total cost (supports decimals)
  product_costs JSONB, -- Breakdown by model (gpt-4o, whisper, etc.)
  
  -- Additional Call Metadata
  metadata JSONB, -- Additional data (disconnect_reason, from_number, to_number, etc.)
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for fast lookups (matching chat_analytics pattern)
CREATE INDEX IF NOT EXISTS voice_analytics_tenant_call_idx ON voice_analytics(tenant_id, call_id);
CREATE INDEX IF NOT EXISTS voice_analytics_tenant_agent_idx ON voice_analytics(tenant_id, agent_id, start_timestamp);
CREATE INDEX IF NOT EXISTS voice_analytics_sentiment_idx ON voice_analytics(tenant_id, user_sentiment, start_timestamp);
CREATE INDEX IF NOT EXISTS voice_analytics_timestamp_idx ON voice_analytics(tenant_id, start_timestamp DESC);
