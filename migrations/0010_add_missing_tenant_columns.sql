-- Migration: Add missing columns to tenants table
-- Date: 2025-12-17
-- Description: Adds email, phone, plan, status, and retell_api_key columns to tenants table

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add email column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'email') THEN
        ALTER TABLE tenants ADD COLUMN email TEXT;
        UPDATE tenants SET email = name || '@example.com' WHERE email IS NULL;
        ALTER TABLE tenants ALTER COLUMN email SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS tenants_email_unique ON tenants(email);
    END IF;

    -- Add phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'phone') THEN
        ALTER TABLE tenants ADD COLUMN phone TEXT;
    END IF;

    -- Add plan column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'plan') THEN
        ALTER TABLE tenants ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
    END IF;

    -- Add status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'status') THEN
        ALTER TABLE tenants ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    END IF;

    -- Add retell_api_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenants' AND column_name = 'retell_api_key') THEN
        ALTER TABLE tenants ADD COLUMN retell_api_key VARCHAR(255);
    END IF;

END $$;
