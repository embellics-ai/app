-- Add booking_id to payment_links table to link payments to bookings
-- This allows the Stripe webhook to update the booking when payment is completed

-- Add booking_id column with foreign key to bookings table
ALTER TABLE "payment_links" 
  ADD COLUMN IF NOT EXISTS "booking_id" VARCHAR;

-- Add foreign key constraint
ALTER TABLE "payment_links" 
  ADD CONSTRAINT "payment_links_booking_id_fkey" 
  FOREIGN KEY ("booking_id") 
  REFERENCES "bookings"("id") 
  ON DELETE SET NULL;

-- Create index for fast lookup by booking_id
CREATE INDEX IF NOT EXISTS "idx_payment_links_booking_id" 
  ON "payment_links" ("booking_id");

-- Note: We keep bookingReference for backward compatibility
-- New flow: use booking_id (internal database ID)
-- Legacy flow: use bookingReference (external reference like Phorest booking ID)
