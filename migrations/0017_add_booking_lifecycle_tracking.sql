-- Migration: Add booking lifecycle tracking columns
-- Date: 2025-01-15
-- Description: Enhanced booking status tracking to handle reservation → payment → completion/cancellation flow

-- Update payment status default
ALTER TABLE bookings 
  ALTER COLUMN payment_status SET DEFAULT 'awaiting_deposit';

-- Add deposit tracking
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS deposit_amount REAL,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP;

-- Update status default to 'pending'
ALTER TABLE bookings 
  ALTER COLUMN status SET DEFAULT 'pending';

-- Add lifecycle timestamps
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

-- Add cancellation tracking
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount REAL,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;

-- Update existing bookings to have proper status
-- Existing bookings with status 'confirmed' → 'confirmed' (keep as is, assume deposit paid)
-- Existing bookings with payment_status 'paid' → status 'confirmed' and payment_status 'paid'
UPDATE bookings 
SET 
  confirmed_at = created_at,
  deposit_paid_at = created_at
WHERE status = 'confirmed' AND confirmed_at IS NULL;

-- Comment explaining status flow
COMMENT ON COLUMN bookings.status IS 'Booking lifecycle status: pending (reserved) → confirmed (deposit paid) → completed/cancelled/no_show';
COMMENT ON COLUMN bookings.payment_status IS 'Payment tracking: awaiting_deposit → deposit_paid → paid/refunded/no_payment';
