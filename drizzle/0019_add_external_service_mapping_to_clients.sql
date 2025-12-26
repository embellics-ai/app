-- Add external service mapping columns to clients table
ALTER TABLE "clients" ADD COLUMN "external_service_name" text;
ALTER TABLE "clients" ADD COLUMN "external_service_client_id" text;

-- Create index for fast lookup by external service client ID
CREATE INDEX IF NOT EXISTS "clients_external_service_idx" ON "clients" ("tenant_id", "external_service_name", "external_service_client_id");
