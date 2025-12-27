-- Migration: Add business_id and branch_id to payment_links table
-- This allows payment links to store business/branch info directly
-- without requiring a booking record to be created first

-- Add business_id column (references tenant_businesses) - VARCHAR to match tenant_businesses.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_links' 
        AND column_name = 'business_id'
    ) THEN
        ALTER TABLE payment_links
        ADD COLUMN business_id VARCHAR NOT NULL REFERENCES tenant_businesses(id) ON DELETE RESTRICT;
        
        RAISE NOTICE 'Added business_id column to payment_links';
    ELSE
        RAISE NOTICE 'Column business_id already exists in payment_links';
    END IF;
END $$;

-- Add branch_id column (references tenant_branches) - VARCHAR to match tenant_branches.id  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_links' 
        AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE payment_links
        ADD COLUMN branch_id VARCHAR NOT NULL REFERENCES tenant_branches(id) ON DELETE RESTRICT;
        
        RAISE NOTICE 'Added branch_id column to payment_links';
    ELSE
        RAISE NOTICE 'Column branch_id already exists in payment_links';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN payment_links.business_id IS 'Link to tenant_businesses - identifies which business this payment is for';
COMMENT ON COLUMN payment_links.branch_id IS 'Link to tenant_branches - identifies which branch this payment is for';

-- Create indexes for better query performance (with existence check)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'payment_links' 
        AND indexname = 'idx_payment_links_business_id'
    ) THEN
        CREATE INDEX idx_payment_links_business_id ON payment_links(business_id);
        RAISE NOTICE 'Created index idx_payment_links_business_id';
    ELSE
        RAISE NOTICE 'Index idx_payment_links_business_id already exists';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'payment_links' 
        AND indexname = 'idx_payment_links_branch_id'
    ) THEN
        CREATE INDEX idx_payment_links_branch_id ON payment_links(branch_id);
        RAISE NOTICE 'Created index idx_payment_links_branch_id';
    ELSE
        RAISE NOTICE 'Index idx_payment_links_branch_id already exists';
    END IF;
END $$;
