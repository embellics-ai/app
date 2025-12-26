-- Remove redundant external_branch_id column from tenant_branches
-- The branch_id column already contains the external provider's branch ID

ALTER TABLE "tenant_branches" DROP COLUMN IF EXISTS "external_branch_id";

-- Update index to use branch_id instead of external_branch_id
DROP INDEX IF EXISTS "tenant_branches_external_service_idx";
CREATE INDEX IF NOT EXISTS "tenant_branches_external_service_idx" 
  ON "tenant_branches" ("business_id", "external_service_name", "branch_id");
