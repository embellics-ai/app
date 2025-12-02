-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core Tables (Initial Schema)

-- Tenants (Organizations/Companies)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Client Users (Platform and Client Admins)
CREATE TABLE IF NOT EXISTS client_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    role TEXT NOT NULL DEFAULT 'client_admin',
    tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE,
    is_platform_admin BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT FALSE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tenant Integrations (N8N, WhatsApp, SMS per tenant)
CREATE TABLE IF NOT EXISTS tenant_integrations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    n8n_base_url TEXT,
    n8n_api_key TEXT,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_config JSONB,
    sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sms_config JSONB,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR REFERENCES client_users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR REFERENCES client_users(id)
);

-- User Invitations
CREATE TABLE IF NOT EXISTS user_invitations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    temporary_password TEXT NOT NULL,
    plain_temporary_password TEXT,
    role TEXT NOT NULL,
    tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE,
    company_name TEXT,
    company_phone TEXT,
    invited_by VARCHAR REFERENCES client_users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    invited_user_id VARCHAR REFERENCES client_users(id) ON DELETE CASCADE,
    last_sent_at TIMESTAMP,
    accepted_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR NOT NULL REFERENCES client_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    name TEXT,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP
);

-- OAuth Credentials
CREATE TABLE IF NOT EXISTS oauth_credentials (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    client_id TEXT,
    client_secret TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, provider)
);

-- Widget Configs
CREATE TABLE IF NOT EXISTS widget_configs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    retell_agent_id TEXT,
    whatsapp_agent_id TEXT,
    retell_api_key TEXT,
    greeting TEXT DEFAULT 'Hi! How can I help you today?',
    allowed_domains TEXT[],
    primary_color TEXT DEFAULT '#9b7ddd',
    text_color TEXT DEFAULT '#ffffff',
    border_radius TEXT DEFAULT '12px',
    position TEXT DEFAULT 'bottom-right',
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Human Agents
CREATE TABLE IF NOT EXISTS human_agents (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    active_chats INTEGER NOT NULL DEFAULT 0,
    max_chats INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_seen TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_tenant_agent_email ON human_agents(tenant_id, email);

-- Widget Handoffs
CREATE TABLE IF NOT EXISTS widget_handoffs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chat_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT NOW() NOT NULL,
    picked_up_at TIMESTAMP,
    resolved_at TIMESTAMP,
    assigned_agent_id VARCHAR REFERENCES human_agents(id) ON DELETE SET NULL,
    user_email TEXT,
    user_message TEXT,
    conversation_history JSONB,
    last_user_message TEXT,
    metadata JSONB
);

-- Widget Handoff Messages
CREATE TABLE IF NOT EXISTS widget_handoff_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    handoff_id VARCHAR NOT NULL REFERENCES widget_handoffs(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_handoff_messages_handoff ON widget_handoff_messages(handoff_id);

-- Widget Chat Messages
CREATE TABLE IF NOT EXISTS widget_chat_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    flow_id TEXT,
    agent_id TEXT,
    end_user_id TEXT,
    metadata JSONB,
    handoff_status TEXT NOT NULL DEFAULT 'ai',
    human_agent_id VARCHAR REFERENCES human_agents(id) ON DELETE SET NULL,
    conversation_summary TEXT,
    handoff_timestamp TIMESTAMP,
    handoff_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id, created_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    direction TEXT NOT NULL,
    body TEXT NOT NULL,
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    message_sid TEXT UNIQUE,
    status TEXT,
    timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, timestamp);

-- Daily Analytics
CREATE TABLE IF NOT EXISTS daily_analytics (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    inbound_messages INTEGER DEFAULT 0,
    outbound_messages INTEGER DEFAULT 0,
    unique_conversations INTEGER DEFAULT 0,
    UNIQUE(tenant_id, date)
);
