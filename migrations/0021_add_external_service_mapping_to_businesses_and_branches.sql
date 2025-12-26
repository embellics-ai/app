-- Add external service mapping to tenant_businesses and tenant_branches
-- This allows API calls to use external provider IDs (like Phorest IDs) instead of internal database IDs

-- Add external service mapping columns to tenant_businesses
ALTER TABLE "tenant_businesses" 
  ADD COLUMN IF NOT EXISTS "external_service_name" text,
  ADD COLUMN IF NOT EXISTS "external_business_id" text;

-- Add external service name to tenant_branches (branch_id already contains the external ID)
ALTER TABLE "tenant_branches" 
  ADD COLUMN IF NOT EXISTS "external_service_name" text;

-- Create indexes for fast lookup by external IDs
CREATE INDEX IF NOT EXISTS "tenant_businesses_external_service_idx" 
  ON "tenant_businesses" ("tenant_id", "external_service_name", "external_business_id");

CREATE INDEX IF NOT EXISTS "tenant_branches_external_service_idx" 
  ON "tenant_branches" ("business_id", "external_service_name", "branch_id");

-- Migrate existing data: Copy serviceName and businessId to external fields
UPDATE "tenant_businesses" 
SET 
  "external_service_name" = "service_name",
  "external_business_id" = "business_id"
WHERE "external_service_name" IS NULL OR "external_business_id" IS NULL;

-- Migrate existing data: Use serviceName from parent business
UPDATE "tenant_branches" tb
SET 
  "external_service_name" = (
    SELECT "service_name" 
    FROM "tenant_businesses" tbus 
    WHERE tbus.id = tb.business_id
  )
WHERE "external_service_name" IS NULL;
