-- Migration: Add webhook type fields for event listeners and function calls
-- Date: 2025-12-01

-- Add new columns to n8n_webhooks table
ALTER TABLE n8n_webhooks
ADD COLUMN IF NOT EXISTS webhook_type TEXT NOT NULL DEFAULT 'event_listener',
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS function_name TEXT,
ADD COLUMN IF NOT EXISTS response_timeout INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS retry_on_failure BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN n8n_webhooks.webhook_type IS 'Type of webhook: event_listener (async events) or function_call (sync function calls)';
COMMENT ON COLUMN n8n_webhooks.event_type IS 'For event_listener: which event triggers this webhook (chat_analyzed, call_analyzed, etc.)';
COMMENT ON COLUMN n8n_webhooks.function_name IS 'For function_call: the function name used in Retell agent config';
COMMENT ON COLUMN n8n_webhooks.response_timeout IS 'For function_call: timeout in milliseconds to wait for response';
COMMENT ON COLUMN n8n_webhooks.retry_on_failure IS 'For function_call: whether to retry on failure';

-- Create index for function name lookups (for fast function routing)
CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_tenant_function 
ON n8n_webhooks(tenant_id, function_name) 
WHERE function_name IS NOT NULL AND is_active = true;

-- Create index for event type lookups (for fast event routing)
CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_tenant_event 
ON n8n_webhooks(tenant_id, event_type) 
WHERE event_type IS NOT NULL AND is_active = true;

-- Create unique constraint for tenant + function_name combination
CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_function_idx 
ON n8n_webhooks(tenant_id, function_name) 
WHERE function_name IS NOT NULL;

-- Update existing webhooks to be event_listener type (default)
-- This ensures backward compatibility with existing webhooks
UPDATE n8n_webhooks 
SET webhook_type = 'event_listener',
    event_type = '*'  -- Set to 'all events' for existing webhooks
WHERE webhook_type = 'event_listener' AND event_type IS NULL;
