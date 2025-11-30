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
  retellApiKey: text('retell_api_key'), // Tenant's own Retell AI API key for account-wide analytics
  greeting: text('greeting').default('Hi! How can I help you today?'),
  allowedDomains: text('allowed_domains').array(), // Array of allowed domains
  primaryColor: text('primary_color').default('#9b7ddd'), // Main theme color (buttons, header)
  textColor: text('text_color').default('#ffffff'), // Text color on primary background
  borderRadius: text('border_radius').default('12px'), // Border radius for widget elements
  position: text('position').default('bottom-right'), // Widget position: top-left, top-center, top-right, middle-left, middle-right, bottom-left, bottom-center, bottom-right
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Widget Chat Messages (Store all chat messages for history persistence)
export const widgetChatMessages = pgTable('widget_chat_messages', {
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

export const insertWidgetChatMessageSchema = createInsertSchema(widgetChatMessages).omit({
  id: true,
  timestamp: true,
});

export type InsertWidgetChatMessage = z.infer<typeof insertWidgetChatMessageSchema>;
export type WidgetChatMessage = typeof widgetChatMessages.$inferSelect;

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
// UPDATED EXISTING TABLES WITH TENANT SCOPING
// ============================================

// ...existing code...
export const users = pgTable('users', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Conversations (now tenant-scoped with human handoff support)
export const conversations = pgTable('conversations', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  flowId: text('flow_id'),
  agentId: text('agent_id'),
  endUserId: text('end_user_id'), // Optional: track which end user this conversation belongs to
  metadata: jsonb('metadata'),
  // Human Agent Handoff Fields
  handoffStatus: text('handoff_status').notNull().default('ai'), // ai, pending_handoff, with_human, completed
  humanAgentId: varchar('human_agent_id').references(() => humanAgents.id, {
    onDelete: 'set null',
  }),
  conversationSummary: text('conversation_summary'), // AI-generated summary for human agent context
  handoffTimestamp: timestamp('handoff_timestamp'), // When handoff was triggered
  handoffReason: text('handoff_reason'), // user_request, ai_escalation, timeout, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  tenantId: true, // Server will inject this from authenticated user
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages (now tenant-scoped with sender tracking)
export const messages = pgTable('messages', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: varchar('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user, assistant, system
  content: text('content').notNull(),
  senderType: text('sender_type').notNull().default('user'), // user (end-customer), ai (Retell agent), human (human agent), system
  humanAgentId: varchar('human_agent_id').references(() => humanAgents.id, {
    onDelete: 'set null',
  }),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
  tenantId: true, // Server will inject this from authenticated user
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ============================================
// ANALYTICS TABLES
// ============================================

// Analytics Events (Track all events for analytics)
export const analyticsEvents = pgTable('analytics_events', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  conversationId: varchar('conversation_id').references(() => conversations.id, {
    onDelete: 'cascade',
  }),
  eventType: text('event_type').notNull(), // conversation_started, message_sent, booking_action, etc.
  eventData: jsonb('event_data'), // Flexible JSON data for event details
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// Daily Analytics Summary (Pre-aggregated metrics for fast dashboard loading)
export const dailyAnalytics = pgTable(
  'daily_analytics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    date: timestamp('date').notNull(),
    conversationCount: integer('conversation_count').notNull().default(0),
    messageCount: integer('message_count').notNull().default(0),
    uniqueUsers: integer('unique_users').notNull().default(0),
    avgInteractions: integer('avg_interactions').notNull().default(0),
    bookingActions: integer('booking_actions').notNull().default(0),
  },
  (table) => ({
    // Unique constraint to prevent duplicate analytics for same tenant/date
    uniqueTenantDate: uniqueIndex('unique_tenant_date_idx').on(table.tenantId, table.date),
  }),
);

export const insertDailyAnalyticsSchema = createInsertSchema(dailyAnalytics).omit({
  id: true,
});

export type InsertDailyAnalytics = z.infer<typeof insertDailyAnalyticsSchema>;
export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;

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

    webhookUrl: text('webhook_url').notNull(),
    // e.g., "https://n8n.hostinger.com/webhook/tenant123/contact"

    description: text('description'),
    // Optional: "Handles contact form submissions from website"

    isActive: boolean('is_active').notNull().default(true),

    // Webhook-specific auth (optional - if different from tenant-level)
    authToken: text('auth_token'), // ENCRYPTED - Optional per-webhook auth

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

// Webhook Analytics (Track all webhook calls for monitoring and debugging)
export const webhookAnalytics = pgTable(
  'webhook_analytics',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    webhookId: varchar('webhook_id')
      .notNull()
      .references(() => n8nWebhooks.id, { onDelete: 'cascade' }),

    // Request Details
    requestPayload: jsonb('request_payload'), // What was sent to webhook
    requestHeaders: jsonb('request_headers'), // Headers sent (sanitized - no auth tokens)

    // Response Details
    statusCode: integer('status_code'), // HTTP status code (200, 500, etc.)
    responseBody: jsonb('response_body'), // Response from n8n
    responseTime: integer('response_time'), // Milliseconds

    // Status
    success: boolean('success').notNull(), // True if status 2xx
    errorMessage: text('error_message'), // Error details if failed

    // Context
    triggeredBy: text('triggered_by'), // What triggered this webhook (e.g., "widget_chat", "api_call")
    metadata: jsonb('metadata'), // Additional context

    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    // Index for fast lookups by tenant and webhook
    tenantWebhookIdx: uniqueIndex('webhook_analytics_tenant_webhook_idx').on(
      table.tenantId,
      table.webhookId,
      table.timestamp,
    ),
  }),
);

export const insertWebhookAnalyticsSchema = createInsertSchema(webhookAnalytics).omit({
  id: true,
  timestamp: true,
});

export type InsertWebhookAnalytics = z.infer<typeof insertWebhookAnalyticsSchema>;
export type WebhookAnalytics = typeof webhookAnalytics.$inferSelect;

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

// Chat Messages (Individual messages from chat sessions - optional detailed storage)
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    chatAnalyticsId: varchar('chat_analytics_id')
      .notNull()
      .references(() => chatAnalytics.id, { onDelete: 'cascade' }),

    // Message Details
    messageId: text('message_id'), // Retell's message ID
    role: text('role').notNull(), // 'agent' or 'user'
    content: text('content').notNull(), // Message content
    timestamp: timestamp('timestamp').notNull(), // When message was sent

    // Function/Tool Calls
    toolCallId: text('tool_call_id'), // If this message triggered a tool
    nodeTransition: text('node_transition'), // Which node this led to

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Index for fast lookups by chat
    chatMessagesIdx: uniqueIndex('chat_messages_chat_idx').on(
      table.chatAnalyticsId,
      table.timestamp,
    ),
  }),
);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Settings Schema (keeping for backward compatibility)
export const settingsSchema = z.object({
  apiKey: z.string().optional(),
  flowId: z.string().optional(),
  agentId: z.string().optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
