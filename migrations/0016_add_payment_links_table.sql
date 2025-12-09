-- Migration: Add payment_links table for Stripe payment integration
-- Created: 2025-12-09
-- Purpose: Track payment links generated for customer bookings (appointments, services)

CREATE TABLE IF NOT EXISTS payment_links (
    id SERIAL PRIMARY KEY,
    
    -- Tenant relationship
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Booking reference (internal identifier)
    booking_reference VARCHAR(255) NOT NULL,
    
    -- Stripe checkout session details
    stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'eur',
    
    -- Payment status: 'pending', 'completed', 'expired', 'failed'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Customer information
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_name VARCHAR(255),
    
    -- Phorest integration
    phorest_booking_id VARCHAR(255),
    phorest_client_id VARCHAR(255),
    phorest_purchase_id VARCHAR(255),
    
    -- Metadata for context
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    expires_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_payment_links_tenant_id ON payment_links(tenant_id);
CREATE INDEX idx_payment_links_stripe_session_id ON payment_links(stripe_session_id);
CREATE INDEX idx_payment_links_status ON payment_links(status);
CREATE INDEX idx_payment_links_booking_reference ON payment_links(booking_reference);
CREATE INDEX idx_payment_links_phorest_booking_id ON payment_links(phorest_booking_id);
CREATE INDEX idx_payment_links_created_at ON payment_links(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_payment_links_updated_at
    BEFORE UPDATE ON payment_links
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_links_updated_at();

-- Add comment to table
COMMENT ON TABLE payment_links IS 'Stores Stripe payment links generated for customer bookings and services';
COMMENT ON COLUMN payment_links.status IS 'Payment status: pending, completed, expired, failed';
COMMENT ON COLUMN payment_links.metadata IS 'Additional context like service details, staff name, booking time';
