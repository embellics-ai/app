-- Migration: Create n8n_webhooks table
-- Date: 2025-12-17
-- NOTE: This should have been created BEFORE 0009_add_webhook_types.sql

CREATE TABLE IF NOT EXISTS n8n_webhooks (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_tenant 
ON n8n_webhooks(tenant_id) 
WHERE is_active = true;

COMMENT ON TABLE n8n_webhooks IS 'N8N webhook configurations for tenants';
