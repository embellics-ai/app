-- Migration: Add Phorest API Support
-- Adds indexes and constraints to optimize Phorest API integration
-- Date: 2024-12-24

-- Add composite index for faster tenant+service lookups on external_api_configs
CREATE INDEX IF NOT EXISTS idx_external_api_configs_tenant_service 
ON external_api_configs(tenant_id, service_name);

-- Add index for active configs only (partial index for better performance)
CREATE INDEX IF NOT EXISTS idx_external_api_configs_active 
ON external_api_configs(is_active) 
WHERE is_active = true;

-- Add composite index for tenant+service lookups on tenant_businesses
CREATE INDEX IF NOT EXISTS idx_tenant_businesses_tenant_service 
ON tenant_businesses(tenant_id, service_name);

-- Add constraint to ensure service_name is always lowercase (important for lookups)
-- Using DO block for idempotent constraint creation
DO $$ 
BEGIN
  ALTER TABLE external_api_configs 
  ADD CONSTRAINT chk_external_api_configs_service_lowercase 
  CHECK (service_name = LOWER(service_name));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add same constraint to tenant_businesses
DO $$ 
BEGIN
  ALTER TABLE tenant_businesses 
  ADD CONSTRAINT chk_tenant_businesses_service_lowercase 
  CHECK (service_name = LOWER(service_name));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

