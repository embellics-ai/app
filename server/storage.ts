import {
  type Tenant,
  type InsertTenant,
  type ClientUser,
  type InsertClientUser,
  type ApiKey,
  type InsertApiKey,
  type WidgetConfig,
  type InsertWidgetConfig,
  type TenantRetellAgent,
  type InsertTenantRetellAgent,
  type HumanAgent,
  type InsertHumanAgent,
  type UserInvitation,
  type InsertUserInvitation,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type WidgetHandoff,
  type InsertWidgetHandoff,
  type WidgetHandoffMessage,
  type InsertWidgetHandoffMessage,
  type WidgetChatMessage,
  type InsertWidgetChatMessage,
  type TenantIntegration,
  type InsertTenantIntegration,
  type N8nWebhook,
  type InsertN8nWebhook,
  type ChatAnalytics,
  type InsertChatAnalytics,
  // ChatMessage and InsertChatMessage removed - table dropped in migration 0015
  type VoiceAnalytics,
  type InsertVoiceAnalytics,
  type ExternalApiConfig,
  type InsertExternalApiConfig,
  type TenantBusiness,
  type InsertTenantBusiness,
  type TenantBranch,
  type InsertTenantBranch,
  type Client,
  type InsertClient,
  type ClientServiceMapping,
  type InsertClientServiceMapping,
  type Lead,
  type InsertLead,
  type Booking,
  type InsertBooking,
  tenants,
  clientUsers,
  apiKeys,
  widgetConfigs,
  tenantRetellAgents,
  humanAgents,
  userInvitations,
  passwordResetTokens,
  widgetHandoffs,
  widgetHandoffMessages,
  conversationMessages,
  tenantIntegrations,
  n8nWebhooks,
  chatAnalytics,
  voiceAnalytics,
  externalApiConfigs,
  tenantBusinesses,
  tenantBranches,
  clients,
  clientServiceMappings,
  leads,
  bookings,
} from '@shared/schema';
import { randomUUID } from 'crypto';
import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, desc, and, or, gte, lte, gt, sql, isNull } from 'drizzle-orm';
import { encryptApiKey, decryptApiKey } from './encryption';

export interface IStorage {
  // Legacy User methods - REMOVED (see migration 0013)
  // users table has been dropped - use client_users instead

  // Tenant methods
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByEmail(email: string): Promise<Tenant | undefined>;
  getAllTenants(): Promise<Tenant[]>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined>;
  deleteTenant(id: string): Promise<void>;

  // Client User methods (authentication)
  getClientUser(id: string): Promise<ClientUser | undefined>;
  getClientUserByEmail(email: string): Promise<ClientUser | undefined>;
  getClientUsersByTenant(tenantId: string): Promise<ClientUser[]>;
  createClientUser(user: InsertClientUser): Promise<ClientUser>;
  updateClientUser(id: string, updates: Partial<InsertClientUser>): Promise<ClientUser | undefined>;
  updateClientUserPassword(id: string, hashedPassword: string): Promise<void>;
  deleteClientUser(id: string): Promise<void>;
  markOnboardingComplete(userId: string): Promise<void>;

  // API Key methods
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getAllApiKeys(): Promise<ApiKey[]>;
  getApiKeysByTenant(tenantId: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  deleteApiKey(id: string, tenantId: string): Promise<void>;

  // Widget Config methods
  getWidgetConfig(tenantId: string): Promise<WidgetConfig | undefined>;
  getWidgetConfigByAgentId(agentId: string): Promise<WidgetConfig | undefined>;
  createWidgetConfig(config: InsertWidgetConfig): Promise<WidgetConfig>;
  updateWidgetConfig(
    tenantId: string,
    updates: Partial<InsertWidgetConfig>,
  ): Promise<WidgetConfig | undefined>;

  // Tenant Retell Agents methods (multi-agent support with channel assignments)
  getTenantAgents(tenantId: string): Promise<TenantRetellAgent[]>;
  getTenantAgentsByChannel(tenantId: string, channel: string): Promise<TenantRetellAgent[]>;
  getTenantByAgentId(
    agentId: string,
  ): Promise<{ tenantId: string; agent: TenantRetellAgent } | undefined>;
  addTenantAgent(agent: InsertTenantRetellAgent): Promise<TenantRetellAgent>;
  updateTenantAgent(
    id: string,
    updates: Partial<InsertTenantRetellAgent>,
  ): Promise<TenantRetellAgent | undefined>;
  removeTenantAgent(tenantId: string, agentId: string): Promise<void>;
  clearTenantAgents(tenantId: string): Promise<void>;

  // Human Agent methods
  getHumanAgent(id: string): Promise<HumanAgent | undefined>;
  getHumanAgentsByTenant(tenantId: string): Promise<HumanAgent[]>;
  getAvailableHumanAgents(tenantId: string): Promise<HumanAgent[]>;
  createHumanAgent(agent: InsertHumanAgent, tenantId: string): Promise<HumanAgent>;
  updateHumanAgent(
    id: string,
    updates: Partial<InsertHumanAgent>,
    tenantId: string,
  ): Promise<HumanAgent | undefined>;
  updateHumanAgentStatus(id: string, status: string, tenantId: string): Promise<void>;
  updateAgentLastSeen(id: string, tenantId: string): Promise<void>;
  incrementActiveChats(id: string, tenantId: string): Promise<void>;
  decrementActiveChats(id: string, tenantId: string): Promise<void>;

  // Legacy Message and Conversation methods - REMOVED (see migration 0014)
  // conversations and messages tables have been dropped
  // Use widget_handoffs and widget_handoff_messages tables instead

  // Analytics methods - REMOVED (see migration 0013)
  // analytics_events, daily_analytics, and webhook_analytics tables have been dropped

  // User Invitation methods
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined>;
  getPendingInvitationByEmail(email: string): Promise<UserInvitation | undefined>;
  getActiveInvitations(tenantId?: string): Promise<UserInvitation[]>; // Platform admin can see all, tenant admin sees only their tenant
  getPendingInvitations(): Promise<UserInvitation[]>; // Get all pending invitations (status: pending or sent)
  updateInvitationStatus(id: string, status: string, lastSentAt?: Date): Promise<void>;
  markInvitationAccepted(id: string, userId: string): Promise<void>;
  markInvitationUsed(id: string): Promise<void>; // Legacy - keeping for backward compatibility
  deleteInvitation(id: string): Promise<void>;
  cleanupExpiredInvitationPasswords(): Promise<number>; // Null out plaintext passwords for expired/accepted invitations
  // Clear plaintext temporary password for a specific invitation (immediate)
  clearInvitationPlainPassword(id: string): Promise<void>;

  // Platform Admin methods
  getAllUsers(): Promise<ClientUser[]>; // Get all users across all tenants (platform admin only)
  getPlatformAdmins(): Promise<ClientUser[]>; // Get all platform admins
  updateUserRole(
    userId: string,
    role: string,
    isPlatformAdmin: boolean,
  ): Promise<ClientUser | undefined>;

  // Password Reset Token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  getAllUnexpiredResetTokens(): Promise<PasswordResetToken[]>;
  markTokenAsUsed(token: string): Promise<void>;
  markTokenAsUsedById(id: string): Promise<void>;
  cleanupExpiredResetTokens(): Promise<number>; // Clean up expired/used tokens

  // Widget Handoff methods
  createWidgetHandoff(handoff: InsertWidgetHandoff): Promise<WidgetHandoff>;
  getWidgetHandoff(id: string): Promise<WidgetHandoff | undefined>;
  getWidgetHandoffsByTenant(tenantId: string): Promise<WidgetHandoff[]>;
  getPendingWidgetHandoffs(tenantId: string): Promise<WidgetHandoff[]>;
  getActiveWidgetHandoffs(tenantId: string): Promise<WidgetHandoff[]>;
  updateWidgetHandoffStatus(
    id: string,
    status: string,
    updates?: Partial<InsertWidgetHandoff>,
  ): Promise<WidgetHandoff | undefined>;
  assignHandoffToAgent(
    handoffId: string,
    agentId: string,
    tenantId: string,
  ): Promise<WidgetHandoff | undefined>;

  // Widget Handoff Message methods
  createWidgetHandoffMessage(message: InsertWidgetHandoffMessage): Promise<WidgetHandoffMessage>;
  getWidgetHandoffMessages(handoffId: string): Promise<WidgetHandoffMessage[]>;
  getWidgetHandoffMessagesSince(
    handoffId: string,
    sinceTimestamp: Date,
  ): Promise<WidgetHandoffMessage[]>;

  // Widget Chat Message methods (for history persistence)
  createWidgetChatMessage(message: InsertWidgetChatMessage): Promise<WidgetChatMessage>;
  getWidgetChatMessages(chatId: string): Promise<WidgetChatMessage[]>;

  // Tenant Integrations methods
  getTenantIntegration(tenantId: string): Promise<TenantIntegration | undefined>;
  createTenantIntegration(integration: InsertTenantIntegration): Promise<TenantIntegration>;
  updateTenantIntegration(
    tenantId: string,
    updates: Partial<InsertTenantIntegration>,
  ): Promise<TenantIntegration | undefined>;
  deleteTenantIntegration(tenantId: string): Promise<void>;

  // N8N Webhooks methods
  getN8nWebhook(id: string): Promise<N8nWebhook | undefined>;
  getN8nWebhooksByTenant(tenantId: string): Promise<N8nWebhook[]>;
  getN8nWebhookByName(tenantId: string, workflowName: string): Promise<N8nWebhook | undefined>;
  getActiveN8nWebhooks(tenantId: string): Promise<N8nWebhook[]>;
  // NEW: Get webhook by function name (for function call routing)
  getWebhookByFunction(tenantId: string, functionName: string): Promise<N8nWebhook | undefined>;
  // NEW: Get webhooks by event type (for event listener routing)
  getWebhooksByEvent(tenantId: string, eventType: string): Promise<N8nWebhook[]>;
  createN8nWebhook(webhook: InsertN8nWebhook): Promise<N8nWebhook>;
  updateN8nWebhook(id: string, updates: Partial<InsertN8nWebhook>): Promise<N8nWebhook | undefined>;
  incrementWebhookStats(id: string, success: boolean): Promise<void>;
  deleteN8nWebhook(id: string, tenantId: string): Promise<void>;

  // Webhook Analytics methods - REMOVED (see migration 0013)
  // webhook_analytics table has been dropped

  // Chat Analytics Methods
  createChatAnalytics(analytics: InsertChatAnalytics): Promise<ChatAnalytics>;
  getChatAnalytics(id: string): Promise<ChatAnalytics | undefined>;
  getChatAnalyticsByChatId(chatId: string): Promise<ChatAnalytics | undefined>;
  getChatAnalyticsByTenant(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      sentiment?: string;
      chatStatus?: string;
      limit?: number;
    },
  ): Promise<ChatAnalytics[]>;
  getChatAnalyticsSummary(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
    },
  ): Promise<{
    totalChats: number;
    successfulChats: number;
    totalDuration: number;
    averageDuration: number;
    totalCost: number;
    averageCost: number;
    sentimentBreakdown: Record<string, number>;
  }>;
  deleteOldChatAnalytics(olderThanDays: number): Promise<void>;

  // Voice Analytics Methods (mirrors chat analytics structure)
  createVoiceAnalytics(analytics: InsertVoiceAnalytics): Promise<VoiceAnalytics>;
  getVoiceAnalytics(id: string): Promise<VoiceAnalytics | undefined>;
  getVoiceAnalyticsByCallId(callId: string): Promise<VoiceAnalytics | undefined>;
  getVoiceAnalyticsByTenant(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      sentiment?: string;
      callStatus?: string;
      limit?: number;
    },
  ): Promise<VoiceAnalytics[]>;
  getVoiceAnalyticsSummary(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
    },
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    totalDuration: number;
    averageDuration: number;
    totalCost: number;
    averageCost: number;
    sentimentBreakdown: Record<string, number>;
  }>;
  getVoiceAnalyticsTimeSeries(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      groupBy?: 'hour' | 'day' | 'week';
    },
  ): Promise<{
    callCounts: { date: string; count: number; successful: number; unsuccessful: number }[];
    durationData: { date: string; averageDuration: number; totalDuration: number }[];
    sentimentData: {
      date: string;
      positive: number;
      neutral: number;
      negative: number;
      unknown: number;
    }[];
    costData: { date: string; totalCost: number; averageCost: number }[];
    statusBreakdown: Record<string, number>;
  }>;
  getVoiceAnalyticsAgentBreakdown(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<
    {
      agentId: string;
      agentName: string;
      count: number;
      totalCalls: number;
      successfulCalls: number;
      successRate: number;
      totalDuration: number;
      averageDuration: number;
      totalCost: number;
      averageCost: number;
      sentimentBreakdown: Record<string, number>;
    }[]
  >;
  deleteOldVoiceAnalytics(olderThanDays: number): Promise<void>;

  // Chat Messages Methods - REMOVED (retell_transcript_messages table dropped in migration 0015)
  // Use getWidgetChatMessages() for real-time message data instead

  // External API Configurations Methods
  getExternalApiConfig(
    tenantId: string,
    serviceName: string,
  ): Promise<ExternalApiConfig | undefined>;
  listExternalApiConfigs(tenantId: string): Promise<ExternalApiConfig[]>;
  createExternalApiConfig(config: InsertExternalApiConfig): Promise<ExternalApiConfig>;
  updateExternalApiConfig(
    id: string,
    updates: Partial<InsertExternalApiConfig>,
  ): Promise<ExternalApiConfig | undefined>;
  deleteExternalApiConfig(id: string): Promise<void>;
  markExternalApiConfigUsed(id: string): Promise<void>;
  incrementExternalApiStats(id: string, success: boolean): Promise<void>;

  // Tenant Business methods
  getTenantBusiness(id: string): Promise<TenantBusiness | undefined>;
  getTenantBusinessByService(
    tenantId: string,
    serviceName: string,
  ): Promise<TenantBusiness | undefined>;
  getTenantBusinessesByTenant(tenantId: string): Promise<TenantBusiness[]>;
  createTenantBusiness(business: InsertTenantBusiness): Promise<TenantBusiness>;
  updateTenantBusiness(
    id: string,
    updates: Partial<InsertTenantBusiness>,
  ): Promise<TenantBusiness | undefined>;
  deleteTenantBusiness(id: string): Promise<void>;

  // Tenant Branch methods
  getTenantBranch(id: string): Promise<TenantBranch | undefined>;
  getTenantBranchByBranchId(
    businessId: string,
    branchId: string,
  ): Promise<TenantBranch | undefined>;
  getTenantBranchesByBusiness(businessId: string): Promise<TenantBranch[]>;
  getPrimaryBranch(businessId: string): Promise<TenantBranch | undefined>;
  createTenantBranch(branch: InsertTenantBranch): Promise<TenantBranch>;
  updateTenantBranch(
    id: string,
    updates: Partial<InsertTenantBranch>,
  ): Promise<TenantBranch | undefined>;
  setPrimaryBranch(businessId: string, branchId: string): Promise<void>;
  deleteTenantBranch(id: string): Promise<void>;

  // Client methods
  getClient(id: string): Promise<Client | undefined>;
  getClientByPhone(tenantId: string, phone: string): Promise<Client | undefined>;
  getClientByExternalId(
    tenantId: string,
    serviceName: string,
    externalClientId: string,
  ): Promise<Client | undefined>;
  getClientsByTenant(
    tenantId: string,
    filters?: {
      status?: string;
      source?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Client[]>;
  getClientStats(tenantId: string): Promise<{
    totalClients: number;
    activeClients: number;
    newThisMonth: number;
    bySource: Record<string, number>;
  }>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  // Client Service Mapping methods
  getClientServiceMapping(id: string): Promise<ClientServiceMapping | undefined>;
  getClientServiceMappings(clientId: string): Promise<ClientServiceMapping[]>;
  getClientByServiceProviderId(
    tenantId: string,
    serviceName: string,
    serviceProviderClientId: string,
  ): Promise<Client | undefined>;
  createClientServiceMapping(mapping: InsertClientServiceMapping): Promise<ClientServiceMapping>;
  updateClientServiceMapping(
    id: string,
    updates: Partial<InsertClientServiceMapping>,
  ): Promise<ClientServiceMapping | undefined>;
  deleteClientServiceMapping(id: string): Promise<void>;

  // Lead methods
  getLead(id: string): Promise<Lead | undefined>;
  getLeadByPhone(tenantId: string, phone: string): Promise<Lead | undefined>;
  getLeadsByTenant(
    tenantId: string,
    filters?: {
      status?: string;
      assignedAgentId?: string;
      needsFollowUp?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined>;
  convertLeadToClient(leadId: string, clientId: string): Promise<void>;
  deleteLead(id: string): Promise<void>;

  // Booking methods
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByClient(clientId: string): Promise<Booking[]>;
  getBookingsByTenant(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
      clientId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Booking[]>;
  getClientBookingStats(clientId: string): Promise<{
    totalBookings: number;
    totalSpent: number;
    averageSpent: number;
    lastBookingDate: Date | null;
    favoriteServices: { serviceName: string; count: number }[];
  }>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined>;
  confirmBooking(bookingId: string, depositAmount?: number): Promise<Booking | undefined>;
  completeBooking(bookingId: string): Promise<Booking | undefined>;
  cancelBooking(
    bookingId: string,
    reason: string,
    refundAmount?: number,
    notes?: string,
  ): Promise<Booking | undefined>;
  markBookingNoShow(bookingId: string): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<void>;
}

// Database storage implementation using PostgreSQL
export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required for database storage');
    }

    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        // In production Render requires SSL for external databases; set to false for self-signed
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      });

      // Drizzle accepts a pg Pool for node-postgres integration
      this.db = drizzle(pool);
    } catch (error) {
      console.error('Failed to initialize database connection:', error);
      throw new Error('Database initialization failed');
    }
  }

  // Legacy User methods - REMOVED (see migration 0013)

  // Tenant methods
  async getTenant(id: string): Promise<Tenant | undefined> {
    const result = await this.db.select().from(tenants).where(eq(tenants.id, id));
    return result[0];
  }

  async getTenantByEmail(email: string): Promise<Tenant | undefined> {
    const result = await this.db.select().from(tenants).where(eq(tenants.email, email));
    return result[0];
  }

  async getAllTenants(): Promise<Tenant[]> {
    return await this.db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const result = await this.db.insert(tenants).values(insertTenant).returning();
    return result[0];
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const result = await this.db.update(tenants).set(updates).where(eq(tenants.id, id)).returning();
    return result[0];
  }

  async deleteTenant(id: string): Promise<void> {
    await this.db.delete(tenants).where(eq(tenants.id, id));
  }

  // Client User methods
  async getClientUser(id: string): Promise<ClientUser | undefined> {
    const result = await this.db.select().from(clientUsers).where(eq(clientUsers.id, id));
    return result[0];
  }

  async getClientUserByEmail(email: string): Promise<ClientUser | undefined> {
    const result = await this.db.select().from(clientUsers).where(eq(clientUsers.email, email));
    return result[0];
  }

  async getClientUsersByTenant(tenantId: string): Promise<ClientUser[]> {
    return await this.db.select().from(clientUsers).where(eq(clientUsers.tenantId, tenantId));
  }

  async createClientUser(insertUser: InsertClientUser): Promise<ClientUser> {
    const result = await this.db.insert(clientUsers).values(insertUser).returning();
    return result[0];
  }

  async updateClientUser(
    id: string,
    updates: Partial<InsertClientUser>,
  ): Promise<ClientUser | undefined> {
    const result = await this.db
      .update(clientUsers)
      .set(updates)
      .where(eq(clientUsers.id, id))
      .returning();
    return result[0];
  }

  async deleteClientUser(id: string): Promise<void> {
    await this.db.delete(clientUsers).where(eq(clientUsers.id, id));
  }

  async updateClientUserPassword(id: string, hashedPassword: string): Promise<void> {
    await this.db
      .update(clientUsers)
      .set({ password: hashedPassword })
      .where(eq(clientUsers.id, id));
  }

  async markOnboardingComplete(userId: string): Promise<void> {
    await this.db
      .update(clientUsers)
      .set({ onboardingCompleted: true })
      .where(eq(clientUsers.id, userId));
  }

  // API Key methods
  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return result[0];
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const result = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return result[0];
  }

  async getAllApiKeys(): Promise<ApiKey[]> {
    return await this.db.select().from(apiKeys);
  }

  async getApiKeysByTenant(tenantId: string): Promise<ApiKey[]> {
    return await this.db.select().from(apiKeys).where(eq(apiKeys.tenantId, tenantId));
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const result = await this.db.insert(apiKeys).values(insertApiKey).returning();
    return result[0];
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsed: new Date() }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: string, tenantId: string): Promise<void> {
    await this.db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
  }

  // Widget Config methods
  async getWidgetConfig(tenantId: string): Promise<WidgetConfig | undefined> {
    const result = await this.db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.tenantId, tenantId));

    const config = result[0];
    if (!config) return undefined;

    // Decrypt the Retell API key if it exists
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error('Error decrypting Retell API key:', error);
        return config;
      }
    }

    return config;
  }

  async getWidgetConfigByAgentId(agentId: string): Promise<WidgetConfig | undefined> {
    // Check both widget agent ID and WhatsApp agent ID
    const result = await this.db
      .select()
      .from(widgetConfigs)
      .where(
        or(eq(widgetConfigs.retellAgentId, agentId), eq(widgetConfigs.whatsappAgentId, agentId)),
      );

    const config = result[0];
    if (!config) return undefined;

    // Decrypt the Retell API key if it exists
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error('Error decrypting Retell API key:', error);
        return config;
      }
    }

    return config;
  }

  async createWidgetConfig(insertConfig: InsertWidgetConfig): Promise<WidgetConfig> {
    // Encrypt the Retell API key if provided
    const configToInsert = { ...insertConfig };
    if (insertConfig.retellApiKey) {
      configToInsert.retellApiKey = encryptApiKey(insertConfig.retellApiKey);
    }

    const result = await this.db.insert(widgetConfigs).values(configToInsert).returning();

    const config = result[0];

    // Decrypt the API key for immediate use
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error('Error decrypting Retell API key:', error);
        return config;
      }
    }

    return config;
  }

  async updateWidgetConfig(
    tenantId: string,
    updates: Partial<InsertWidgetConfig>,
  ): Promise<WidgetConfig | undefined> {
    // Encrypt the Retell API key if being updated
    const updatesToApply = { ...updates };
    if (updates.retellApiKey) {
      updatesToApply.retellApiKey = encryptApiKey(updates.retellApiKey);
    }

    console.log(
      `[Storage] updateWidgetConfig - tenantId: ${tenantId}, retellAgentId: ${updatesToApply.retellAgentId || 'not in updates'}, whatsappAgentId: ${updatesToApply.whatsappAgentId || 'not in updates'}`,
    );

    const result = await this.db
      .update(widgetConfigs)
      .set({ ...updatesToApply, updatedAt: new Date() })
      .where(eq(widgetConfigs.tenantId, tenantId))
      .returning();

    const config = result[0];
    if (!config) return undefined;

    console.log(
      `[Storage] updateWidgetConfig - Saved to DB, retellAgentId: ${config.retellAgentId || 'null'}, whatsappAgentId: ${config.whatsappAgentId || 'null'}`,
    );

    // Decrypt the API key for immediate use
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error('Error decrypting Retell API key:', error);
        return config;
      }
    }

    return config;
  }

  // Tenant Retell Agents methods
  async getTenantAgents(tenantId: string): Promise<TenantRetellAgent[]> {
    return await this.db
      .select()
      .from(tenantRetellAgents)
      .where(eq(tenantRetellAgents.tenantId, tenantId))
      .orderBy(desc(tenantRetellAgents.createdAt));
  }

  async getTenantAgentsByChannel(tenantId: string, channel: string): Promise<TenantRetellAgent[]> {
    return await this.db
      .select()
      .from(tenantRetellAgents)
      .where(
        and(
          eq(tenantRetellAgents.tenantId, tenantId),
          eq(tenantRetellAgents.channel, channel),
          eq(tenantRetellAgents.isActive, true),
        ),
      );
  }

  async getTenantByAgentId(
    agentId: string,
  ): Promise<{ tenantId: string; agent: TenantRetellAgent } | undefined> {
    const result = await this.db
      .select()
      .from(tenantRetellAgents)
      .where(and(eq(tenantRetellAgents.agentId, agentId), eq(tenantRetellAgents.isActive, true)))
      .limit(1);

    if (!result[0]) return undefined;

    return {
      tenantId: result[0].tenantId,
      agent: result[0],
    };
  }

  async addTenantAgent(agent: InsertTenantRetellAgent): Promise<TenantRetellAgent> {
    const result = await this.db.insert(tenantRetellAgents).values(agent).returning();
    return result[0];
  }

  async updateTenantAgent(
    id: string,
    updates: Partial<InsertTenantRetellAgent>,
  ): Promise<TenantRetellAgent | undefined> {
    const result = await this.db
      .update(tenantRetellAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantRetellAgents.id, id))
      .returning();
    return result[0];
  }

  async removeTenantAgent(tenantId: string, agentId: string): Promise<void> {
    await this.db
      .delete(tenantRetellAgents)
      .where(
        and(eq(tenantRetellAgents.tenantId, tenantId), eq(tenantRetellAgents.agentId, agentId)),
      );
  }

  async clearTenantAgents(tenantId: string): Promise<void> {
    await this.db.delete(tenantRetellAgents).where(eq(tenantRetellAgents.tenantId, tenantId));
  }

  // Human Agent methods
  async getHumanAgent(id: string): Promise<HumanAgent | undefined> {
    const result = await this.db.select().from(humanAgents).where(eq(humanAgents.id, id));
    return result[0];
  }

  async getHumanAgentsByTenant(tenantId: string): Promise<HumanAgent[]> {
    return await this.db
      .select()
      .from(humanAgents)
      .where(eq(humanAgents.tenantId, tenantId))
      .orderBy(desc(humanAgents.createdAt));
  }

  async getAvailableHumanAgents(tenantId: string): Promise<HumanAgent[]> {
    const result = await this.db
      .select()
      .from(humanAgents)
      .where(
        and(
          eq(humanAgents.tenantId, tenantId),
          eq(humanAgents.status, 'available'),
          sql`${humanAgents.activeChats} < ${humanAgents.maxChats}`,
        ),
      )
      .orderBy(humanAgents.activeChats);
    return result;
  }

  async createHumanAgent(insertAgent: InsertHumanAgent, tenantId: string): Promise<HumanAgent> {
    const result = await this.db
      .insert(humanAgents)
      .values({
        ...insertAgent,
        tenantId,
      })
      .returning();
    return result[0];
  }

  async updateHumanAgent(
    id: string,
    updates: Partial<InsertHumanAgent>,
    tenantId: string,
  ): Promise<HumanAgent | undefined> {
    const result = await this.db
      .update(humanAgents)
      .set(updates)
      .where(and(eq(humanAgents.id, id), eq(humanAgents.tenantId, tenantId)))
      .returning();
    return result[0];
  }

  async updateHumanAgentStatus(id: string, status: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ status })
      .where(and(eq(humanAgents.id, id), eq(humanAgents.tenantId, tenantId)));
  }

  async updateAgentLastSeen(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ lastSeen: new Date() })
      .where(and(eq(humanAgents.id, id), eq(humanAgents.tenantId, tenantId)));
  }

  async incrementActiveChats(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ activeChats: sql`${humanAgents.activeChats} + 1` })
      .where(and(eq(humanAgents.id, id), eq(humanAgents.tenantId, tenantId)));
  }

  async decrementActiveChats(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ activeChats: sql`GREATEST(${humanAgents.activeChats} - 1, 0)` })
      .where(and(eq(humanAgents.id, id), eq(humanAgents.tenantId, tenantId)));
  }

  // Legacy Message and Conversation methods - REMOVED (see migration 0014)
  // Use widget handoff methods instead

  // Analytics methods - REMOVED (see migration 0013)

  // User Invitation methods
  async createUserInvitation(insertInvitation: InsertUserInvitation): Promise<UserInvitation> {
    const result = await this.db.insert(userInvitations).values(insertInvitation).returning();
    return result[0];
  }

  async getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined> {
    const result = await this.db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.email, email));
    return result[0];
  }

  async getPendingInvitationByEmail(email: string): Promise<UserInvitation | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.email, email),
          or(eq(userInvitations.status, 'pending'), eq(userInvitations.status, 'sent')),
          gt(userInvitations.expiresAt, now),
        ),
      );
    return result[0];
  }

  async getActiveInvitations(tenantId?: string): Promise<UserInvitation[]> {
    const now = new Date();

    if (tenantId) {
      return await this.db
        .select()
        .from(userInvitations)
        .where(
          and(
            sql`${userInvitations.status} != 'accepted'`,
            gt(userInvitations.expiresAt, now),
            eq(userInvitations.tenantId, tenantId),
          ),
        )
        .orderBy(desc(userInvitations.createdAt));
    } else {
      return await this.db
        .select()
        .from(userInvitations)
        .where(
          and(sql`${userInvitations.status} != 'accepted'`, gt(userInvitations.expiresAt, now)),
        )
        .orderBy(desc(userInvitations.createdAt));
    }
  }

  async getPendingInvitations(): Promise<UserInvitation[]> {
    const now = new Date();
    return await this.db
      .select()
      .from(userInvitations)
      .where(
        and(
          or(eq(userInvitations.status, 'pending'), eq(userInvitations.status, 'sent')),
          gt(userInvitations.expiresAt, now),
        ),
      )
      .orderBy(desc(userInvitations.createdAt));
  }

  async updateInvitationStatus(id: string, status: string, lastSentAt?: Date): Promise<void> {
    const updates: any = { status };
    if (lastSentAt) {
      updates.lastSentAt = lastSentAt;
    }
    await this.db.update(userInvitations).set(updates).where(eq(userInvitations.id, id));
  }

  async markInvitationAccepted(id: string, userId: string): Promise<void> {
    await this.db
      .update(userInvitations)
      .set({
        status: 'accepted',
        invitedUserId: userId,
        acceptedAt: new Date(),
        // SECURITY: Null out plaintext password immediately after acceptance
        plainTemporaryPassword: null,
      })
      .where(eq(userInvitations.id, id));
  }

  async clearInvitationPlainPassword(id: string): Promise<void> {
    await this.db
      .update(userInvitations)
      .set({ plainTemporaryPassword: null })
      .where(eq(userInvitations.id, id));
  }

  async markInvitationUsed(id: string): Promise<void> {
    // Legacy method - now marks invitation as accepted
    await this.db
      .update(userInvitations)
      .set({ status: 'accepted' })
      .where(eq(userInvitations.id, id));
  }

  async deleteInvitation(id: string): Promise<void> {
    await this.db.delete(userInvitations).where(eq(userInvitations.id, id));
  }

  async cleanupExpiredInvitationPasswords(): Promise<number> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Null out plaintext passwords for:
    // 1. Expired invitations (past expiresAt date)
    // 2. Accepted invitations (status === 'accepted')
    // 3. Invitations older than 7 days
    const result = await this.db
      .update(userInvitations)
      .set({ plainTemporaryPassword: null })
      .where(
        and(
          sql`${userInvitations.plainTemporaryPassword} IS NOT NULL`,
          or(
            sql`${userInvitations.expiresAt} < ${now}`,
            eq(userInvitations.status, 'accepted'),
            sql`${userInvitations.createdAt} < ${sevenDaysAgo}`,
          ),
        ),
      );

    // Return number of rows updated
    return result.rowCount || 0;
  }

  // Platform Admin methods
  async getAllUsers(): Promise<ClientUser[]> {
    return await this.db.select().from(clientUsers).orderBy(desc(clientUsers.createdAt));
  }

  async getPlatformAdmins(): Promise<ClientUser[]> {
    return await this.db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.isPlatformAdmin, true))
      .orderBy(desc(clientUsers.createdAt));
  }

  async updateUserRole(
    userId: string,
    role: string,
    isPlatformAdmin: boolean,
  ): Promise<ClientUser | undefined> {
    const result = await this.db
      .update(clientUsers)
      .set({ role, isPlatformAdmin })
      .where(eq(clientUsers.id, userId))
      .returning();
    return result[0];
  }

  // Password Reset Token methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await this.db.insert(passwordResetTokens).values(token).returning();
    return result[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );
    return result[0];
  }

  async getAllUnexpiredResetTokens(): Promise<PasswordResetToken[]> {
    const now = new Date();
    return await this.db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.used, false), gt(passwordResetTokens.expiresAt, now)));
  }

  async markTokenAsUsed(token: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async markTokenAsUsedById(id: string): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, id));
  }

  async cleanupExpiredResetTokens(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(passwordResetTokens)
      .where(
        or(eq(passwordResetTokens.used, true), sql`${passwordResetTokens.expiresAt} < ${now}`),
      );
    return result.rowCount || 0;
  }

  // ============================================
  // WIDGET HANDOFF METHODS
  // ============================================

  async createWidgetHandoff(handoff: InsertWidgetHandoff): Promise<WidgetHandoff> {
    const result = await this.db.insert(widgetHandoffs).values(handoff).returning();
    return result[0];
  }

  async getWidgetHandoff(id: string): Promise<WidgetHandoff | undefined> {
    const result = await this.db.select().from(widgetHandoffs).where(eq(widgetHandoffs.id, id));
    return result[0];
  }

  async getWidgetHandoffsByTenant(tenantId: string): Promise<WidgetHandoff[]> {
    return await this.db
      .select()
      .from(widgetHandoffs)
      .where(eq(widgetHandoffs.tenantId, tenantId))
      .orderBy(desc(widgetHandoffs.requestedAt));
  }

  async getPendingWidgetHandoffs(tenantId: string): Promise<WidgetHandoff[]> {
    return await this.db
      .select()
      .from(widgetHandoffs)
      .where(and(eq(widgetHandoffs.tenantId, tenantId), eq(widgetHandoffs.status, 'pending')))
      .orderBy(widgetHandoffs.requestedAt);
  }

  async getActiveWidgetHandoffs(tenantId: string): Promise<WidgetHandoff[]> {
    return await this.db
      .select()
      .from(widgetHandoffs)
      .where(and(eq(widgetHandoffs.tenantId, tenantId), eq(widgetHandoffs.status, 'active')))
      .orderBy(widgetHandoffs.pickedUpAt);
  }

  async updateWidgetHandoffStatus(
    id: string,
    status: string,
    updates?: Partial<InsertWidgetHandoff>,
  ): Promise<WidgetHandoff | undefined> {
    const updateData: any = { status, ...updates };

    if (status === 'active' && !updates?.pickedUpAt) {
      updateData.pickedUpAt = new Date();
    } else if (status === 'resolved' && !updates?.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    const result = await this.db
      .update(widgetHandoffs)
      .set(updateData)
      .where(eq(widgetHandoffs.id, id))
      .returning();

    return result[0];
  }

  async assignHandoffToAgent(
    handoffId: string,
    agentId: string,
    tenantId: string,
  ): Promise<WidgetHandoff | undefined> {
    const result = await this.db
      .update(widgetHandoffs)
      .set({
        assignedAgentId: agentId,
        status: 'active',
        pickedUpAt: new Date(),
      })
      .where(and(eq(widgetHandoffs.id, handoffId), eq(widgetHandoffs.tenantId, tenantId)))
      .returning();

    return result[0];
  }

  async createWidgetHandoffMessage(
    message: InsertWidgetHandoffMessage,
  ): Promise<WidgetHandoffMessage> {
    const result = await this.db.insert(widgetHandoffMessages).values(message).returning();
    return result[0];
  }

  async getWidgetHandoffMessages(handoffId: string): Promise<WidgetHandoffMessage[]> {
    return await this.db
      .select()
      .from(widgetHandoffMessages)
      .where(eq(widgetHandoffMessages.handoffId, handoffId))
      .orderBy(widgetHandoffMessages.timestamp);
  }

  async getWidgetHandoffMessagesSince(
    handoffId: string,
    sinceTimestamp: Date,
  ): Promise<WidgetHandoffMessage[]> {
    return await this.db
      .select()
      .from(widgetHandoffMessages)
      .where(
        and(
          eq(widgetHandoffMessages.handoffId, handoffId),
          gt(widgetHandoffMessages.timestamp, sinceTimestamp),
        ),
      )
      .orderBy(widgetHandoffMessages.timestamp);
  }

  // Conversation Messages (real-time messages from all channels: widget, WhatsApp, voice)
  async createWidgetChatMessage(message: InsertWidgetChatMessage): Promise<WidgetChatMessage> {
    const result = await this.db.insert(conversationMessages).values(message).returning();
    return result[0];
  }

  async getWidgetChatMessages(chatId: string): Promise<WidgetChatMessage[]> {
    return await this.db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.chatId, chatId))
      .orderBy(conversationMessages.timestamp);
  }

  // ============================================
  // TENANT INTEGRATIONS METHODS
  // ============================================

  /**
   * Get integration configuration for a tenant
   */
  async getTenantIntegration(tenantId: string): Promise<TenantIntegration | undefined> {
    const result = await this.db
      .select()
      .from(tenantIntegrations)
      .where(eq(tenantIntegrations.tenantId, tenantId));
    return result[0];
  }

  /**
   * Create integration configuration for a tenant
   */
  async createTenantIntegration(integration: InsertTenantIntegration): Promise<TenantIntegration> {
    const result = await this.db.insert(tenantIntegrations).values(integration).returning();
    return result[0];
  }

  /**
   * Update integration configuration for a tenant
   */
  async updateTenantIntegration(
    tenantId: string,
    updates: Partial<InsertTenantIntegration>,
  ): Promise<TenantIntegration | undefined> {
    const result = await this.db
      .update(tenantIntegrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantIntegrations.tenantId, tenantId))
      .returning();
    return result[0];
  }

  /**
   * Delete integration configuration for a tenant
   */
  async deleteTenantIntegration(tenantId: string): Promise<void> {
    await this.db.delete(tenantIntegrations).where(eq(tenantIntegrations.tenantId, tenantId));
  }

  // ============================================
  // N8N WEBHOOKS METHODS
  // ============================================

  /**
   * Get a specific webhook by ID
   */
  async getN8nWebhook(id: string): Promise<N8nWebhook | undefined> {
    const result = await this.db.select().from(n8nWebhooks).where(eq(n8nWebhooks.id, id));
    return result[0];
  }

  /**
   * Get all webhooks for a tenant
   */
  async getN8nWebhooksByTenant(tenantId: string): Promise<N8nWebhook[]> {
    return await this.db
      .select()
      .from(n8nWebhooks)
      .where(eq(n8nWebhooks.tenantId, tenantId))
      .orderBy(n8nWebhooks.workflowName);
  }

  /**
   * Get a specific webhook by tenant and workflow name
   */
  async getN8nWebhookByName(
    tenantId: string,
    workflowName: string,
  ): Promise<N8nWebhook | undefined> {
    const result = await this.db
      .select()
      .from(n8nWebhooks)
      .where(and(eq(n8nWebhooks.tenantId, tenantId), eq(n8nWebhooks.workflowName, workflowName)));
    return result[0];
  }

  /**
   * Get all active webhooks for a tenant
   */
  async getActiveN8nWebhooks(tenantId: string): Promise<N8nWebhook[]> {
    return await this.db
      .select()
      .from(n8nWebhooks)
      .where(and(eq(n8nWebhooks.tenantId, tenantId), eq(n8nWebhooks.isActive, true)))
      .orderBy(n8nWebhooks.workflowName);
  }

  /**
   * Create a new N8N webhook
   */
  async createN8nWebhook(webhook: InsertN8nWebhook): Promise<N8nWebhook> {
    const result = await this.db.insert(n8nWebhooks).values(webhook).returning();
    return result[0];
  }

  /**
   * Update an N8N webhook
   */
  async updateN8nWebhook(
    id: string,
    updates: Partial<InsertN8nWebhook>,
  ): Promise<N8nWebhook | undefined> {
    const result = await this.db
      .update(n8nWebhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(n8nWebhooks.id, id))
      .returning();
    return result[0];
  }

  /**
   * Increment webhook call counters
   */
  async incrementWebhookStats(id: string, success: boolean): Promise<void> {
    await this.db
      .update(n8nWebhooks)
      .set({
        totalCalls: sql`${n8nWebhooks.totalCalls} + 1`,
        successfulCalls: success ? sql`${n8nWebhooks.successfulCalls} + 1` : undefined,
        failedCalls: !success ? sql`${n8nWebhooks.failedCalls} + 1` : undefined,
        lastCalledAt: new Date(),
      })
      .where(eq(n8nWebhooks.id, id));
  }

  /**
   * Delete an N8N webhook
   */
  async deleteN8nWebhook(id: string, tenantId: string): Promise<void> {
    await this.db
      .delete(n8nWebhooks)
      .where(and(eq(n8nWebhooks.id, id), eq(n8nWebhooks.tenantId, tenantId)));
  }

  /**
   * Get webhook by function name (for function call routing)
   * Returns the active webhook configured to handle a specific function for a tenant
   */
  async getWebhookByFunction(
    tenantId: string,
    functionName: string,
  ): Promise<N8nWebhook | undefined> {
    const result = await this.db
      .select()
      .from(n8nWebhooks)
      .where(
        and(
          eq(n8nWebhooks.tenantId, tenantId),
          eq(n8nWebhooks.functionName, functionName),
          eq(n8nWebhooks.webhookType, 'function_call'),
          eq(n8nWebhooks.isActive, true),
        ),
      )
      .limit(1);
    return result[0];
  }

  /**
   * Get webhooks by event type (for event listener routing)
   * Returns all active webhooks that should be triggered by a specific event
   * Also includes webhooks with eventType='*' (all events)
   */
  async getWebhooksByEvent(tenantId: string, eventType: string): Promise<N8nWebhook[]> {
    return await this.db
      .select()
      .from(n8nWebhooks)
      .where(
        and(
          eq(n8nWebhooks.tenantId, tenantId),
          eq(n8nWebhooks.webhookType, 'event_listener'),
          eq(n8nWebhooks.isActive, true),
          or(eq(n8nWebhooks.eventType, eventType), eq(n8nWebhooks.eventType, '*')),
        ),
      )
      .orderBy(n8nWebhooks.workflowName);
  }

  // ============================================
  // WEBHOOK ANALYTICS METHODS
  // ============================================

  // Webhook Analytics methods - REMOVED (see migration 0013)

  // ============================================
  // CHAT ANALYTICS METHODS
  // ============================================

  /**
   * Create or update chat analytics (handles duplicate webhooks from Retell)
   */
  async createChatAnalytics(analytics: InsertChatAnalytics): Promise<ChatAnalytics> {
    // Use UPSERT to handle duplicate webhooks gracefully
    const [created] = await this.db
      .insert(chatAnalytics)
      .values(analytics)
      .onConflictDoUpdate({
        target: chatAnalytics.chatId,
        set: {
          // Update all fields except id and createdAt on duplicate
          agentName: analytics.agentName,
          agentVersion: analytics.agentVersion,
          chatType: analytics.chatType,
          chatStatus: analytics.chatStatus,
          startTimestamp: analytics.startTimestamp,
          endTimestamp: analytics.endTimestamp,
          duration: analytics.duration,
          messageCount: analytics.messageCount,
          toolCallsCount: analytics.toolCallsCount,
          dynamicVariables: analytics.dynamicVariables,
          userSentiment: analytics.userSentiment,
          chatSuccessful: analytics.chatSuccessful,
          combinedCost: analytics.combinedCost,
          productCosts: analytics.productCosts,
          metadata: analytics.metadata,
        },
      })
      .returning();
    return created!;
  }

  /**
   * Get chat analytics by ID
   */
  async getChatAnalytics(id: string): Promise<ChatAnalytics | undefined> {
    const [result] = await this.db
      .select()
      .from(chatAnalytics)
      .where(eq(chatAnalytics.id, id))
      .limit(1);
    return result;
  }

  /**
   * Get chat analytics by Retell chat ID
   */
  async getChatAnalyticsByChatId(chatId: string): Promise<ChatAnalytics | undefined> {
    const [result] = await this.db
      .select()
      .from(chatAnalytics)
      .where(eq(chatAnalytics.chatId, chatId))
      .limit(1);
    return result;
  }

  /**
   * Get chat analytics for a tenant with filters
   */
  async getChatAnalyticsByTenant(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      sentiment?: string;
      chatStatus?: string;
      limit?: number;
    },
  ): Promise<ChatAnalytics[]> {
    const conditions = [eq(chatAnalytics.tenantId, tenantId)];

    // Get widget config to filter only current/active agents
    const widgetConfig = await this.db
      .select()
      .from(widgetConfigs)
      .where(eq(widgetConfigs.tenantId, tenantId))
      .limit(1);

    const config = widgetConfig[0];
    const currentAgentIds: string[] = [];
    if (config?.retellAgentId) currentAgentIds.push(config.retellAgentId);
    if (config?.whatsappAgentId) currentAgentIds.push(config.whatsappAgentId);

    // Only show chats from active agents
    if (currentAgentIds.length > 0) {
      conditions.push(or(...currentAgentIds.map((agentId) => eq(chatAnalytics.agentId, agentId)))!);
    }

    if (filters?.startDate) {
      conditions.push(gte(chatAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      // Include records where endTimestamp is within range OR is NULL (chat still in progress)
      conditions.push(
        or(lte(chatAnalytics.endTimestamp, filters.endDate), isNull(chatAnalytics.endTimestamp))!,
      );
    }
    if (filters?.agentId) {
      conditions.push(eq(chatAnalytics.agentId, filters.agentId));
    }
    if (filters?.sentiment) {
      conditions.push(eq(chatAnalytics.userSentiment, filters.sentiment));
    }
    if (filters?.chatStatus) {
      conditions.push(eq(chatAnalytics.chatStatus, filters.chatStatus));
    }

    let query = this.db
      .select()
      .from(chatAnalytics)
      .where(and(...conditions))
      .orderBy(desc(chatAnalytics.startTimestamp));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
  }

  /**
   * Get chat analytics summary for a tenant
   */
  async getChatAnalyticsSummary(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
    },
  ): Promise<{
    totalChats: number;
    successfulChats: number;
    totalDuration: number;
    averageDuration: number;
    totalCost: number;
    averageCost: number;
    sentimentBreakdown: Record<string, number>;
  }> {
    const conditions = [eq(chatAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(chatAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      // Include records where endTimestamp is within range OR is NULL (chat still in progress)
      conditions.push(
        or(lte(chatAnalytics.endTimestamp, filters.endDate), isNull(chatAnalytics.endTimestamp))!,
      );
    }
    if (filters?.agentId) {
      conditions.push(eq(chatAnalytics.agentId, filters.agentId));
    }

    const chats = await this.db
      .select()
      .from(chatAnalytics)
      .where(and(...conditions));

    const totalChats = chats.length;
    const successfulChats = chats.filter((c) => c.chatSuccessful).length;
    const totalDuration = chats.reduce((sum, c) => sum + (c.duration || 0), 0);
    const averageDuration = totalChats > 0 ? totalDuration / totalChats : 0;
    const totalCost = chats.reduce((sum, c) => sum + (c.combinedCost || 0), 0);
    const averageCost = totalChats > 0 ? totalCost / totalChats : 0;

    // Sentiment breakdown
    const sentimentBreakdown: Record<string, number> = {};
    chats.forEach((chat) => {
      const sentiment = chat.userSentiment?.toLowerCase() || 'unknown';
      sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] || 0) + 1;
    });

    return {
      totalChats,
      successfulChats,
      totalDuration,
      averageDuration,
      totalCost,
      averageCost,
      sentimentBreakdown,
    };
  }

  /**
   * Get detailed time-series chat analytics for visualization
   */
  async getChatAnalyticsTimeSeries(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      groupBy?: 'hour' | 'day' | 'week';
    },
  ): Promise<{
    chatCounts: { date: string; count: number; successful: number; unsuccessful: number }[];
    durationData: { date: string; averageDuration: number; totalDuration: number }[];
    sentimentData: {
      date: string;
      positive: number;
      neutral: number;
      negative: number;
      unknown: number;
    }[];
    costData: { date: string; totalCost: number; averageCost: number }[];
    statusBreakdown: Record<string, number>;
    messageCountStats: { average: number; min: number; max: number; total: number };
    toolCallsStats: { average: number; total: number };
  }> {
    const conditions = [eq(chatAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(chatAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(
        or(lte(chatAnalytics.endTimestamp, filters.endDate), isNull(chatAnalytics.endTimestamp))!,
      );
    }
    if (filters?.agentId) {
      conditions.push(eq(chatAnalytics.agentId, filters.agentId));
    }

    const chats = await this.db
      .select()
      .from(chatAnalytics)
      .where(and(...conditions))
      .orderBy(chatAnalytics.startTimestamp);

    // Group by date
    const groupBy = filters?.groupBy || 'day';
    const getDateKey = (date: Date | null): string => {
      if (!date) return 'Unknown';
      const d = new Date(date);
      if (groupBy === 'hour') {
        return d.toISOString().slice(0, 13) + ':00:00';
      } else if (groupBy === 'week') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        return startOfWeek.toISOString().slice(0, 10);
      }
      return d.toISOString().slice(0, 10); // day
    };

    // Initialize data structures
    const chatCountMap = new Map<
      string,
      { count: number; successful: number; unsuccessful: number }
    >();
    const durationMap = new Map<string, { durations: number[]; total: number }>();
    const sentimentMap = new Map<
      string,
      { positive: number; neutral: number; negative: number; unknown: number }
    >();
    const costMap = new Map<string, { costs: number[]; total: number }>();
    const statusBreakdown: Record<string, number> = {};
    const messageCounts: number[] = [];
    let totalToolCalls = 0;

    // Process each chat
    chats.forEach((chat) => {
      const dateKey = getDateKey(chat.startTimestamp);

      // Chat counts
      if (!chatCountMap.has(dateKey)) {
        chatCountMap.set(dateKey, { count: 0, successful: 0, unsuccessful: 0 });
      }
      const countData = chatCountMap.get(dateKey)!;
      countData.count++;
      if (chat.chatSuccessful) {
        countData.successful++;
      } else {
        countData.unsuccessful++;
      }

      // Duration data
      if (chat.duration && chat.duration > 0) {
        if (!durationMap.has(dateKey)) {
          durationMap.set(dateKey, { durations: [], total: 0 });
        }
        const durData = durationMap.get(dateKey)!;
        durData.durations.push(chat.duration);
        durData.total += chat.duration;
      }

      // Sentiment data
      if (!sentimentMap.has(dateKey)) {
        sentimentMap.set(dateKey, { positive: 0, neutral: 0, negative: 0, unknown: 0 });
      }
      const sentData = sentimentMap.get(dateKey)!;
      const sentiment = (chat.userSentiment?.toLowerCase() || 'unknown') as
        | 'positive'
        | 'neutral'
        | 'negative'
        | 'unknown';
      if (sentiment in sentData) {
        sentData[sentiment]++;
      }

      // Cost data
      if (chat.combinedCost && chat.combinedCost > 0) {
        if (!costMap.has(dateKey)) {
          costMap.set(dateKey, { costs: [], total: 0 });
        }
        const costData = costMap.get(dateKey)!;
        costData.costs.push(chat.combinedCost);
        costData.total += chat.combinedCost;
      }

      // Status breakdown
      const status = chat.chatStatus || 'unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

      // Message counts
      if (chat.messageCount) {
        messageCounts.push(chat.messageCount);
      }

      // Tool calls
      if (chat.toolCallsCount) {
        totalToolCalls += chat.toolCallsCount;
      }
    });

    // Convert maps to arrays
    const chatCounts = Array.from(chatCountMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const durationData = Array.from(durationMap.entries())
      .map(([date, data]) => ({
        date,
        averageDuration: data.durations.length > 0 ? data.total / data.durations.length : 0,
        totalDuration: data.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sentimentData = Array.from(sentimentMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const costData = Array.from(costMap.entries())
      .map(([date, data]) => ({
        date,
        totalCost: data.total,
        averageCost: data.costs.length > 0 ? data.total / data.costs.length : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Message count stats
    const messageCountStats = {
      average:
        messageCounts.length > 0
          ? messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length
          : 0,
      min: messageCounts.length > 0 ? Math.min(...messageCounts) : 0,
      max: messageCounts.length > 0 ? Math.max(...messageCounts) : 0,
      total: messageCounts.reduce((a, b) => a + b, 0),
    };

    // Tool calls stats
    const toolCallsStats = {
      average: chats.length > 0 ? totalToolCalls / chats.length : 0,
      total: totalToolCalls,
    };

    return {
      chatCounts,
      durationData,
      sentimentData,
      costData,
      statusBreakdown,
      messageCountStats,
      toolCallsStats,
    };
  }

  /**
   * Get chat analytics agent breakdown
   */
  async getChatAnalyticsAgentBreakdown(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<
    {
      agentId: string;
      agentName: string;
      count: number;
      totalChats: number;
      successfulChats: number;
      successRate: number;
      totalDuration: number;
      averageDuration: number;
      totalCost: number;
      averageCost: number;
      sentimentBreakdown: Record<string, number>;
    }[]
  > {
    const conditions = [eq(chatAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(chatAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(
        or(lte(chatAnalytics.endTimestamp, filters.endDate), isNull(chatAnalytics.endTimestamp))!,
      );
    }

    const chats = await this.db
      .select()
      .from(chatAnalytics)
      .where(and(...conditions));

    // Get tenant info and widget config to determine current agents
    const [tenantInfo, widgetConfig] = await Promise.all([
      this.db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1),
      this.db.select().from(widgetConfigs).where(eq(widgetConfigs.tenantId, tenantId)).limit(1),
    ]);

    const tenant = tenantInfo[0];
    const config = widgetConfig[0];

    // Build set of current agent IDs (agents that are currently configured)
    const currentAgentIds = new Set<string>();
    if (config?.retellAgentId) currentAgentIds.add(config.retellAgentId);
    if (config?.whatsappAgentId) currentAgentIds.add(config.whatsappAgentId);

    console.log('[Agent Breakdown] Current agents:', Array.from(currentAgentIds));
    console.log('[Agent Breakdown] Total chats in period:', chats.length);

    // Group by agent and calculate metrics
    const agentMap = new Map<
      string,
      {
        agentName: string;
        totalChats: number;
        successfulChats: number;
        totalDuration: number;
        totalCost: number;
        sentimentCounts: Record<string, number>;
        isCurrentAgent: boolean;
      }
    >();

    chats.forEach((chat) => {
      const agentId = chat.agentId;
      const isCurrentAgent = currentAgentIds.has(agentId);

      // Skip deleted agents - only process current agents
      if (!isCurrentAgent) {
        return;
      }

      // Create a friendly agent name
      let agentName: string;
      if (chat.agentName && !chat.agentName.startsWith('agent_')) {
        // Use existing name if it's not a raw agent ID
        agentName = chat.agentName;
      } else if (config?.retellAgentId === agentId) {
        // Chat agent - use tenant name
        agentName = `${tenant?.name || 'Chat'} Agent`;
      } else if (config?.whatsappAgentId === agentId) {
        // WhatsApp agent - use tenant name
        agentName = `${tenant?.name || 'WhatsApp'} Agent (WhatsApp)`;
      } else {
        // Fallback (shouldn't reach here due to isCurrentAgent check)
        agentName = agentId;
      }

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agentName,
          totalChats: 0,
          successfulChats: 0,
          totalDuration: 0,
          totalCost: 0,
          sentimentCounts: {},
          isCurrentAgent,
        });
      }

      const agentData = agentMap.get(agentId)!;
      agentData.totalChats++;

      if (chat.chatSuccessful) {
        agentData.successfulChats++;
      }

      if (chat.duration) {
        agentData.totalDuration += chat.duration;
      }

      if (chat.combinedCost) {
        agentData.totalCost += chat.combinedCost;
      }

      const sentiment = chat.userSentiment || 'unknown';
      agentData.sentimentCounts[sentiment] = (agentData.sentimentCounts[sentiment] || 0) + 1;
    });

    // Convert to array with calculated averages and sort by chat count descending
    const result = Array.from(agentMap.entries())
      .map(([agentId, data]) => ({
        agentId,
        agentName: data.agentName,
        count: data.totalChats, // Map totalChats to count for frontend compatibility
        totalChats: data.totalChats,
        successfulChats: data.successfulChats,
        successRate: data.totalChats > 0 ? (data.successfulChats / data.totalChats) * 100 : 0,
        totalDuration: data.totalDuration,
        averageDuration: data.totalChats > 0 ? data.totalDuration / data.totalChats : 0,
        totalCost: data.totalCost,
        averageCost: data.totalChats > 0 ? data.totalCost / data.totalChats : 0,
        sentimentBreakdown: data.sentimentCounts,
      }))
      .sort((a, b) => b.totalChats - a.totalChats);

    console.log(
      '[Agent Breakdown] Returning agents:',
      result.map((r) => ({ name: r.agentName, count: r.count })),
    );

    return result;
  }

  /**
   * Delete old chat analytics (for cleanup/archiving)
   */
  async deleteOldChatAnalytics(olderThanDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await this.db.delete(chatAnalytics).where(lte(chatAnalytics.createdAt, cutoffDate));
  }

  // ============================================
  // VOICE ANALYTICS METHODS (mirrors chat analytics)
  // ============================================

  /**
   * Create a new voice analytics record
   */
  async createVoiceAnalytics(analytics: InsertVoiceAnalytics): Promise<VoiceAnalytics> {
    // Use UPSERT to handle duplicate webhooks gracefully
    const [created] = await this.db
      .insert(voiceAnalytics)
      .values(analytics)
      .onConflictDoUpdate({
        target: voiceAnalytics.callId,
        set: {
          // Update all fields except id and createdAt on duplicate
          agentName: analytics.agentName,
          agentVersion: analytics.agentVersion,
          callType: analytics.callType,
          callStatus: analytics.callStatus,
          startTimestamp: analytics.startTimestamp,
          endTimestamp: analytics.endTimestamp,
          duration: analytics.duration,
          messageCount: analytics.messageCount,
          toolCallsCount: analytics.toolCallsCount,
          dynamicVariables: analytics.dynamicVariables,
          userSentiment: analytics.userSentiment,
          callSuccessful: analytics.callSuccessful,
          combinedCost: analytics.combinedCost,
          productCosts: analytics.productCosts,
          metadata: analytics.metadata,
        },
      })
      .returning();
    return created!;
  }

  /**
   * Get voice analytics by ID
   */
  async getVoiceAnalytics(id: string): Promise<VoiceAnalytics | undefined> {
    const result = await this.db.select().from(voiceAnalytics).where(eq(voiceAnalytics.id, id));
    return result[0];
  }

  /**
   * Get voice analytics by call ID
   */
  async getVoiceAnalyticsByCallId(callId: string): Promise<VoiceAnalytics | undefined> {
    const result = await this.db
      .select()
      .from(voiceAnalytics)
      .where(eq(voiceAnalytics.callId, callId));
    return result[0];
  }

  /**
   * Get voice analytics for a tenant with optional filters
   */
  async getVoiceAnalyticsByTenant(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      sentiment?: string;
      callStatus?: string;
      limit?: number;
    },
  ): Promise<VoiceAnalytics[]> {
    const conditions = [eq(voiceAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(voiceAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(
        or(lte(voiceAnalytics.endTimestamp, filters.endDate), isNull(voiceAnalytics.endTimestamp))!,
      );
    }
    if (filters?.agentId) {
      conditions.push(eq(voiceAnalytics.agentId, filters.agentId));
    }
    if (filters?.sentiment) {
      conditions.push(eq(voiceAnalytics.userSentiment, filters.sentiment));
    }
    if (filters?.callStatus) {
      conditions.push(eq(voiceAnalytics.callStatus, filters.callStatus));
    }

    const baseQuery = this.db
      .select()
      .from(voiceAnalytics)
      .where(and(...conditions))
      .orderBy(desc(voiceAnalytics.startTimestamp));

    if (filters?.limit) {
      return await baseQuery.limit(filters.limit);
    }

    return await baseQuery;
  }

  /**
   * Get voice analytics summary for a tenant
   */
  async getVoiceAnalyticsSummary(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
    },
  ): Promise<{
    totalCalls: number;
    successfulCalls: number;
    totalDuration: number;
    averageDuration: number;
    totalCost: number;
    averageCost: number;
    sentimentBreakdown: Record<string, number>;
  }> {
    const conditions = [eq(voiceAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(voiceAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(
        or(lte(voiceAnalytics.endTimestamp, filters.endDate), isNull(voiceAnalytics.endTimestamp))!,
      );
    }
    if (filters?.agentId) {
      conditions.push(eq(voiceAnalytics.agentId, filters.agentId));
    }

    const calls = await this.db
      .select()
      .from(voiceAnalytics)
      .where(and(...conditions));

    const totalCalls = calls.length;
    const successfulCalls = calls.filter((c) => c.callSuccessful).length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);
    const averageDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const totalCost = calls.reduce((sum, c) => sum + (c.combinedCost || 0), 0);
    const averageCost = totalCalls > 0 ? totalCost / totalCalls : 0;

    // Sentiment breakdown
    const sentimentBreakdown: Record<string, number> = {};
    calls.forEach((call) => {
      const sentiment = call.userSentiment?.toLowerCase() || 'unknown';
      sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] || 0) + 1;
    });

    return {
      totalCalls,
      successfulCalls,
      totalDuration,
      averageDuration,
      totalCost,
      averageCost,
      sentimentBreakdown,
    };
  }

  /**
   * Get voice analytics time series data
   */
  async getVoiceAnalyticsTimeSeries(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      agentId?: string;
      groupBy?: 'hour' | 'day' | 'week';
    },
  ): Promise<{
    callCounts: { date: string; count: number; successful: number; unsuccessful: number }[];
    durationData: { date: string; averageDuration: number; totalDuration: number }[];
    sentimentData: {
      date: string;
      positive: number;
      neutral: number;
      negative: number;
      unknown: number;
    }[];
    costData: { date: string; totalCost: number; averageCost: number }[];
    statusBreakdown: Record<string, number>;
  }> {
    const conditions = [eq(voiceAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(voiceAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(
        or(lte(voiceAnalytics.endTimestamp, filters.endDate), isNull(voiceAnalytics.endTimestamp))!,
      );
    }
    if (filters?.agentId) {
      conditions.push(eq(voiceAnalytics.agentId, filters.agentId));
    }

    const calls = await this.db
      .select()
      .from(voiceAnalytics)
      .where(and(...conditions))
      .orderBy(voiceAnalytics.startTimestamp);

    // Group by date
    const groupBy = filters?.groupBy || 'day';
    const getDateKey = (date: Date | null): string => {
      if (!date) return 'Unknown';
      const d = new Date(date);
      if (groupBy === 'hour') {
        return d.toISOString().slice(0, 13) + ':00:00';
      } else if (groupBy === 'week') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        return startOfWeek.toISOString().slice(0, 10);
      }
      return d.toISOString().slice(0, 10); // day
    };

    // Initialize data structures
    const callCountMap = new Map<
      string,
      { count: number; successful: number; unsuccessful: number }
    >();
    const durationMap = new Map<string, { durations: number[]; total: number }>();
    const sentimentMap = new Map<
      string,
      { positive: number; neutral: number; negative: number; unknown: number }
    >();
    const costMap = new Map<string, { costs: number[]; total: number }>();
    const statusBreakdown: Record<string, number> = {};

    // Process each call
    calls.forEach((call) => {
      const dateKey = getDateKey(call.startTimestamp);

      // Call counts
      if (!callCountMap.has(dateKey)) {
        callCountMap.set(dateKey, { count: 0, successful: 0, unsuccessful: 0 });
      }
      const countData = callCountMap.get(dateKey)!;
      countData.count++;
      if (call.callSuccessful) {
        countData.successful++;
      } else {
        countData.unsuccessful++;
      }

      // Duration data
      if (call.duration && call.duration > 0) {
        if (!durationMap.has(dateKey)) {
          durationMap.set(dateKey, { durations: [], total: 0 });
        }
        const durData = durationMap.get(dateKey)!;
        durData.durations.push(call.duration);
        durData.total += call.duration;
      }

      // Sentiment data
      if (!sentimentMap.has(dateKey)) {
        sentimentMap.set(dateKey, { positive: 0, neutral: 0, negative: 0, unknown: 0 });
      }
      const sentData = sentimentMap.get(dateKey)!;
      const sentiment = (call.userSentiment?.toLowerCase() || 'unknown') as
        | 'positive'
        | 'neutral'
        | 'negative'
        | 'unknown';
      if (sentiment in sentData) {
        sentData[sentiment]++;
      }

      // Cost data
      if (call.combinedCost && call.combinedCost > 0) {
        if (!costMap.has(dateKey)) {
          costMap.set(dateKey, { costs: [], total: 0 });
        }
        const costData = costMap.get(dateKey)!;
        costData.costs.push(call.combinedCost);
        costData.total += call.combinedCost;
      }

      // Status breakdown
      const status = call.callStatus || 'unknown';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    });

    // Convert maps to arrays
    const callCounts = Array.from(callCountMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const durationData = Array.from(durationMap.entries())
      .map(([date, data]) => ({
        date,
        averageDuration: data.durations.length > 0 ? data.total / data.durations.length : 0,
        totalDuration: data.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sentimentData = Array.from(sentimentMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const costData = Array.from(costMap.entries())
      .map(([date, data]) => ({
        date,
        totalCost: data.total,
        averageCost: data.costs.length > 0 ? data.total / data.costs.length : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      callCounts,
      durationData,
      sentimentData,
      costData,
      statusBreakdown,
    };
  }

  /**
   * Get voice analytics agent breakdown
   */
  async getVoiceAnalyticsAgentBreakdown(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<
    {
      agentId: string;
      agentName: string;
      count: number;
      totalCalls: number;
      successfulCalls: number;
      successRate: number;
      totalDuration: number;
      averageDuration: number;
      totalCost: number;
      averageCost: number;
      sentimentBreakdown: Record<string, number>;
    }[]
  > {
    const conditions = [eq(voiceAnalytics.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(voiceAnalytics.startTimestamp, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(
        or(lte(voiceAnalytics.endTimestamp, filters.endDate), isNull(voiceAnalytics.endTimestamp))!,
      );
    }

    const calls = await this.db
      .select()
      .from(voiceAnalytics)
      .where(and(...conditions));

    // Group by agent
    const agentMap = new Map<
      string,
      {
        agentId: string;
        agentName: string;
        totalCalls: number;
        successfulCalls: number;
        totalDuration: number;
        totalCost: number;
        sentiments: string[];
      }
    >();

    calls.forEach((call) => {
      const agentId = call.agentId || 'unknown';
      const agentName = call.agentName || 'Unknown Agent';

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agentId,
          agentName,
          totalCalls: 0,
          successfulCalls: 0,
          totalDuration: 0,
          totalCost: 0,
          sentiments: [],
        });
      }

      const agent = agentMap.get(agentId)!;
      agent.totalCalls++;
      if (call.callSuccessful) {
        agent.successfulCalls++;
      }
      if (call.duration) {
        agent.totalDuration += call.duration;
      }
      if (call.combinedCost) {
        agent.totalCost += call.combinedCost;
      }
      if (call.userSentiment) {
        agent.sentiments.push(call.userSentiment.toLowerCase());
      }
    });

    // Convert to array and calculate derived metrics
    return Array.from(agentMap.values()).map((agent) => {
      const sentimentBreakdown: Record<string, number> = {};
      agent.sentiments.forEach((sentiment) => {
        sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] || 0) + 1;
      });

      return {
        agentId: agent.agentId,
        agentName: agent.agentName,
        count: agent.totalCalls,
        totalCalls: agent.totalCalls,
        successfulCalls: agent.successfulCalls,
        successRate: agent.totalCalls > 0 ? (agent.successfulCalls / agent.totalCalls) * 100 : 0,
        totalDuration: agent.totalDuration,
        averageDuration: agent.totalCalls > 0 ? agent.totalDuration / agent.totalCalls : 0,
        totalCost: agent.totalCost,
        averageCost: agent.totalCalls > 0 ? agent.totalCost / agent.totalCalls : 0,
        sentimentBreakdown,
      };
    });
  }

  /**
   * Delete old voice analytics (for cleanup/archiving)
   */
  async deleteOldVoiceAnalytics(olderThanDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await this.db.delete(voiceAnalytics).where(lte(voiceAnalytics.createdAt, cutoffDate));
  }

  // ============================================
  // RETELL TRANSCRIPT MESSAGES METHODS - REMOVED
  // ============================================
  // These methods were removed because retell_transcript_messages table was dropped in migration 0015
  // Messages are stored in widget_chat_history instead
  //
  // If you need message data, use:
  // - getWidgetChatMessages(chatId) for real-time conversation messages

  // ============================================
  // EXTERNAL API CONFIGURATIONS METHODS
  // ============================================

  /**
   * Get external API configuration by tenant and service name
   */
  async getExternalApiConfig(
    tenantId: string,
    serviceName: string,
  ): Promise<ExternalApiConfig | undefined> {
    const [config] = await this.db
      .select()
      .from(externalApiConfigs)
      .where(
        and(
          eq(externalApiConfigs.tenantId, tenantId),
          eq(externalApiConfigs.serviceName, serviceName),
        ),
      )
      .limit(1);
    return config;
  }

  /**
   * List all external API configurations for a tenant
   */
  async listExternalApiConfigs(tenantId: string): Promise<ExternalApiConfig[]> {
    return await this.db
      .select()
      .from(externalApiConfigs)
      .where(eq(externalApiConfigs.tenantId, tenantId))
      .orderBy(desc(externalApiConfigs.createdAt));
  }

  /**
   * Create a new external API configuration
   * Note: encryptedCredentials should already be encrypted before calling
   */
  async createExternalApiConfig(config: InsertExternalApiConfig): Promise<ExternalApiConfig> {
    const [created] = await this.db.insert(externalApiConfigs).values(config).returning();
    return created!;
  }

  /**
   * Update external API configuration
   */
  async updateExternalApiConfig(
    id: string,
    updates: Partial<InsertExternalApiConfig>,
  ): Promise<ExternalApiConfig | undefined> {
    const [updated] = await this.db
      .update(externalApiConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(externalApiConfigs.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete external API configuration
   */
  async deleteExternalApiConfig(id: string): Promise<void> {
    await this.db.delete(externalApiConfigs).where(eq(externalApiConfigs.id, id));
  }

  /**
   * Mark external API configuration as recently used
   */
  async markExternalApiConfigUsed(id: string): Promise<void> {
    await this.db
      .update(externalApiConfigs)
      .set({ lastUsedAt: new Date() })
      .where(eq(externalApiConfigs.id, id));
  }

  /**
   * Increment usage statistics for external API configuration
   */
  async incrementExternalApiStats(id: string, success: boolean): Promise<void> {
    const config = await this.db
      .select()
      .from(externalApiConfigs)
      .where(eq(externalApiConfigs.id, id))
      .limit(1);

    if (config[0]) {
      await this.db
        .update(externalApiConfigs)
        .set({
          totalCalls: config[0].totalCalls + 1,
          successfulCalls: success ? config[0].successfulCalls + 1 : config[0].successfulCalls,
          failedCalls: success ? config[0].failedCalls : config[0].failedCalls + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(externalApiConfigs.id, id));
    }
  }

  // ============================================
  // TENANT BUSINESS METHODS
  // ============================================

  /**
   * Get tenant business by ID
   */
  async getTenantBusiness(id: string): Promise<TenantBusiness | undefined> {
    const [business] = await this.db
      .select()
      .from(tenantBusinesses)
      .where(eq(tenantBusinesses.id, id))
      .limit(1);
    return business;
  }

  /**
   * Get tenant business by service name
   */
  async getTenantBusinessByService(
    tenantId: string,
    serviceName: string,
  ): Promise<TenantBusiness | undefined> {
    const [business] = await this.db
      .select()
      .from(tenantBusinesses)
      .where(
        and(eq(tenantBusinesses.tenantId, tenantId), eq(tenantBusinesses.serviceName, serviceName)),
      )
      .limit(1);
    return business;
  }

  /**
   * Get all businesses for a tenant
   */
  async getTenantBusinessesByTenant(tenantId: string): Promise<TenantBusiness[]> {
    return await this.db
      .select()
      .from(tenantBusinesses)
      .where(eq(tenantBusinesses.tenantId, tenantId))
      .orderBy(tenantBusinesses.createdAt);
  }

  /**
   * Create a new tenant business
   */
  async createTenantBusiness(business: InsertTenantBusiness): Promise<TenantBusiness> {
    const [created] = await this.db.insert(tenantBusinesses).values(business).returning();
    return created!;
  }

  /**
   * Update tenant business
   */
  async updateTenantBusiness(
    id: string,
    updates: Partial<InsertTenantBusiness>,
  ): Promise<TenantBusiness | undefined> {
    const [updated] = await this.db
      .update(tenantBusinesses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantBusinesses.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete tenant business (cascades to branches)
   */
  async deleteTenantBusiness(id: string): Promise<void> {
    await this.db.delete(tenantBusinesses).where(eq(tenantBusinesses.id, id));
  }

  // ============================================
  // TENANT BRANCH METHODS
  // ============================================

  /**
   * Get tenant branch by ID
   */
  async getTenantBranch(id: string): Promise<TenantBranch | undefined> {
    const [branch] = await this.db
      .select()
      .from(tenantBranches)
      .where(eq(tenantBranches.id, id))
      .limit(1);
    return branch;
  }

  /**
   * Get tenant branch by branch ID
   */
  async getTenantBranchByBranchId(
    businessId: string,
    branchId: string,
  ): Promise<TenantBranch | undefined> {
    const [branch] = await this.db
      .select()
      .from(tenantBranches)
      .where(and(eq(tenantBranches.businessId, businessId), eq(tenantBranches.branchId, branchId)))
      .limit(1);
    return branch;
  }

  /**
   * Get all branches for a business
   */
  async getTenantBranchesByBusiness(businessId: string): Promise<TenantBranch[]> {
    return await this.db
      .select()
      .from(tenantBranches)
      .where(eq(tenantBranches.businessId, businessId))
      .orderBy(desc(tenantBranches.isPrimary), tenantBranches.createdAt);
  }

  /**
   * Get primary branch for a business
   */
  async getPrimaryBranch(businessId: string): Promise<TenantBranch | undefined> {
    const [branch] = await this.db
      .select()
      .from(tenantBranches)
      .where(and(eq(tenantBranches.businessId, businessId), eq(tenantBranches.isPrimary, true)))
      .limit(1);
    return branch;
  }

  /**
   * Create a new tenant branch
   */
  async createTenantBranch(branch: InsertTenantBranch): Promise<TenantBranch> {
    const [created] = await this.db.insert(tenantBranches).values(branch).returning();
    return created!;
  }

  /**
   * Update tenant branch
   */
  async updateTenantBranch(
    id: string,
    updates: Partial<InsertTenantBranch>,
  ): Promise<TenantBranch | undefined> {
    const [updated] = await this.db
      .update(tenantBranches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantBranches.id, id))
      .returning();
    return updated;
  }

  /**
   * Set a branch as primary (unsets other primary branches for the same business)
   */
  async setPrimaryBranch(businessId: string, branchId: string): Promise<void> {
    // First, unset all primary branches for this business
    await this.db
      .update(tenantBranches)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(tenantBranches.businessId, businessId));

    // Then, set the specified branch as primary
    await this.db
      .update(tenantBranches)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(and(eq(tenantBranches.businessId, businessId), eq(tenantBranches.branchId, branchId)));
  }

  /**
   * Delete tenant branch
   */
  async deleteTenantBranch(id: string): Promise<void> {
    await this.db.delete(tenantBranches).where(eq(tenantBranches.id, id));
  }

  // ============================================
  // CLIENT METHODS
  // ============================================

  /**
   * Get client by ID
   */
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await this.db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return client;
  }

  /**
   * Get client by phone number (within tenant)
   */
  async getClientByPhone(tenantId: string, phone: string): Promise<Client | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.phone, phone)))
      .limit(1);
    return client;
  }

  /**
   * Get client by external service client ID
   */
  async getClientByExternalId(
    tenantId: string,
    serviceName: string,
    externalClientId: string,
  ): Promise<Client | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.tenantId, tenantId),
          eq(clients.externalServiceName, serviceName),
          eq(clients.externalServiceClientId, externalClientId),
        ),
      )
      .limit(1);
    return client;
  }

  /**
   * Get all clients for a tenant with optional filters
   */
  async getClientsByTenant(
    tenantId: string,
    filters?: {
      status?: string;
      source?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Client[]> {
    const conditions = [eq(clients.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(clients.status, filters.status));
    }
    if (filters?.source) {
      conditions.push(eq(clients.firstInteractionSource, filters.source));
    }

    let query = this.db
      .select()
      .from(clients)
      .where(and(...conditions))
      .orderBy(desc(clients.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  /**
   * Get client statistics for a tenant
   */
  async getClientStats(tenantId: string): Promise<{
    totalClients: number;
    activeClients: number;
    newThisMonth: number;
    bySource: Record<string, number>;
  }> {
    // Get total and active clients
    const allClients = await this.db.select().from(clients).where(eq(clients.tenantId, tenantId));

    const activeClients = allClients.filter((c) => c.status === 'active');

    // Get clients created this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = allClients.filter((c) => c.createdAt >= firstDayOfMonth);

    // Group by source
    const bySource: Record<string, number> = {};
    for (const client of allClients) {
      bySource[client.firstInteractionSource] = (bySource[client.firstInteractionSource] || 0) + 1;
    }

    return {
      totalClients: allClients.length,
      activeClients: activeClients.length,
      newThisMonth: newThisMonth.length,
      bySource,
    };
  }

  /**
   * Create a new client
   */
  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await this.db.insert(clients).values(client).returning();
    return created!;
  }

  /**
   * Update client
   */
  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await this.db
      .update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete client
   */
  async deleteClient(id: string): Promise<void> {
    await this.db.delete(clients).where(eq(clients.id, id));
  }

  // ============================================
  // CLIENT SERVICE MAPPING METHODS
  // ============================================

  /**
   * Get client service mapping by ID
   */
  async getClientServiceMapping(id: string): Promise<ClientServiceMapping | undefined> {
    const [mapping] = await this.db
      .select()
      .from(clientServiceMappings)
      .where(eq(clientServiceMappings.id, id))
      .limit(1);
    return mapping;
  }

  /**
   * Get all service mappings for a client
   */
  async getClientServiceMappings(clientId: string): Promise<ClientServiceMapping[]> {
    return await this.db
      .select()
      .from(clientServiceMappings)
      .where(eq(clientServiceMappings.clientId, clientId))
      .orderBy(desc(clientServiceMappings.createdAt));
  }

  /**
   * Find client by service provider ID
   * Used when receiving webhooks from external services (Phorest, Fresha, etc.)
   */
  async getClientByServiceProviderId(
    tenantId: string,
    serviceName: string,
    serviceProviderClientId: string,
  ): Promise<Client | undefined> {
    const [mapping] = await this.db
      .select()
      .from(clientServiceMappings)
      .where(
        and(
          eq(clientServiceMappings.tenantId, tenantId),
          eq(clientServiceMappings.serviceName, serviceName),
          eq(clientServiceMappings.serviceProviderClientId, serviceProviderClientId),
        ),
      )
      .limit(1);

    if (!mapping) return undefined;

    return await this.getClient(mapping.clientId);
  }

  /**
   * Create a new client service mapping
   */
  async createClientServiceMapping(
    mapping: InsertClientServiceMapping,
  ): Promise<ClientServiceMapping> {
    const [created] = await this.db.insert(clientServiceMappings).values(mapping).returning();
    return created!;
  }

  /**
   * Update client service mapping
   */
  async updateClientServiceMapping(
    id: string,
    updates: Partial<InsertClientServiceMapping>,
  ): Promise<ClientServiceMapping | undefined> {
    const [updated] = await this.db
      .update(clientServiceMappings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clientServiceMappings.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete client service mapping
   */
  async deleteClientServiceMapping(id: string): Promise<void> {
    await this.db.delete(clientServiceMappings).where(eq(clientServiceMappings.id, id));
  }

  // ============================================
  // LEAD METHODS
  // ============================================

  /**
   * Get lead by ID
   */
  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return lead;
  }

  /**
   * Get lead by phone number (within tenant)
   */
  async getLeadByPhone(tenantId: string, phone: string): Promise<Lead | undefined> {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.phone, phone)))
      .limit(1);
    return lead;
  }

  /**
   * Get all leads for a tenant with optional filters
   */
  async getLeadsByTenant(
    tenantId: string,
    filters?: {
      status?: string;
      assignedAgentId?: string;
      needsFollowUp?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<Lead[]> {
    const conditions = [eq(leads.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(leads.status, filters.status));
    }
    if (filters?.assignedAgentId) {
      conditions.push(eq(leads.assignedAgentId, filters.assignedAgentId));
    }
    if (filters?.needsFollowUp) {
      conditions.push(lte(leads.nextFollowUpAt, new Date()));
      conditions.push(isNull(leads.convertedToClientId));
    }

    let query = this.db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  /**
   * Create a new lead
   */
  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await this.db.insert(leads).values(lead).returning();
    return created!;
  }

  /**
   * Update lead
   */
  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await this.db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  /**
   * Convert lead to client (mark as converted)
   */
  async convertLeadToClient(leadId: string, clientId: string): Promise<void> {
    await this.db
      .update(leads)
      .set({
        status: 'converted',
        convertedToClientId: clientId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));
  }

  /**
   * Delete lead
   */
  async deleteLead(id: string): Promise<void> {
    await this.db.delete(leads).where(eq(leads.id, id));
  }

  // ============================================
  // BOOKING METHODS
  // ============================================

  /**
   * Get booking by ID
   */
  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await this.db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    return booking;
  }

  /**
   * Get all bookings for a client
   */
  async getBookingsByClient(clientId: string): Promise<Booking[]> {
    return await this.db
      .select()
      .from(bookings)
      .where(eq(bookings.clientId, clientId))
      .orderBy(desc(bookings.bookingDateTime));
  }

  /**
   * Get all bookings for a tenant with optional filters
   */
  async getBookingsByTenant(
    tenantId: string,
    filters?: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
      clientId?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<Booking[]> {
    const conditions = [eq(bookings.tenantId, tenantId)];

    if (filters?.startDate) {
      conditions.push(gte(bookings.bookingDateTime, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(bookings.bookingDateTime, filters.endDate));
    }
    if (filters?.status) {
      conditions.push(eq(bookings.status, filters.status));
    }
    if (filters?.clientId) {
      conditions.push(eq(bookings.clientId, filters.clientId));
    }

    let query = this.db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.bookingDateTime));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    return await query;
  }

  /**
   * Get booking statistics for a client
   */
  async getClientBookingStats(clientId: string): Promise<{
    totalBookings: number;
    totalSpent: number;
    averageSpent: number;
    lastBookingDate: Date | null;
    favoriteServices: { serviceName: string; count: number }[];
  }> {
    const clientBookings = await this.getBookingsByClient(clientId);

    const totalBookings = clientBookings.length;
    const totalSpent = clientBookings.reduce((sum, b) => sum + b.amount, 0);
    const averageSpent = totalBookings > 0 ? totalSpent / totalBookings : 0;
    const lastBookingDate = clientBookings.length > 0 ? clientBookings[0].bookingDateTime : null;

    // Calculate favorite services
    const serviceCounts: Record<string, number> = {};
    for (const booking of clientBookings) {
      serviceCounts[booking.serviceName] = (serviceCounts[booking.serviceName] || 0) + 1;
    }

    const favoriteServices = Object.entries(serviceCounts)
      .map(([serviceName, count]) => ({ serviceName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 services

    return {
      totalBookings,
      totalSpent,
      averageSpent,
      lastBookingDate,
      favoriteServices,
    };
  }

  /**
   * Create a new booking
   */
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [created] = await this.db.insert(bookings).values(booking).returning();
    return created!;
  }

  /**
   * Update booking
   */
  async updateBooking(id: string, updates: Partial<InsertBooking>): Promise<Booking | undefined> {
    const [updated] = await this.db
      .update(bookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  /**
   * Confirm booking - mark as confirmed with deposit paid
   */
  async confirmBooking(bookingId: string, depositAmount?: number): Promise<Booking | undefined> {
    const now = new Date();
    const updates: any = {
      status: 'confirmed',
      paymentStatus: depositAmount ? 'deposit_paid' : 'no_payment',
      confirmedAt: now,
      updatedAt: now,
    };

    if (depositAmount) {
      updates.depositAmount = depositAmount;
      updates.depositPaidAt = now;
    }

    const [updated] = await this.db
      .update(bookings)
      .set(updates)
      .where(eq(bookings.id, bookingId))
      .returning();
    return updated;
  }

  /**
   * Complete booking - mark service as completed
   */
  async completeBooking(bookingId: string): Promise<Booking | undefined> {
    const now = new Date();
    const [updated] = await this.db
      .update(bookings)
      .set({
        status: 'completed',
        paymentStatus: 'paid',
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(bookings.id, bookingId))
      .returning();
    return updated;
  }

  /**
   * Cancel booking with optional refund
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    refundAmount?: number,
    notes?: string,
  ): Promise<Booking | undefined> {
    const now = new Date();
    const updates: any = {
      status: 'cancelled',
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
    };

    if (refundAmount !== undefined) {
      updates.refundAmount = refundAmount;
      updates.refundedAt = now;
      updates.paymentStatus = 'refunded';
    }

    if (notes) {
      updates.cancellationNotes = notes;
    }

    const [updated] = await this.db
      .update(bookings)
      .set(updates)
      .where(eq(bookings.id, bookingId))
      .returning();
    return updated;
  }

  /**
   * Mark booking as no-show
   */
  async markBookingNoShow(bookingId: string): Promise<Booking | undefined> {
    const now = new Date();
    const [updated] = await this.db
      .update(bookings)
      .set({
        status: 'no_show',
        updatedAt: now,
      })
      .where(eq(bookings.id, bookingId))
      .returning();
    return updated;
  }

  /**
   * Delete booking
   */
  async deleteBooking(id: string): Promise<void> {
    await this.db.delete(bookings).where(eq(bookings.id, id));
  }
}

// Initialize PostgreSQL storage (DATABASE_URL required)
export const storage = new DbStorage();
