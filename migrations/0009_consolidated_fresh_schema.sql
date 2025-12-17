-- Migration: Fresh database schema - consolidates all tables
-- Date: 2025-12-17
-- Description: Clean slate migration for new production database
-- This replaces migrations 0009-0018 with a single clean schema

-- =====================================================
-- CORE TENANT & USER TABLES
-- =====================================================

-- Tenants table (should already exist from earlier migrations)
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(255) PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client users
CREATE TABLE IF NOT EXISTS client_users (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- WIDGET & CHAT TABLES
-- =====================================================

-- Widget configurations
CREATE TABLE IF NOT EXISTS widget_configs (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '#3b82f6',
  agent_name TEXT DEFAULT 'AI Assistant',
  greeting_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Widget chat history
CREATE TABLE IF NOT EXISTS widget_chat_history (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_widget_chat_history_tenant_chat 
ON widget_chat_history(tenant_id, chat_id);

-- Widget handoffs
CREATE TABLE IF NOT EXISTS widget_handoffs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Widget handoff messages
CREATE TABLE IF NOT EXISTS widget_handoff_messages (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id VARCHAR(255) NOT NULL REFERENCES widget_handoffs(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- =====================================================
-- N8N WEBHOOKS
-- =====================================================

CREATE TABLE IF NOT EXISTS n8n_webhooks (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  webhook_type TEXT NOT NULL DEFAULT 'event_listener',
  event_type TEXT,
  function_name TEXT,
  response_timeout INTEGER DEFAULT 10000,
  retry_on_failure BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_tenant 
ON n8n_webhooks(tenant_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_tenant_function 
ON n8n_webhooks(tenant_id, function_name) 
WHERE function_name IS NOT NULL AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_function_idx 
ON n8n_webhooks(tenant_id, function_name) 
WHERE function_name IS NOT NULL;

-- =====================================================
-- ANALYTICS TABLES
-- =====================================================

-- Chat analytics
CREATE TABLE IF NOT EXISTS chat_analytics (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL UNIQUE,
  agent_id TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  total_messages INTEGER DEFAULT 0,
  customer_satisfaction INTEGER,
  transcript JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_tenant 
ON chat_analytics(tenant_id);

-- Voice analytics
CREATE TABLE IF NOT EXISTS voice_analytics (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL UNIQUE,
  agent_id TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  disconnect_reason TEXT,
  customer_sentiment TEXT,
  transcript JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_analytics_tenant 
ON voice_analytics(tenant_id);

-- =====================================================
-- INTEGRATIONS & API CONFIGS
-- =====================================================

-- External API configurations
CREATE TABLE IF NOT EXISTS external_api_configs (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  additional_config JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, service_name)
);

-- Tenant Retell agents
CREATE TABLE IF NOT EXISTS tenant_retell_agents (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  llm_websocket_url TEXT NOT NULL,
  voice_id TEXT,
  language TEXT DEFAULT 'en-US',
  response_engine JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, agent_id)
);

-- =====================================================
-- PAYMENT LINKS
-- =====================================================

CREATE TABLE IF NOT EXISTS payment_links (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_reference VARCHAR(255),
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'eur',
  status VARCHAR(50) DEFAULT 'pending',
  customer_email VARCHAR(255),
  customer_phone VARCHAR(255),
  customer_name VARCHAR(255),
  phorest_booking_id VARCHAR(255),
  phorest_client_id VARCHAR(255),
  phorest_purchase_id VARCHAR(255),
  description TEXT,
  metadata JSONB,
  expires_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_links_tenant 
ON payment_links(tenant_id);

CREATE INDEX IF NOT EXISTS idx_payment_links_booking 
ON payment_links(booking_reference);

-- =====================================================
-- MIGRATIONS TRACKING
-- =====================================================

-- Ensure migrations table exists
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mark this consolidated migration as applied
INSERT INTO migrations (name) 
VALUES ('0019_consolidated_fresh_schema')
ON CONFLICT (name) DO NOTHING;
