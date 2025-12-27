-- Migration: Drop redundant business_id column from tenant_businesses
-- The business_id column was storing external provider IDs, which is now handled by external_business_id
-- This cleanup removes the duplicate column to avoid confusion
-- Date: 2025-12-27

-- Drop the redundant business_id column
-- Note: This does NOT affect tenant_branches.business_id which is a foreign key to tenant_businesses.id
ALTER TABLE "tenant_businesses" 
  DROP COLUMN IF EXISTS "business_id";

-- Verify external_business_id is populated (should already be done by migration 0021)
-- This is a safety check to ensure no data loss
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "tenant_businesses" 
    WHERE "external_business_id" IS NULL OR "external_business_id" = ''
  ) THEN
    RAISE EXCEPTION 'Found tenant_businesses records with NULL or empty external_business_id. Please populate this field before dropping business_id.';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN "tenant_businesses"."external_business_id" IS 'External provider business ID (e.g., Phorest business ID, Fresha business ID). Used for API integrations.';
