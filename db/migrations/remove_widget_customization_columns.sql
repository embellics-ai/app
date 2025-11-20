-- Migration: Remove widget customization columns
-- These columns are no longer used as widget styling now follows application design system
-- Date: 2025-11-20

-- Remove customization columns that are no longer used
ALTER TABLE widget_configs DROP COLUMN IF EXISTS primary_color;
ALTER TABLE widget_configs DROP COLUMN IF EXISTS position;
ALTER TABLE widget_configs DROP COLUMN IF EXISTS placeholder;
ALTER TABLE widget_configs DROP COLUMN IF EXISTS custom_css;

-- Keep only the essential columns:
-- - id, tenantId, retellAgentId, retellApiKey, greeting, allowedDomains, updatedAt
