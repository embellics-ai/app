-- Migration: Cleanup payment_links table
-- Remove unnecessary columns and rename Phorest-specific columns to generic names
-- Created: 2025-12-27

-- Step 1: Drop unnecessary columns
ALTER TABLE payment_links DROP COLUMN IF EXISTS booking_reference;
ALTER TABLE payment_links DROP COLUMN IF EXISTS customer_email;
ALTER TABLE payment_links DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE payment_links DROP COLUMN IF EXISTS customer_name;
ALTER TABLE payment_links DROP COLUMN IF EXISTS phorest_client_id;
ALTER TABLE payment_links DROP COLUMN IF EXISTS phorest_purchase_id;
ALTER TABLE payment_links DROP COLUMN IF EXISTS description;
ALTER TABLE payment_links DROP COLUMN IF EXISTS metadata;
ALTER TABLE payment_links DROP COLUMN IF EXISTS expires_at;

-- Step 2: Rename phorest_booking_id to generic external_service_booking_id
ALTER TABLE payment_links RENAME COLUMN phorest_booking_id TO external_service_booking_id;

-- Step 3: Add foreign key constraint to booking_id if not exists
-- First check if the constraint exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payment_links_booking_id_bookings_id_fk'
    ) THEN
        ALTER TABLE payment_links 
        ADD CONSTRAINT payment_links_booking_id_bookings_id_fk 
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Update any existing NULL booking_id values by matching external_service_booking_id
-- This links orphaned payment links to their bookings
UPDATE payment_links pl
SET booking_id = b.id
FROM bookings b
WHERE pl.booking_id IS NULL
  AND pl.external_service_booking_id IS NOT NULL
  AND b.service_provider_booking_id = pl.external_service_booking_id
  AND b.tenant_id = pl.tenant_id;

-- Verification: Show table structure after cleanup
-- (Run this manually to verify)
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'payment_links'
-- ORDER BY ordinal_position;
