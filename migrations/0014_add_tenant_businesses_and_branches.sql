-- Migration: Add tenant businesses and branches support
-- Enables multi-branch management for external API integrations
-- Date: 2025-12-19

-- Table: tenant_businesses
-- Stores business entity information for each tenant's external API service
-- One tenant can have multiple businesses (one per service)
CREATE TABLE IF NOT EXISTS tenant_businesses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- e.g., 'phorest_api', 'stripe', 'google_calendar'
  business_id TEXT NOT NULL, -- The business ID from the external service
  business_name TEXT NOT NULL, -- Human-readable business name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Each tenant can have only ONE business per service
  UNIQUE(tenant_id, service_name)
);

-- Table: tenant_branches
-- Stores branch/location information for each business
-- One business can have multiple branches (e.g., multiple clinic locations)
CREATE TABLE IF NOT EXISTS tenant_branches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id TEXT NOT NULL REFERENCES tenant_businesses(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL, -- The branch ID from the external service
  branch_name TEXT NOT NULL, -- Human-readable branch name
  is_primary BOOLEAN DEFAULT FALSE NOT NULL, -- Whether this is the primary/default branch
  is_active BOOLEAN DEFAULT TRUE NOT NULL, -- Whether this branch is currently active
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Each business can have only ONE branch with a specific branch_id
  UNIQUE(business_id, branch_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_businesses_tenant_id ON tenant_businesses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_businesses_service_name ON tenant_businesses(service_name);
CREATE INDEX IF NOT EXISTS idx_tenant_branches_business_id ON tenant_branches(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_branches_is_primary ON tenant_branches(is_primary) WHERE is_primary = TRUE;
CREATE INDEX IF NOT EXISTS idx_tenant_branches_is_active ON tenant_branches(is_active);

-- Comments for documentation
COMMENT ON TABLE tenant_businesses IS 'Stores business entity information for each tenant''s external API service integration';
COMMENT ON TABLE tenant_branches IS 'Stores branch/location information for each business entity';
COMMENT ON COLUMN tenant_businesses.service_name IS 'Service identifier matching external_api_configs.service_name';
COMMENT ON COLUMN tenant_branches.is_primary IS 'Primary branch is used as default when no branch is specified';
