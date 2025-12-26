-- Migration: Add Customer Management Tables
-- Creates tables for tracking clients, leads, bookings, and service provider mappings
-- Date: 2024-12-26

-- ============================================
-- CLIENTS TABLE
-- End customers who have successfully booked through the platform
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Basic Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  
  -- Acquisition Tracking
  first_interaction_source TEXT NOT NULL,
  first_interaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
  first_booking_date TIMESTAMP,
  last_booking_date TIMESTAMP,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT clients_phone_tenant_unique UNIQUE (phone, tenant_id)
);

-- Indexes for clients table
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_first_interaction_date ON clients(first_interaction_date);

-- ============================================
-- CLIENT SERVICE MAPPINGS TABLE
-- Maps platform clients to their IDs in external service providers
-- ============================================
CREATE TABLE IF NOT EXISTS client_service_mappings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id VARCHAR NOT NULL,
  
  -- Which business/branch/service
  business_id VARCHAR NOT NULL REFERENCES tenant_businesses(id) ON DELETE CASCADE,
  branch_id VARCHAR REFERENCES tenant_branches(id) ON DELETE SET NULL,
  
  -- External provider info
  service_name TEXT NOT NULL,
  service_provider_client_id TEXT NOT NULL,
  
  -- Optional provider data
  service_provider_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT client_service_mappings_client_business_unique UNIQUE (client_id, business_id)
);

-- Indexes for client_service_mappings table
CREATE INDEX IF NOT EXISTS idx_client_service_mappings_client_id ON client_service_mappings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_service_mappings_tenant_id ON client_service_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_service_mappings_business_id ON client_service_mappings(business_id);
CREATE INDEX IF NOT EXISTS idx_client_service_mappings_service_provider_client_id ON client_service_mappings(service_provider_client_id);
CREATE INDEX IF NOT EXISTS idx_client_service_mappings_service_name ON client_service_mappings(service_name);

-- ============================================
-- LEADS TABLE
-- Prospects who interacted but haven't completed a booking yet
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Basic Info (might be partial)
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  
  -- Lead Source
  source TEXT NOT NULL,
  source_details JSONB,
  
  -- Lead Status
  status TEXT NOT NULL DEFAULT 'new',
  
  -- Outbound Campaign Tracking
  assigned_agent_id VARCHAR REFERENCES human_agents(id) ON DELETE SET NULL,
  call_attempts INTEGER NOT NULL DEFAULT 0,
  last_contacted_at TIMESTAMP,
  next_follow_up_at TIMESTAMP,
  
  -- Conversion
  converted_to_client_id VARCHAR REFERENCES clients(id) ON DELETE SET NULL,
  converted_at TIMESTAMP,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT leads_phone_tenant_unique UNIQUE (phone, tenant_id)
);

-- Indexes for leads table
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent_id ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up_at ON leads(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_leads_converted_to_client_id ON leads(converted_to_client_id);

-- ============================================
-- BOOKINGS TABLE
-- All appointments/services booked through the platform
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Branch/Service Context
  business_id VARCHAR REFERENCES tenant_businesses(id) ON DELETE SET NULL,
  branch_id VARCHAR REFERENCES tenant_branches(id) ON DELETE SET NULL,
  
  -- Service Details
  service_name TEXT NOT NULL,
  service_category TEXT,
  
  -- Financial
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  
  -- Scheduling
  booking_date_time TIMESTAMP NOT NULL,
  duration INTEGER,
  
  staff_member_name TEXT,
  staff_member_id TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'confirmed',
  
  -- Service Provider Mapping
  service_provider TEXT NOT NULL,
  service_provider_booking_id TEXT,
  service_provider_data JSONB,
  
  -- Source Tracking
  booking_source TEXT NOT NULL,
  booking_source_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for bookings table
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_branch_id ON bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date_time ON bookings(booking_date_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_service_provider ON bookings(service_provider);
CREATE INDEX IF NOT EXISTS idx_bookings_service_provider_booking_id ON bookings(service_provider_booking_id);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE clients IS 'End customers who have successfully booked through the platform';
COMMENT ON TABLE client_service_mappings IS 'Maps platform clients to their IDs in external service providers (Phorest, Fresha, etc.)';
COMMENT ON TABLE leads IS 'Prospects who interacted with the platform but have not completed a booking yet';
COMMENT ON TABLE bookings IS 'All appointments/services booked through the platform';

COMMENT ON COLUMN clients.phone IS 'Primary identifier - unique per tenant';
COMMENT ON COLUMN clients.first_interaction_source IS 'How customer first interacted: voice, web, or whatsapp';
COMMENT ON COLUMN client_service_mappings.service_provider_client_id IS 'The client ID in the external service provider system (e.g., Phorest client ID)';
COMMENT ON COLUMN leads.status IS 'Lead status: new, contacted, interested, not_interested, converted, invalid';
COMMENT ON COLUMN bookings.booking_source IS 'How booking was made: voice, web, or whatsapp';
