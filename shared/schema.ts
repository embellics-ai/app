import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  uniqueIndex,
  real,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ============================================
// MULTI-TENANT TABLES
// ============================================

// Tenants (Business Clients)
export const tenants = pgTable('tenants', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'), // Optional company phone number
  plan: text('plan').notNull().default('free'), // free, pro, enterprise
  status: text('status').notNull().default('active'), // active, suspended, cancelled
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// Client Users (Login accounts - Platform Admins, Client Admins, Support Staff)
// Multi-level role system:
// - Platform Admins (isPlatformAdmin=true, role=owner/admin): Manage all tenants, no specific tenantId
// - Client Admins (isPlatformAdmin=false, role=client_admin): Full access to their tenant
// - Support Staff (isPlatformAdmin=false, role=support_staff): Only Agent Dashboard access
export const clientUsers = pgTable('client_users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // nullable for platform admins
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phoneNumber: text('phone_number'),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  role: text('role').notNull().default('support_staff'), // owner, admin, client_admin, support_staff
  mustChangePassword: boolean('must_change_password').default(false).notNull(), // True for users logging in with temp passwords
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertClientUserSchema = createInsertSchema(clientUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertClientUser = z.infer<typeof insertClientUserSchema>;
export type ClientUser = typeof clientUsers.$inferSelect;

// User Invitations (For invitation-based user onboarding with temporary passwords)
// Status lifecycle: pending -> sent -> accepted (or expired)
export const userInvitations = pgTable('user_invitations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phoneNumber: text('phone_number'),
  temporaryPassword: text('temporary_password').notNull(), // Hashed password - only shown to platform owner at creation/reset
  plainTemporaryPassword: text('plain_temporary_password'), // Stored temporarily for platform owner to view - cleared after 24h
  role: text('role').notNull(), // admin, client_admin, support_staff
  tenantId: varchar('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // nullable for platform admin invites
  companyName: text('company_name'), // For client_admin invitations
  companyPhone: text('company_phone'), // For client_admin invitations
  invitedBy: varchar('invited_by').references(() => clientUsers.id),
  status: text('status').notNull().default('pending'), // pending, sent, accepted, expired
  invitedUserId: varchar('invited_user_id').references(() => clientUsers.id, {
    onDelete: 'cascade',
  }), // Set when invitation is accepted - cascade delete when user is deleted
  lastSentAt: timestamp('last_sent_at'), // When invitation email was last sent
  acceptedAt: timestamp('accepted_at'), // When user first logged in
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  createdAt: true,
});

export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;
export type UserInvitation = typeof userInvitations.$inferSelect;

// Human Agents (Staff who can handle live chat handoffs)
export const humanAgents = pgTable(
  'human_agents',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    status: text('status').notNull().default('available'), // available, busy, offline
    activeChats: integer('active_chats').notNull().default(0),
    maxChats: integer('max_chats').notNull().default(5),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastSeen: timestamp('last_seen').defaultNow(),
  },
  (table) => ({
    uniqueTenantEmail: uniqueIndex('unique_tenant_agent_email').on(table.tenantId, table.email),
  }),
);

export const insertHumanAgentSchema = createInsertSchema(humanAgents).omit({
  id: true,
  createdAt: true,
  lastSeen: true,
  tenantId: true,
});

export type InsertHumanAgent = z.infer<typeof insertHumanAgentSchema>;
export type HumanAgent = typeof humanAgents.$inferSelect;

// API Keys (Widget embedding keys for each tenant)
export const apiKeys = pgTable('api_keys', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(), // Hashed API key
  keyPrefix: text('key_prefix').notNull(), // First 8 chars for display (e.g., "sk_live_abc12345...")
  name: text('name'), // Optional name for the key
  lastUsed: timestamp('last_used'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// Widget Configurations (Branding and customization per tenant)
export const widgetConfigs = pgTable('widget_configs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' })
    .unique(),
  retellAgentId: text('retell_agent_id'), // Tenant-specific Retell AI agent ID for chat widget
  whatsappAgentId: text('whatsapp_agent_id'), // Tenant-specific Retell AI agent ID for WhatsApp
  retellApiKey: text('retell_api_key'), // Tenant's own Retell AI API key for account-wide analytics (all voice agents)
  greeting: text('greeting').default('Hi! How can I help you today?'),
  allowedDomains: text('allowed_domains').array(), // Array of allowed domains
  primaryColor: text('primary_color').default('#9b7ddd'), // Main theme color (buttons, header)
  textColor: text('text_color').default('#ffffff'), // Text color on primary background
  borderRadius: text('border_radius').default('12px'), // Border radius for widget elements
  position: text('position').default('bottom-right'), // Widget position: top-left, top-center, top-right, middle-left, middle-right, bottom-left, bottom-center, bottom-right
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Widget Chat History (Store all chat messages for persistence across sessions)
// Renamed from conversation_messages in migration 0014 for clarity
export const widgetChatHistory = pgTable('widget_chat_history', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  chatId: text('chat_id').notNull(), // Retell chat ID
  role: text('role').notNull(), // user, assistant, system
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const insertWidgetChatHistorySchema = createInsertSchema(widgetChatHistory).omit({
  id: true,
  timestamp: true,
});

export type InsertWidgetChatHistory = z.infer<typeof insertWidgetChatHistorySchema>;
export type WidgetChatHistory = typeof widgetChatHistory.$inferSelect;

// Legacy aliases for backward compatibility (deprecated - use widgetChatHistory)
export const conversationMessages = widgetChatHistory;
export const widgetChatMessages = widgetChatHistory;
export const insertConversationMessageSchema = insertWidgetChatHistorySchema;
export const insertWidgetChatMessageSchema = insertWidgetChatHistorySchema;
export type InsertConversationMessage = InsertWidgetChatHistory;
export type InsertWidgetChatMessage = InsertWidgetChatHistory;
export type ConversationMessage = WidgetChatHistory;
export type WidgetChatMessage = WidgetChatHistory;

export const insertWidgetConfigSchema = createInsertSchema(widgetConfigs).omit({
  id: true,
  updatedAt: true,
});

export type InsertWidgetConfig = z.infer<typeof insertWidgetConfigSchema>;
export type WidgetConfig = typeof widgetConfigs.$inferSelect;

// Safe Widget Config DTO (excludes Retell AI credentials for client admins)
// Only platform admins can access retellApiKey and retellAgentId
export const safeWidgetConfigCreateSchema = createInsertSchema(widgetConfigs).omit({
  id: true,
  updatedAt: true,
  tenantId: true,
  retellApiKey: true,
  retellAgentId: true,
});

export const safeWidgetConfigUpdateSchema = safeWidgetConfigCreateSchema.partial();

export type SafeWidgetConfig = Omit<WidgetConfig, 'retellApiKey' | 'retellAgentId'>;
export type InsertSafeWidgetConfig = z.infer<typeof safeWidgetConfigCreateSchema>;
export type UpdateSafeWidgetConfig = z.infer<typeof safeWidgetConfigUpdateSchema>;

// ============================================
// REMOVED TABLES (Migrations 0013 & 0014)
// ============================================
// Migration 0013 dropped: users, analytics_events, daily_analytics, webhook_analytics
// Migration 0014 dropped: conversations, messages (replaced by widget_handoffs + widget_handoff_messages)
// Migration 0014 renamed: conversation_messages → widget_chat_history
//
// These tables have been completely removed and should no longer be used:
// - users (replaced by client_users)
// - analytics_events (never used)
// - daily_analytics (never used)
// - webhook_analytics (never used)
// - conversations (replaced by widget_handoffs)
// - messages (replaced by widget_handoff_messages)

// Legacy stubs for backward compatibility only - DO NOT USE
export const users = { id: '', username: '', password: '' } as any;
export type User = { id: string; username: string; password: string };
export type InsertUser = Omit<User, 'id'>;

// ============================================
// PASSWORD RESET TOKENS
// ============================================

// Password Reset Tokens (for forgot password flow)
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id')
    .notNull()
    .references(() => clientUsers.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), // Secure random token
  expiresAt: timestamp('expires_at').notNull(), // 30 minutes expiration
  used: boolean('used').notNull().default(false), // One-time use only
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ============================================
// WIDGET HANDOFFS
// ============================================

// Widget Handoffs (Track handoff requests from widget conversations)
export const widgetHandoffs = pgTable('widget_handoffs', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  chatId: text('chat_id').notNull(), // Retell chat ID from widget - required (handoff happens after chat starts)
  status: text('status').notNull().default('pending'), // pending, active, resolved, expired
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  pickedUpAt: timestamp('picked_up_at'), // When agent picked up the chat
  resolvedAt: timestamp('resolved_at'), // When chat was resolved
  assignedAgentId: varchar('assigned_agent_id').references(() => humanAgents.id, {
    onDelete: 'set null',
  }),
  // After-hours support
  userEmail: text('user_email'), // Email collected when no agents available
  userMessage: text('user_message'), // Optional message from user explaining their issue
  // Conversation context
  conversationHistory: jsonb('conversation_history'), // Array of AI messages for agent context
  lastUserMessage: text('last_user_message'), // Most recent message before handoff
  metadata: jsonb('metadata'), // Additional context (user browser, location, etc.)
});

export const insertWidgetHandoffSchema = createInsertSchema(widgetHandoffs).omit({
  id: true,
  requestedAt: true,
});

export type InsertWidgetHandoff = z.infer<typeof insertWidgetHandoffSchema>;
export type WidgetHandoff = typeof widgetHandoffs.$inferSelect;

// Widget Handoff Messages (Messages exchanged during handoff)
export const widgetHandoffMessages = pgTable('widget_handoff_messages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  handoffId: varchar('handoff_id')
    .notNull()
    .references(() => widgetHandoffs.id, { onDelete: 'cascade' }),
  senderType: text('sender_type').notNull(), // user, agent, system
  senderId: varchar('sender_id'), // humanAgents.id for agent messages
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const insertWidgetHandoffMessageSchema = createInsertSchema(widgetHandoffMessages).omit({
  id: true,
  timestamp: true,
});

export type InsertWidgetHandoffMessage = z.infer<typeof insertWidgetHandoffMessageSchema>;
export type WidgetHandoffMessage = typeof widgetHandoffMessages.$inferSelect;

// ============================================
// TENANT INTEGRATIONS (Multi-Provider Support)
// ============================================

// Tenant Integrations (All third-party service configurations per tenant)
// Platform admin only - stores encrypted credentials for WhatsApp, SMS, N8N, etc.
export const tenantIntegrations = pgTable('tenant_integrations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' })
    .unique(), // One integration config per tenant

  // N8N Configuration
  n8nBaseUrl: text('n8n_base_url'), // e.g., "https://n8n.hostinger.com/webhook/tenant123"
  n8nApiKey: text('n8n_api_key'), // ENCRYPTED - Optional API key if n8n requires auth

  // WhatsApp Business API Configuration (Meta Cloud API)
  whatsappEnabled: boolean('whatsapp_enabled').notNull().default(false),
  whatsappConfig: jsonb('whatsapp_config'),
  // Structure (sensitive fields encrypted within JSONB):
  // {
  //   "phoneNumberId": "915998021588678",
  //   "businessAccountId": "1471345127284298",
  //   "accessToken": "ENCRYPTED_EAA...",     <- Encrypted
  //   "webhookVerifyToken": "ENCRYPTED_...",  <- Encrypted
  //   "phoneNumber": "+91 599 8021 588"       <- Display only
  // }

  // SMS Provider Configuration (Twilio, Vonage, AWS SNS, etc.)
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  smsConfig: jsonb('sms_config'),
  // Structure (sensitive fields encrypted within JSONB):
  // {
  //   "provider": "twilio",                   <- "twilio" | "vonage" | "aws_sns"
  //   "accountSid": "ENCRYPTED_AC...",        <- Encrypted
  //   "authToken": "ENCRYPTED_...",           <- Encrypted
  //   "phoneNumber": "+1234567890",
  //   "messagingServiceSid": "MG..."          <- Optional (Twilio)
  // }

  // Audit Trail
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: varchar('updated_by').references(() => clientUsers.id), // Platform admin who made changes
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: varchar('created_by').references(() => clientUsers.id), // Platform admin who created
});

export const insertTenantIntegrationSchema = createInsertSchema(tenantIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTenantIntegration = z.infer<typeof insertTenantIntegrationSchema>;
export type TenantIntegration = typeof tenantIntegrations.$inferSelect;

// N8N Webhooks (Dynamic webhook URLs per tenant)
// Separate table for better management of 20+ webhooks per tenant
export const n8nWebhooks = pgTable(
  'n8n_webhooks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    workflowName: text('workflow_name').notNull(),
    // e.g., "contact_form", "booking_request", "support_ticket"

    // Webhook type: determines how this webhook is used
    webhookType: text('webhook_type').notNull().default('event_listener'),
    // Values: 'event_listener' | 'function_call'
    // - event_listener: Receives async events from Retell (chat_analyzed, call_analyzed, etc.)
    // - function_call: Called synchronously by Retell agents during conversations

    // For event_listener type: which event(s) trigger this webhook
    eventType: text('event_type'),
    // Values: 'chat_analyzed', 'call_analyzed', 'chat_started', 'chat_ended', '*' (all events)
    // Required for event_listener, null for function_call

    // For function_call type: the function name used in Retell agent config
    functionName: text('function_name'),
    // e.g., 'get_booking_details', 'create_booking', 'cancel_appointment'
    // Required for function_call, null for event_listener

    webhookUrl: text('webhook_url').notNull(),
    // e.g., "https://n8n.hostinger.com/webhook/tenant123/contact"

    description: text('description'),
    // Optional: "Handles contact form submissions from website"

    isActive: boolean('is_active').notNull().default(true),

    // Webhook-specific auth (optional - if different from tenant-level)
    authToken: text('auth_token'), // ENCRYPTED - Optional per-webhook auth

    // For function_call type: timeout in milliseconds
    responseTimeout: integer('response_timeout').default(10000),
    // How long to wait for N8N to respond (function calls only)

    // For function_call type: whether to retry on failure
    retryOnFailure: boolean('retry_on_failure').default(false),

    // Usage tracking
    lastCalledAt: timestamp('last_called_at'),
    totalCalls: integer('total_calls').notNull().default(0),
    successfulCalls: integer('successful_calls').notNull().default(0),
    failedCalls: integer('failed_calls').notNull().default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: varchar('created_by').references(() => clientUsers.id), // Platform admin
  },
  (table) => ({
    uniqueTenantWorkflow: uniqueIndex('unique_tenant_workflow_idx').on(
      table.tenantId,
      table.workflowName,
    ),
    uniqueTenantFunction: uniqueIndex('unique_tenant_function_idx').on(
      table.tenantId,
      table.functionName,
    ),
  }),
);

export const insertN8nWebhookSchema = createInsertSchema(n8nWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastCalledAt: true,
  totalCalls: true,
  successfulCalls: true,
  failedCalls: true,
});

export type InsertN8nWebhook = z.infer<typeof insertN8nWebhookSchema>;
export type N8nWebhook = typeof n8nWebhooks.$inferSelect;

// ============================================
// RETELL AI CHAT ANALYTICS
// ============================================

// Chat Analytics (Track chat sessions from Retell AI chat_analyzed webhook)
export const chatAnalytics = pgTable(
  'chat_analytics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Retell Chat Metadata
    chatId: text('chat_id').notNull().unique(), // Retell's chat ID
    agentId: text('agent_id').notNull(), // Retell agent ID
    agentName: text('agent_name'), // Agent display name
    agentVersion: text('agent_version'), // Agent version number
    chatType: text('chat_type'), // e.g., "web_chat", "mobile_chat"
    chatStatus: text('chat_status'), // e.g., "completed", "abandoned"

    // Timestamps
    startTimestamp: timestamp('start_timestamp'), // When chat started
    endTimestamp: timestamp('end_timestamp'), // When chat ended
    duration: integer('duration'), // Duration in seconds

    // Conversation Data
    messageCount: integer('message_count'), // Total messages exchanged
    toolCallsCount: integer('tool_calls_count'), // Number of tool/function calls
    dynamicVariables: jsonb('dynamic_variables'), // Collected variables (booking_uid, user_intention, etc.)

    // Chat Analysis (AI-generated)
    userSentiment: text('user_sentiment'), // positive, negative, neutral, frustrated, satisfied
    chatSuccessful: boolean('chat_successful'), // Whether chat achieved its goal

    // Cost Tracking
    combinedCost: real('combined_cost'), // Total cost (supports decimals)
    productCosts: jsonb('product_costs'), // Breakdown by model (gpt-4o, etc.)

    // Metadata
    metadata: jsonb('metadata'), // Additional data (whatsapp_user, etc.)

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for fast lookups
    tenantChatIdx: uniqueIndex('chat_analytics_tenant_chat_idx').on(table.tenantId, table.chatId),
    tenantAgentIdx: uniqueIndex('chat_analytics_tenant_agent_idx').on(
      table.tenantId,
      table.agentId,
      table.startTimestamp,
    ),
    sentimentIdx: uniqueIndex('chat_analytics_sentiment_idx').on(
      table.tenantId,
      table.userSentiment,
      table.startTimestamp,
    ),
  }),
);

export const insertChatAnalyticsSchema = createInsertSchema(chatAnalytics).omit({
  id: true,
  createdAt: true,
});

export type InsertChatAnalytics = z.infer<typeof insertChatAnalyticsSchema>;
export type ChatAnalytics = typeof chatAnalytics.$inferSelect;

// ============================================
// RETELL AI VOICE ANALYTICS
// ============================================

// Voice Analytics (Track voice call sessions from Retell AI call.ended webhook)
// Mirrors chat_analytics structure for consistency
export const voiceAnalytics = pgTable(
  'voice_analytics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Retell Call Metadata
    callId: text('call_id').notNull().unique(), // Retell's call ID
    agentId: text('agent_id').notNull(), // Retell agent ID
    agentName: text('agent_name'), // Agent display name
    agentVersion: text('agent_version'), // Agent version number
    callType: text('call_type'), // e.g., "inbound", "outbound", "web_call"
    callStatus: text('call_status'), // e.g., "ended", "voicemail", "failed"

    // Timestamps
    startTimestamp: timestamp('start_timestamp'), // When call started
    endTimestamp: timestamp('end_timestamp'), // When call ended
    duration: integer('duration'), // Duration in seconds

    // Call Data
    messageCount: integer('message_count'), // Total messages/turns exchanged
    toolCallsCount: integer('tool_calls_count'), // Number of tool/function calls
    dynamicVariables: jsonb('dynamic_variables'), // Collected variables (booking_uid, user_intention, etc.)

    // Call Analysis (AI-generated)
    userSentiment: text('user_sentiment'), // positive, negative, neutral, frustrated, satisfied
    callSuccessful: boolean('call_successful'), // Whether call achieved its goal

    // Cost Tracking
    combinedCost: real('combined_cost'), // Total cost (supports decimals)
    productCosts: jsonb('product_costs'), // Breakdown by model (gpt-4o, whisper, etc.)

    // Metadata
    metadata: jsonb('metadata'), // Additional data (disconnect_reason, from_number, to_number, etc.)

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for fast lookups
    tenantCallIdx: uniqueIndex('voice_analytics_tenant_call_idx').on(table.tenantId, table.callId),
    tenantAgentIdx: uniqueIndex('voice_analytics_tenant_agent_idx').on(
      table.tenantId,
      table.agentId,
      table.startTimestamp,
    ),
    sentimentIdx: uniqueIndex('voice_analytics_sentiment_idx').on(
      table.tenantId,
      table.userSentiment,
      table.startTimestamp,
    ),
  }),
);

export const insertVoiceAnalyticsSchema = createInsertSchema(voiceAnalytics).omit({
  id: true,
  createdAt: true,
});

export type InsertVoiceAnalytics = z.infer<typeof insertVoiceAnalyticsSchema>;
export type VoiceAnalytics = typeof voiceAnalytics.$inferSelect;

// ============================================
// REMOVED: retell_transcript_messages (Migration 0015)
// ============================================
// This table was removed because:
// - Messages are already stored in real-time in widget_chat_history
// - Storing Retell's post-chat transcript was redundant
// - Real-time messages are sufficient for our use case
//
// If needed in the future, use widget_chat_history for message data

// ============================================
// EXTERNAL API CONFIGURATIONS
// ============================================

/**
 * External API Configurations
 * Stores credentials and settings for ANY external API that N8N needs to call
 * Examples: Google Calendar, Stripe, SendGrid, custom APIs, etc.
 */
export const externalApiConfigs = pgTable(
  'external_api_configs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Service identification
    serviceName: text('service_name').notNull(),
    // e.g., 'google_calendar', 'stripe', 'sendgrid', 'custom_crm'
    // Used in proxy URL: /api/proxy/:tenantId/http/:serviceName/*

    displayName: text('display_name').notNull(),
    // User-friendly name shown in UI

    baseUrl: text('base_url').notNull(),
    // Base URL for the API, e.g., 'https://api.stripe.com'
    // Proxy will append the endpoint path from N8N request

    // Authentication configuration
    authType: text('auth_type').notNull(),
    // Values: 'bearer', 'api_key', 'basic', 'oauth2', 'custom_header', 'none'

    // Encrypted credentials (JSON object structure varies by authType)
    encryptedCredentials: text('encrypted_credentials'),
    // For bearer: { "token": "sk_live_..." }
    // For api_key: { "key": "abc123", "headerName": "X-API-Key" }
    // For basic: { "username": "user", "password": "pass" }
    // For oauth2: { "accessToken": "...", "refreshToken": "...", "expiresAt": "..." }
    // For custom_header: { "headerName": "X-Custom-Auth", "headerValue": "..." }

    // Additional headers (JSON object)
    customHeaders: jsonb('custom_headers'),
    // { "Content-Type": "application/json", "X-Custom-Header": "value" }

    // Optional description
    description: text('description'),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    // Usage tracking
    lastUsedAt: timestamp('last_used_at'),
    totalCalls: integer('total_calls').notNull().default(0),
    successfulCalls: integer('successful_calls').notNull().default(0),
    failedCalls: integer('failed_calls').notNull().default(0),

    // Audit
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: varchar('created_by').references(() => clientUsers.id),
  },
  (table) => ({
    // Unique: one configuration per tenant per service name
    tenantServiceIdx: uniqueIndex('external_api_configs_tenant_service_idx').on(
      table.tenantId,
      table.serviceName,
    ),
  }),
);

export const insertExternalApiConfigSchema = createInsertSchema(externalApiConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
  totalCalls: true,
  successfulCalls: true,
  failedCalls: true,
});

export type InsertExternalApiConfig = z.infer<typeof insertExternalApiConfigSchema>;
export type ExternalApiConfig = typeof externalApiConfigs.$inferSelect;

// Settings Schema (keeping for backward compatibility)
export const settingsSchema = z.object({
  apiKey: z.string().optional(),
  flowId: z.string().optional(),
  agentId: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
