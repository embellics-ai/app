-- Migration: Add OAuth Credentials Table
-- Purpose: Store encrypted OAuth tokens per tenant for WhatsApp, Google Sheets, etc.
-- This enables secure credential proxy so N8N workflows don't need direct OAuth access

-- Create oauth_credentials table
CREATE TABLE IF NOT EXISTS oauth_credentials (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- OAuth Provider
  provider TEXT NOT NULL, -- 'whatsapp', 'google_sheets', 'gmail', etc.
  
  -- OAuth Application Credentials
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL, -- Encrypted
  
  -- OAuth Tokens
  access_token TEXT, -- Encrypted, nullable until first authorization
  refresh_token TEXT, -- Encrypted
  token_expiry TIMESTAMP, -- When access_token expires
  scopes TEXT[], -- Array of granted OAuth scopes
  
  -- Provider-specific metadata (JSONB for flexibility)
  metadata JSONB,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP -- Track last API call using these credentials
);

-- Create unique index: one credential per tenant per provider
CREATE UNIQUE INDEX oauth_credentials_tenant_provider_idx 
ON oauth_credentials(tenant_id, provider);

-- Create index for fast lookups by tenant
CREATE INDEX oauth_credentials_tenant_idx ON oauth_credentials(tenant_id);

-- Create index for active credentials
CREATE INDEX oauth_credentials_active_idx ON oauth_credentials(is_active) WHERE is_active = true;

-- Add comment for documentation
COMMENT ON TABLE oauth_credentials IS 'Stores encrypted OAuth credentials per tenant for third-party API integrations (WhatsApp, Google Sheets, etc.)';
COMMENT ON COLUMN oauth_credentials.client_secret IS 'Encrypted using ENCRYPTION_KEY';
COMMENT ON COLUMN oauth_credentials.access_token IS 'Encrypted OAuth access token';
COMMENT ON COLUMN oauth_credentials.refresh_token IS 'Encrypted OAuth refresh token for auto-renewal';
COMMENT ON COLUMN oauth_credentials.metadata IS 'Provider-specific data (e.g., WhatsApp phone_number_id, Business Account ID)';
