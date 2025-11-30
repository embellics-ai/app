-- Migration: Add WhatsApp agent ID field
-- Date: 2025-11-30
-- Description: Add whatsapp_agent_id to allow separate WhatsApp and Widget chat agents

-- Add WhatsApp agent ID column
ALTER TABLE widget_configs ADD COLUMN IF NOT EXISTS whatsapp_agent_id TEXT;
