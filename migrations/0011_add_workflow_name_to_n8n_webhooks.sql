-- Migration: Add missing columns to n8n_webhooks table
-- Date: 2025-12-18
-- Description: Migration 0009 was incomplete - adding all missing columns from schema.ts

-- Add workflow_name column
ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS workflow_name TEXT;

-- Set default value for existing rows
UPDATE n8n_webhooks 
SET workflow_name = 'legacy_webhook_' || id::text 
WHERE workflow_name IS NULL;

-- Make it NOT NULL
ALTER TABLE n8n_webhooks 
ALTER COLUMN workflow_name SET NOT NULL;

-- Add description column
ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add auth_token column
ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- Add usage tracking columns
ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMP;

ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS total_calls INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS successful_calls INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS failed_calls INTEGER DEFAULT 0 NOT NULL;

-- Add created_by column (references client_users)
ALTER TABLE n8n_webhooks 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) REFERENCES client_users(id);

-- Create unique index on tenant_id + workflow_name if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_workflow_idx 
ON n8n_webhooks(tenant_id, workflow_name);
