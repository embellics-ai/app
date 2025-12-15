-- Migration: Add tenant_retell_agents table
-- Purpose: Store tenant-to-agent associations with channel mappings for Retell AI agents
-- This enables dynamic agent management and multi-agent support per tenant

CREATE TABLE IF NOT EXISTS tenant_retell_agents (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id VARCHAR(255) NOT NULL, -- Retell AI agent_id
  agent_name VARCHAR(255), -- Cached agent name from Retell
  channel VARCHAR(50) NOT NULL, -- 'web', 'whatsapp', 'voice-inbound', 'voice-outbound', 'sms'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate agent assignments
  UNIQUE(tenant_id, agent_id)
);

-- Index for fast tenant lookup by agent_id (critical for webhook routing)
CREATE INDEX IF NOT EXISTS idx_tenant_agents_agent_id 
ON tenant_retell_agents(agent_id) 
WHERE is_active = true;

-- Index for tenant queries
CREATE INDEX IF NOT EXISTS idx_tenant_agents_tenant_id 
ON tenant_retell_agents(tenant_id);

-- Index for channel filtering
CREATE INDEX IF NOT EXISTS idx_tenant_agents_channel 
ON tenant_retell_agents(tenant_id, channel) 
WHERE is_active = true;

-- Add retell_api_key column to tenants table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'retell_api_key'
  ) THEN
    ALTER TABLE tenants ADD COLUMN retell_api_key VARCHAR(255);
  END IF;
END $$;

-- Migrate existing agent data from widget_configs to tenant_retell_agents
-- This preserves backward compatibility
-- Migrate retell_agent_id as 'web' channel
INSERT INTO tenant_retell_agents (tenant_id, agent_id, agent_name, channel, is_active)
SELECT 
  tenant_id,
  retell_agent_id,
  'Web Agent' as agent_name,
  'web' as channel,
  true as is_active
FROM widget_configs
WHERE retell_agent_id IS NOT NULL AND retell_agent_id != ''
ON CONFLICT (tenant_id, agent_id) DO NOTHING;

-- Migrate whatsapp_agent_id as 'whatsapp' channel
INSERT INTO tenant_retell_agents (tenant_id, agent_id, agent_name, channel, is_active)
SELECT 
  tenant_id,
  whatsapp_agent_id,
  'WhatsApp Agent' as agent_name,
  'whatsapp' as channel,
  true as is_active
FROM widget_configs
WHERE whatsapp_agent_id IS NOT NULL AND whatsapp_agent_id != ''
ON CONFLICT (tenant_id, agent_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE tenant_retell_agents IS 'Stores associations between tenants and their Retell AI agents with channel assignments';
COMMENT ON COLUMN tenant_retell_agents.agent_id IS 'Retell AI agent identifier (e.g., agent_abc123...)';
COMMENT ON COLUMN tenant_retell_agents.channel IS 'Communication channel: web, whatsapp, voice-inbound, voice-outbound, sms';
