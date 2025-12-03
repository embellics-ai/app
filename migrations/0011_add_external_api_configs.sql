-- Migration: Add External API Configurations Table
-- Purpose: Store credentials and config for ANY external API that N8N needs to call
-- Examples: Google Calendar, Stripe, SendGrid, Custom CRM APIs, etc.
-- This enables UI-driven API configuration without coding new proxy endpoints

-- Drop the table if it exists (for clean migration on fresh/partial databases)
DROP TABLE IF EXISTS external_api_configs CASCADE;

-- Create external_api_configs table
CREATE TABLE external_api_configs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Service Identification
  service_name TEXT NOT NULL, -- 'google_calendar', 'stripe', 'sendgrid', etc.
  display_name TEXT NOT NULL, -- User-friendly name for UI
  base_url TEXT NOT NULL, -- Base API URL (e.g., 'https://api.stripe.com')
  
  -- Authentication Configuration
  auth_type TEXT NOT NULL, -- 'bearer', 'api_key', 'basic', 'oauth2', 'custom_header', 'none'
  encrypted_credentials TEXT, -- Encrypted JSON with credentials (structure varies by auth_type)
  
  -- Additional Configuration
  custom_headers JSONB, -- Additional headers to send with every request
  description TEXT, -- Optional description for this API configuration
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Usage Tracking
  last_used_at TIMESTAMP,
  total_calls INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  
  -- Audit Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR REFERENCES client_users(id)
);

-- Create unique index: one configuration per tenant per service name
CREATE UNIQUE INDEX external_api_configs_tenant_service_idx 
ON external_api_configs(tenant_id, service_name);

-- Create index for fast lookups by tenant
CREATE INDEX external_api_configs_tenant_idx ON external_api_configs(tenant_id);

-- Create index for active configurations
CREATE INDEX external_api_configs_active_idx ON external_api_configs(is_active) WHERE is_active = true;

-- Add comments for documentation
COMMENT ON TABLE external_api_configs IS 'Stores credentials and configuration for external APIs that N8N workflows call through the generic HTTP proxy';
COMMENT ON COLUMN external_api_configs.encrypted_credentials IS 'Encrypted JSON with auth credentials (structure varies by auth_type) - encrypted using ENCRYPTION_KEY';
COMMENT ON COLUMN external_api_configs.auth_type IS 'Authentication type: bearer, api_key, basic, oauth2, custom_header, or none';
COMMENT ON COLUMN external_api_configs.service_name IS 'Unique identifier used in proxy URL: /api/proxy/:tenantId/http/:serviceName/*';
