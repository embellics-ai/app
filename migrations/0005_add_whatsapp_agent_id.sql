-- Migration: Add WhatsApp agent ID field
-- Date: 2025-11-30
-- Description: Add whatsapp_agent_id to allow separate WhatsApp and Widget chat agents

-- Create widget_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS widget_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    retell_agent_id TEXT,
    whatsapp_agent_id TEXT,
    retell_api_key TEXT,
    greeting TEXT DEFAULT 'Hi! How can I help you today?',
    allowed_domains TEXT[],
    primary_color TEXT DEFAULT '#9b7ddd',
    text_color TEXT DEFAULT '#ffffff',
    border_radius TEXT DEFAULT '12px',
    position TEXT DEFAULT 'bottom-right',
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add WhatsApp agent ID column if it doesn't exist
ALTER TABLE widget_configs ADD COLUMN IF NOT EXISTS whatsapp_agent_id TEXT;
