-- Migration: Update external_api_configs table to match current schema
-- Date: 2025-12-18
-- Description: Add missing columns and update structure for external API configurations

-- Add new columns
ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Unnamed API';

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS base_url TEXT NOT NULL DEFAULT '';

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'api_key';

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS custom_headers JSONB;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS total_calls INTEGER NOT NULL DEFAULT 0;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS successful_calls INTEGER NOT NULL DEFAULT 0;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS failed_calls INTEGER NOT NULL DEFAULT 0;

ALTER TABLE external_api_configs 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) REFERENCES client_users(id);

-- Remove NOT NULL defaults after columns exist
ALTER TABLE external_api_configs 
ALTER COLUMN display_name DROP DEFAULT;

ALTER TABLE external_api_configs 
ALTER COLUMN base_url DROP DEFAULT;

ALTER TABLE external_api_configs 
ALTER COLUMN auth_type DROP DEFAULT;
