-- Migration: Make chat_id nullable in widget_handoffs table
-- This allows handoffs to be created even when there's no active Retell chat session

ALTER TABLE widget_handoffs 
ALTER COLUMN chat_id DROP NOT NULL;
