import {
  type User,
  type InsertUser,
  type Message,
  type InsertMessage,
  type Conversation,
  type InsertConversation,
  type Tenant,
  type InsertTenant,
  type ClientUser,
  type InsertClientUser,
  type ApiKey,
  type InsertApiKey,
  type WidgetConfig,
  type InsertWidgetConfig,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type DailyAnalytics,
  type InsertDailyAnalytics,
  type HumanAgent,
  type InsertHumanAgent,
  type UserInvitation,
  type InsertUserInvitation,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  users,
  messages,
  conversations,
  tenants,
  clientUsers,
  apiKeys,
  widgetConfigs,
  analyticsEvents,
  dailyAnalytics,
  humanAgents,
  userInvitations,
  passwordResetTokens,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, and, or, gte, lte, gt, sql } from "drizzle-orm";
import { encryptApiKey, decryptApiKey } from "./encryption";

export interface IStorage {
  // Legacy User methods (keeping for backward compatibility)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
  getApiKeysByTenant(tenantId: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  deleteApiKey(id: string, tenantId: string): Promise<void>;

  // Widget Config methods
  getWidgetConfig(tenantId: string): Promise<WidgetConfig | undefined>;
  createWidgetConfig(config: InsertWidgetConfig): Promise<WidgetConfig>;
  updateWidgetConfig(tenantId: string, updates: Partial<InsertWidgetConfig>): Promise<WidgetConfig | undefined>;

  // Human Agent methods
  getHumanAgent(id: string): Promise<HumanAgent | undefined>;
  getHumanAgentsByTenant(tenantId: string): Promise<HumanAgent[]>;
  getAvailableHumanAgents(tenantId: string): Promise<HumanAgent[]>;
  createHumanAgent(agent: InsertHumanAgent, tenantId: string): Promise<HumanAgent>;
  updateHumanAgent(id: string, updates: Partial<InsertHumanAgent>, tenantId: string): Promise<HumanAgent | undefined>;
  updateHumanAgentStatus(id: string, status: string, tenantId: string): Promise<void>;
  incrementActiveChats(id: string, tenantId: string): Promise<void>;
  decrementActiveChats(id: string, tenantId: string): Promise<void>;

  // Message methods (tenant-scoped) - tenantId is REQUIRED for security
  getMessagesByConversation(conversationId: string, tenantId: string): Promise<Message[]>;
  createMessage(message: InsertMessage, tenantId: string): Promise<Message>;
  deleteMessage(id: string, tenantId: string): Promise<void>;

  // Conversation methods (tenant-scoped) - tenantId is REQUIRED for security
  getConversation(id: string, tenantId: string): Promise<Conversation | undefined>;
  getConversationsByTenant(tenantId: string): Promise<Conversation[]>;
  getActiveHandoffs(tenantId: string): Promise<Conversation[]>;
  getPendingHandoffs(tenantId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation, tenantId: string): Promise<Conversation>;
  updateConversation(
    id: string,
    updates: Partial<InsertConversation>,
    tenantId: string
  ): Promise<Conversation | undefined>;
  updateConversationMetadata(
    id: string,
    metadata: Record<string, any>,
    tenantId: string
  ): Promise<Conversation | undefined>;
  deleteConversation(id: string, tenantId: string): Promise<void>;

  // Analytics methods
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(tenantId: string, startDate: Date, endDate: Date): Promise<AnalyticsEvent[]>;
  getDailyAnalytics(tenantId: string, startDate: Date, endDate: Date): Promise<DailyAnalytics[]>;
  createOrUpdateDailyAnalytics(analytics: InsertDailyAnalytics): Promise<DailyAnalytics>;

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

  // Platform Admin methods  
  getAllUsers(): Promise<ClientUser[]>; // Get all users across all tenants (platform admin only)
  getPlatformAdmins(): Promise<ClientUser[]>; // Get all platform admins
  updateUserRole(userId: string, role: string, isPlatformAdmin: boolean): Promise<ClientUser | undefined>;

  // Password Reset Token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  getAllUnexpiredResetTokens(): Promise<PasswordResetToken[]>;
  markTokenAsUsed(token: string): Promise<void>;
  markTokenAsUsedById(id: string): Promise<void>;
  cleanupExpiredResetTokens(): Promise<number>; // Clean up expired/used tokens
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private messages: Map<string, Message>;
  private conversations: Map<string, Conversation>;
  private tenants: Map<string, Tenant>;
  private clientUsers: Map<string, ClientUser>;
  private apiKeys: Map<string, ApiKey>;
  private widgetConfigs: Map<string, WidgetConfig>;
  private analyticsEvents: Map<string, AnalyticsEvent>;
  private dailyAnalytics: Map<string, DailyAnalytics>;
  private humanAgents: Map<string, HumanAgent>;
  private userInvitations: Map<string, UserInvitation>;
  private passwordResetTokens: Map<string, PasswordResetToken>;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.conversations = new Map();
    this.tenants = new Map();
    this.clientUsers = new Map();
    this.apiKeys = new Map();
    this.widgetConfigs = new Map();
    this.analyticsEvents = new Map();
    this.dailyAnalytics = new Map();
    this.humanAgents = new Map();
    this.userInvitations = new Map();
    this.passwordResetTokens = new Map();
  }

  // Legacy User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Tenant methods
  async getTenant(id: string): Promise<Tenant | undefined> {
    return this.tenants.get(id);
  }

  async getTenantByEmail(email: string): Promise<Tenant | undefined> {
    return Array.from(this.tenants.values()).find((t) => t.email === email);
  }

  async getAllTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const id = randomUUID();
    const tenant: Tenant = {
      id,
      ...insertTenant,
      createdAt: new Date(),
    };
    this.tenants.set(id, tenant);
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const tenant = this.tenants.get(id);
    if (!tenant) return undefined;
    const updated = { ...tenant, ...updates };
    this.tenants.set(id, updated);
    return updated;
  }

  async deleteTenant(id: string): Promise<void> {
    this.tenants.delete(id);
  }

  // Client User methods
  async getClientUser(id: string): Promise<ClientUser | undefined> {
    return this.clientUsers.get(id);
  }

  async getClientUserByEmail(email: string): Promise<ClientUser | undefined> {
    return Array.from(this.clientUsers.values()).find((u) => u.email === email);
  }

  async getClientUsersByTenant(tenantId: string): Promise<ClientUser[]> {
    return Array.from(this.clientUsers.values()).filter((u) => u.tenantId === tenantId);
  }

  async createClientUser(insertUser: InsertClientUser): Promise<ClientUser> {
    const id = randomUUID();
    const user: ClientUser = {
      id,
      ...insertUser,
      createdAt: new Date(),
    };
    this.clientUsers.set(id, user);
    return user;
  }

  async updateClientUser(id: string, updates: Partial<InsertClientUser>): Promise<ClientUser | undefined> {
    const user = this.clientUsers.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.clientUsers.set(id, updated);
    return updated;
  }

  async deleteClientUser(id: string): Promise<void> {
    this.clientUsers.delete(id);
  }

  async updateClientUserPassword(id: string, hashedPassword: string): Promise<void> {
    const user = this.clientUsers.get(id);
    if (user) {
      user.password = hashedPassword;
      this.clientUsers.set(id, user);
    }
  }

  async markOnboardingComplete(userId: string): Promise<void> {
    const user = this.clientUsers.get(userId);
    if (user) {
      user.onboardingCompleted = true;
      this.clientUsers.set(userId, user);
    }
  }

  // API Key methods
  async getApiKey(id: string): Promise<ApiKey | undefined> {
    return this.apiKeys.get(id);
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    return Array.from(this.apiKeys.values()).find((k) => k.keyHash === keyHash);
  }

  async getApiKeysByTenant(tenantId: string): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values()).filter((k) => k.tenantId === tenantId);
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = randomUUID();
    const apiKey: ApiKey = {
      id,
      ...insertApiKey,
      createdAt: new Date(),
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    const apiKey = this.apiKeys.get(id);
    if (apiKey) {
      apiKey.lastUsed = new Date();
      this.apiKeys.set(id, apiKey);
    }
  }

  async deleteApiKey(id: string, tenantId: string): Promise<void> {
    // Verify the API key belongs to the tenant before deleting
    const apiKey = this.apiKeys.get(id);
    if (apiKey?.tenantId !== tenantId) return;
    this.apiKeys.delete(id);
  }

  // Widget Config methods
  async getWidgetConfig(tenantId: string): Promise<WidgetConfig | undefined> {
    const config = Array.from(this.widgetConfigs.values()).find((c) => c.tenantId === tenantId);
    if (!config) return undefined;
    
    // Decrypt the Retell API key if it exists
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error("Error decrypting Retell API key:", error);
        return config;
      }
    }
    
    return config;
  }

  async createWidgetConfig(insertConfig: InsertWidgetConfig): Promise<WidgetConfig> {
    const id = randomUUID();
    
    // Encrypt the Retell API key if provided
    const encryptedConfig = { ...insertConfig };
    if (insertConfig.retellApiKey) {
      encryptedConfig.retellApiKey = encryptApiKey(insertConfig.retellApiKey);
    }
    
    const config: WidgetConfig = {
      id,
      ...encryptedConfig,
      updatedAt: new Date(),
    };
    this.widgetConfigs.set(id, config);
    
    // Return with decrypted API key for immediate use
    return {
      ...config,
      retellApiKey: insertConfig.retellApiKey ?? null,
    };
  }

  async updateWidgetConfig(tenantId: string, updates: Partial<InsertWidgetConfig>): Promise<WidgetConfig | undefined> {
    const config = await this.getWidgetConfig(tenantId);
    if (!config) return undefined;
    
    // Encrypt the Retell API key if being updated
    const encryptedUpdates = { ...updates };
    if (updates.retellApiKey) {
      encryptedUpdates.retellApiKey = encryptApiKey(updates.retellApiKey);
    }
    
    const updated = { ...config, ...encryptedUpdates, updatedAt: new Date() };
    this.widgetConfigs.set(config.id, updated);
    
    // Return with decrypted API key for immediate use
    if (updated.retellApiKey) {
      try {
        return {
          ...updated,
          retellApiKey: decryptApiKey(updated.retellApiKey),
        };
      } catch (error) {
        console.error("Error decrypting Retell API key:", error);
        return updated;
      }
    }
    
    return updated;
  }

  // Human Agent methods
  async getHumanAgent(id: string): Promise<HumanAgent | undefined> {
    return this.humanAgents.get(id);
  }

  async getHumanAgentsByTenant(tenantId: string): Promise<HumanAgent[]> {
    return Array.from(this.humanAgents.values())
      .filter((agent) => agent.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAvailableHumanAgents(tenantId: string): Promise<HumanAgent[]> {
    return Array.from(this.humanAgents.values())
      .filter((agent) => 
        agent.tenantId === tenantId && 
        agent.status === "available" && 
        agent.activeChats < agent.maxChats
      )
      .sort((a, b) => a.activeChats - b.activeChats);
  }

  async createHumanAgent(insertAgent: InsertHumanAgent, tenantId: string): Promise<HumanAgent> {
    const id = randomUUID();
    const agent: HumanAgent = {
      id,
      ...insertAgent,
      tenantId,
      status: insertAgent.status ?? "available",
      activeChats: 0,
      maxChats: insertAgent.maxChats ?? 5,
      createdAt: new Date(),
    };
    this.humanAgents.set(id, agent);
    return agent;
  }

  async updateHumanAgent(
    id: string, 
    updates: Partial<InsertHumanAgent>, 
    tenantId: string
  ): Promise<HumanAgent | undefined> {
    const agent = this.humanAgents.get(id);
    if (!agent || agent.tenantId !== tenantId) return undefined;
    
    const updated = { ...agent, ...updates };
    this.humanAgents.set(id, updated);
    return updated;
  }

  async updateHumanAgentStatus(id: string, status: string, tenantId: string): Promise<void> {
    const agent = this.humanAgents.get(id);
    if (!agent || agent.tenantId !== tenantId) return;
    
    agent.status = status;
    this.humanAgents.set(id, agent);
  }

  async incrementActiveChats(id: string, tenantId: string): Promise<void> {
    const agent = this.humanAgents.get(id);
    if (!agent || agent.tenantId !== tenantId) return;
    
    agent.activeChats += 1;
    this.humanAgents.set(id, agent);
  }

  async decrementActiveChats(id: string, tenantId: string): Promise<void> {
    const agent = this.humanAgents.get(id);
    if (!agent || agent.tenantId !== tenantId) return;
    
    if (agent.activeChats > 0) {
      agent.activeChats -= 1;
      this.humanAgents.set(id, agent);
    }
  }

  // Message methods (tenant-scoped) - tenantId is REQUIRED
  async getMessagesByConversation(conversationId: string, tenantId: string): Promise<Message[]> {
    // ALWAYS filter by both conversationId AND tenantId for security
    return Array.from(this.messages.values())
      .filter((message) => {
        return message.conversationId === conversationId && message.tenantId === tenantId;
      })
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  async createMessage(insertMessage: InsertMessage, tenantId: string): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      tenantId, // Server-injected for security
      senderType: insertMessage.senderType ?? "user",
      humanAgentId: insertMessage.humanAgentId ?? null,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async deleteMessage(id: string, tenantId: string): Promise<void> {
    // ALWAYS verify tenantId matches for security
    const message = this.messages.get(id);
    if (message?.tenantId !== tenantId) return;
    this.messages.delete(id);
  }

  // Conversation methods (tenant-scoped) - tenantId is REQUIRED
  async getConversation(id: string, tenantId: string): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    // ALWAYS verify tenantId matches for security
    if (conversation.tenantId !== tenantId) return undefined;
    return conversation;
  }

  async getConversationsByTenant(tenantId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getActiveHandoffs(tenantId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter((c) => c.tenantId === tenantId && c.handoffStatus === "with_human")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPendingHandoffs(tenantId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter((c) => c.tenantId === tenantId && c.handoffStatus === "pending_handoff")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createConversation(
    insertConversation: InsertConversation,
    tenantId: string
  ): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      id,
      title: insertConversation.title,
      tenantId, // Server-injected for security
      flowId: insertConversation.flowId ?? null,
      agentId: insertConversation.agentId ?? null,
      endUserId: insertConversation.endUserId ?? null,
      metadata: insertConversation.metadata ?? null,
      handoffStatus: insertConversation.handoffStatus ?? "ai",
      humanAgentId: insertConversation.humanAgentId ?? null,
      conversationSummary: insertConversation.conversationSummary ?? null,
      handoffTimestamp: insertConversation.handoffTimestamp ?? null,
      handoffReason: insertConversation.handoffReason ?? null,
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(
    id: string,
    updates: Partial<InsertConversation>,
    tenantId: string
  ): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    // ALWAYS verify tenantId matches for security
    if (conversation.tenantId !== tenantId) return undefined;

    // Update conversation with new fields (tenantId is already not in InsertConversation schema)
    const updated = { ...conversation, ...updates };
    this.conversations.set(id, updated);
    return updated;
  }

  async updateConversationMetadata(
    id: string,
    metadata: Record<string, any>,
    tenantId: string
  ): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    // ALWAYS verify tenantId matches for security
    if (conversation.tenantId !== tenantId) return undefined;

    // Only update metadata, don't allow other fields to be modified
    const updated = {
      ...conversation,
      metadata: { ...conversation.metadata, ...metadata },
    };
    this.conversations.set(id, updated);
    return updated;
  }

  async deleteConversation(id: string, tenantId: string): Promise<void> {
    const conversation = this.conversations.get(id);
    if (!conversation) return;
    // ALWAYS verify tenantId matches for security
    if (conversation.tenantId !== tenantId) return;

    this.conversations.delete(id);
    // Also delete associated messages
    const messages = await this.getMessagesByConversation(id, tenantId);
    messages.forEach((message) => this.messages.delete(message.id));
  }

  // Analytics methods
  async createAnalyticsEvent(insertEvent: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const id = randomUUID();
    const event: AnalyticsEvent = {
      id,
      ...insertEvent,
      timestamp: new Date(),
    };
    this.analyticsEvents.set(id, event);
    return event;
  }

  async getAnalyticsEvents(tenantId: string, startDate: Date, endDate: Date): Promise<AnalyticsEvent[]> {
    return Array.from(this.analyticsEvents.values())
      .filter((e) => {
        const matchesTenant = e.tenantId === tenantId;
        const matchesDate = e.timestamp >= startDate && e.timestamp <= endDate;
        return matchesTenant && matchesDate;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getDailyAnalytics(tenantId: string, startDate: Date, endDate: Date): Promise<DailyAnalytics[]> {
    return Array.from(this.dailyAnalytics.values())
      .filter((a) => {
        const matchesTenant = a.tenantId === tenantId;
        const matchesDate = a.date >= startDate && a.date <= endDate;
        return matchesTenant && matchesDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async createOrUpdateDailyAnalytics(insertAnalytics: InsertDailyAnalytics): Promise<DailyAnalytics> {
    // Find existing analytics for this tenant and date
    const existing = Array.from(this.dailyAnalytics.values()).find(
      (a) => a.tenantId === insertAnalytics.tenantId && 
             a.date.toDateString() === insertAnalytics.date.toDateString()
    );

    if (existing) {
      const updated = { ...existing, ...insertAnalytics };
      this.dailyAnalytics.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const analytics: DailyAnalytics = { id, ...insertAnalytics };
      this.dailyAnalytics.set(id, analytics);
      return analytics;
    }
  }

  // User Invitation methods
  async createUserInvitation(insertInvitation: InsertUserInvitation): Promise<UserInvitation> {
    const id = randomUUID();
    const invitation: UserInvitation = {
      id,
      email: insertInvitation.email,
      firstName: insertInvitation.firstName,
      lastName: insertInvitation.lastName,
      phoneNumber: insertInvitation.phoneNumber ?? null,
      temporaryPassword: insertInvitation.temporaryPassword,
      role: insertInvitation.role,
      tenantId: insertInvitation.tenantId ?? null,
      invitedBy: insertInvitation.invitedBy ?? null,
      expiresAt: insertInvitation.expiresAt,
      createdAt: new Date(),
      status: insertInvitation.status ?? 'pending',
      companyName: insertInvitation.companyName ?? null,
      companyPhone: insertInvitation.companyPhone ?? null,
      retellApiKey: insertInvitation.retellApiKey ?? null,
      plainTemporaryPassword: insertInvitation.plainTemporaryPassword ?? null,
      lastSentAt: insertInvitation.lastSentAt ?? null,
      invitedUserId: insertInvitation.invitedUserId ?? null,
      acceptedAt: insertInvitation.acceptedAt ?? null,
    };
    this.userInvitations.set(id, invitation);
    return invitation;
  }

  async getUserInvitationByEmail(email: string): Promise<UserInvitation | undefined> {
    return Array.from(this.userInvitations.values()).find((inv) => inv.email === email);
  }

  async getPendingInvitationByEmail(email: string): Promise<UserInvitation | undefined> {
    const now = new Date();
    return Array.from(this.userInvitations.values()).find(
      (inv) => inv.email === email && 
               (inv.status === 'pending' || inv.status === 'sent') && 
               inv.expiresAt > now
    );
  }

  async getActiveInvitations(tenantId?: string): Promise<UserInvitation[]> {
    const now = new Date();
    return Array.from(this.userInvitations.values())
      .filter((inv) => {
        const isActive = inv.status !== 'accepted' && inv.expiresAt > now;
        if (!isActive) return false;
        if (tenantId) {
          return inv.tenantId === tenantId;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPendingInvitations(): Promise<UserInvitation[]> {
    const now = new Date();
    return Array.from(this.userInvitations.values())
      .filter((inv) => 
        (inv.status === 'pending' || inv.status === 'sent') && 
        inv.expiresAt > now
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateInvitationStatus(id: string, status: string, lastSentAt?: Date): Promise<void> {
    const invitation = this.userInvitations.get(id);
    if (invitation) {
      invitation.status = status;
      if (lastSentAt) {
        invitation.lastSentAt = lastSentAt;
      }
      this.userInvitations.set(id, invitation);
    }
  }

  async markInvitationAccepted(id: string, userId: string): Promise<void> {
    const invitation = this.userInvitations.get(id);
    if (invitation) {
      invitation.status = 'accepted';
      invitation.invitedUserId = userId;
      invitation.acceptedAt = new Date();
      // SECURITY: Null out plaintext password immediately after acceptance
      invitation.plainTemporaryPassword = null;
      this.userInvitations.set(id, invitation);
    }
  }

  async markInvitationUsed(id: string): Promise<void> {
    // Legacy method - now marks invitation as accepted
    const invitation = this.userInvitations.get(id);
    if (invitation) {
      invitation.status = 'accepted';
      this.userInvitations.set(id, invitation);
    }
  }

  async deleteInvitation(id: string): Promise<void> {
    this.userInvitations.delete(id);
  }

  async cleanupExpiredInvitationPasswords(): Promise<number> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [id, invitation] of this.userInvitations.entries()) {
      // Null out plaintext password if:
      // 1. Invitation is expired (past expiresAt date) OR
      // 2. Invitation is accepted (status === 'accepted') OR
      // 3. Invitation is older than 7 days AND still has plaintext password
      const shouldCleanup = invitation.plainTemporaryPassword !== null && (
        invitation.expiresAt < now ||
        invitation.status === 'accepted' ||
        invitation.createdAt < sevenDaysAgo
      );

      if (shouldCleanup) {
        invitation.plainTemporaryPassword = null;
        this.userInvitations.set(id, invitation);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Password Reset Token methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = randomUUID();
    const newToken: PasswordResetToken = {
      id,
      ...token,
      createdAt: new Date(),
    };
    // For MemStorage, use a Map to store tokens (in real DB, this would be a table)
    if (!this.passwordResetTokens) {
      this.passwordResetTokens = new Map();
    }
    this.passwordResetTokens.set(id, newToken);
    return newToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    if (!this.passwordResetTokens) return undefined;
    return Array.from(this.passwordResetTokens.values()).find(
      (t) => t.token === token && !t.used && t.expiresAt > new Date()
    );
  }

  async getAllUnexpiredResetTokens(): Promise<PasswordResetToken[]> {
    if (!this.passwordResetTokens) return [];
    const now = new Date();
    return Array.from(this.passwordResetTokens.values()).filter(
      (t) => !t.used && t.expiresAt > now
    );
  }

  async markTokenAsUsed(token: string): Promise<void> {
    if (!this.passwordResetTokens) return;
    const resetToken = await this.getPasswordResetToken(token);
    if (resetToken) {
      resetToken.used = true;
      this.passwordResetTokens.set(resetToken.id, resetToken);
    }
  }

  async markTokenAsUsedById(id: string): Promise<void> {
    if (!this.passwordResetTokens) return;
    const resetToken = this.passwordResetTokens.get(id);
    if (resetToken) {
      resetToken.used = true;
      this.passwordResetTokens.set(id, resetToken);
    }
  }

  async cleanupExpiredResetTokens(): Promise<number> {
    if (!this.passwordResetTokens) return 0;
    const now = new Date();
    let cleanedCount = 0;
    for (const [id, token] of this.passwordResetTokens.entries()) {
      if (token.used || token.expiresAt < now) {
        this.passwordResetTokens.delete(id);
        cleanedCount++;
      }
    }
    return cleanedCount;
  }

  // Platform Admin methods
  async getAllUsers(): Promise<ClientUser[]> {
    return Array.from(this.clientUsers.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getPlatformAdmins(): Promise<ClientUser[]> {
    return Array.from(this.clientUsers.values())
      .filter((u) => u.isPlatformAdmin === true)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateUserRole(userId: string, role: string, isPlatformAdmin: boolean): Promise<ClientUser | undefined> {
    const user = this.clientUsers.get(userId);
    if (!user) return undefined;
    const updated = { ...user, role, isPlatformAdmin };
    this.clientUsers.set(userId, updated);
    return updated;
  }
}

// Database storage implementation using PostgreSQL
export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL environment variable is required for database storage"
      );
    }
    
    try {
      const sql = neon(process.env.DATABASE_URL);
      this.db = drizzle(sql);
    } catch (error) {
      console.error("Failed to initialize database connection:", error);
      throw new Error("Database initialization failed");
    }
  }

  // Legacy User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return result[0];
  }

  // Tenant methods
  async getTenant(id: string): Promise<Tenant | undefined> {
    const result = await this.db.select().from(tenants).where(eq(tenants.id, id));
    return result[0];
  }

  async getTenantByEmail(email: string): Promise<Tenant | undefined> {
    const result = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.email, email));
    return result[0];
  }

  async getAllTenants(): Promise<Tenant[]> {
    return await this.db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const result = await this.db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return result[0];
  }

  async updateTenant(id: string, updates: Partial<InsertTenant>): Promise<Tenant | undefined> {
    const result = await this.db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();
    return result[0];
  }

  async deleteTenant(id: string): Promise<void> {
    await this.db
      .delete(tenants)
      .where(eq(tenants.id, id));
  }

  // Client User methods
  async getClientUser(id: string): Promise<ClientUser | undefined> {
    const result = await this.db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.id, id));
    return result[0];
  }

  async getClientUserByEmail(email: string): Promise<ClientUser | undefined> {
    const result = await this.db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.email, email));
    return result[0];
  }

  async getClientUsersByTenant(tenantId: string): Promise<ClientUser[]> {
    return await this.db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.tenantId, tenantId));
  }

  async createClientUser(insertUser: InsertClientUser): Promise<ClientUser> {
    const result = await this.db
      .insert(clientUsers)
      .values(insertUser)
      .returning();
    return result[0];
  }

  async updateClientUser(id: string, updates: Partial<InsertClientUser>): Promise<ClientUser | undefined> {
    const result = await this.db
      .update(clientUsers)
      .set(updates)
      .where(eq(clientUsers.id, id))
      .returning();
    return result[0];
  }

  async deleteClientUser(id: string): Promise<void> {
    await this.db
      .delete(clientUsers)
      .where(eq(clientUsers.id, id));
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
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id));
    return result[0];
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const result = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash));
    return result[0];
  }

  async getApiKeysByTenant(tenantId: string): Promise<ApiKey[]> {
    return await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId));
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const result = await this.db
      .insert(apiKeys)
      .values(insertApiKey)
      .returning();
    return result[0];
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: string): Promise<void> {
    await this.db.delete(apiKeys).where(eq(apiKeys.id, id));
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
        console.error("Error decrypting Retell API key:", error);
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
    
    const result = await this.db
      .insert(widgetConfigs)
      .values(configToInsert)
      .returning();
    
    const config = result[0];
    
    // Decrypt the API key for immediate use
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error("Error decrypting Retell API key:", error);
        return config;
      }
    }
    
    return config;
  }

  async updateWidgetConfig(tenantId: string, updates: Partial<InsertWidgetConfig>): Promise<WidgetConfig | undefined> {
    // Encrypt the Retell API key if being updated
    const updatesToApply = { ...updates };
    if (updates.retellApiKey) {
      updatesToApply.retellApiKey = encryptApiKey(updates.retellApiKey);
    }
    
    const result = await this.db
      .update(widgetConfigs)
      .set({ ...updatesToApply, updatedAt: new Date() })
      .where(eq(widgetConfigs.tenantId, tenantId))
      .returning();
    
    const config = result[0];
    if (!config) return undefined;
    
    // Decrypt the API key for immediate use
    if (config.retellApiKey) {
      try {
        return {
          ...config,
          retellApiKey: decryptApiKey(config.retellApiKey),
        };
      } catch (error) {
        console.error("Error decrypting Retell API key:", error);
        return config;
      }
    }
    
    return config;
  }

  // Human Agent methods
  async getHumanAgent(id: string): Promise<HumanAgent | undefined> {
    const result = await this.db
      .select()
      .from(humanAgents)
      .where(eq(humanAgents.id, id));
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
      .where(and(
        eq(humanAgents.tenantId, tenantId),
        eq(humanAgents.status, "available"),
        sql`${humanAgents.activeChats} < ${humanAgents.maxChats}`
      ))
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
    tenantId: string
  ): Promise<HumanAgent | undefined> {
    const result = await this.db
      .update(humanAgents)
      .set(updates)
      .where(and(
        eq(humanAgents.id, id),
        eq(humanAgents.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }

  async updateHumanAgentStatus(id: string, status: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ status })
      .where(and(
        eq(humanAgents.id, id),
        eq(humanAgents.tenantId, tenantId)
      ));
  }

  async incrementActiveChats(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ activeChats: sql`${humanAgents.activeChats} + 1` })
      .where(and(
        eq(humanAgents.id, id),
        eq(humanAgents.tenantId, tenantId)
      ));
  }

  async decrementActiveChats(id: string, tenantId: string): Promise<void> {
    await this.db
      .update(humanAgents)
      .set({ activeChats: sql`GREATEST(${humanAgents.activeChats} - 1, 0)` })
      .where(and(
        eq(humanAgents.id, id),
        eq(humanAgents.tenantId, tenantId)
      ));
  }

  // Message methods (tenant-scoped) - tenantId is REQUIRED
  async getMessagesByConversation(conversationId: string, tenantId: string): Promise<Message[]> {
    // ALWAYS filter by both conversationId AND tenantId for security
    return await this.db
      .select()
      .from(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.tenantId, tenantId)
      ))
      .orderBy(messages.timestamp);
  }

  async createMessage(insertMessage: InsertMessage, tenantId: string): Promise<Message> {
    // Defensively require tenantId for multi-tenant isolation
    if (!tenantId || tenantId.trim() === '') {
      throw new Error("tenantId is required and must not be empty for creating messages");
    }

    const result = await this.db
      .insert(messages)
      .values({
        ...insertMessage,
        tenantId, // Server-injected for security
      })
      .returning();
    return result[0];
  }

  async deleteMessage(id: string, tenantId: string): Promise<void> {
    // ALWAYS filter by both id AND tenantId for security
    await this.db.delete(messages).where(and(
      eq(messages.id, id),
      eq(messages.tenantId, tenantId)
    ));
  }

  // Conversation methods (tenant-scoped) - tenantId is REQUIRED
  async getConversation(id: string, tenantId: string): Promise<Conversation | undefined> {
    // ALWAYS filter by both id AND tenantId for security
    const result = await this.db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId)
      ));
    return result[0];
  }

  async getConversationsByTenant(tenantId: string): Promise<Conversation[]> {
    return await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.tenantId, tenantId))
      .orderBy(desc(conversations.createdAt));
  }

  async getActiveHandoffs(tenantId: string): Promise<Conversation[]> {
    return await this.db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.handoffStatus, "with_human")
      ))
      .orderBy(desc(conversations.createdAt));
  }

  async getPendingHandoffs(tenantId: string): Promise<Conversation[]> {
    return await this.db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.handoffStatus, "pending_handoff")
      ))
      .orderBy(desc(conversations.createdAt));
  }

  async createConversation(
    insertConversation: InsertConversation,
    tenantId: string
  ): Promise<Conversation> {
    // Defensively require tenantId for multi-tenant isolation
    if (!tenantId || tenantId.trim() === '') {
      throw new Error("tenantId is required and must not be empty for creating conversations");
    }

    const result = await this.db
      .insert(conversations)
      .values({
        ...insertConversation,
        tenantId, // Server-injected for security
      })
      .returning();
    return result[0];
  }

  async updateConversation(
    id: string,
    updates: Partial<InsertConversation>,
    tenantId: string
  ): Promise<Conversation | undefined> {
    // ALWAYS filter by both id AND tenantId for security
    // (tenantId is already not in InsertConversation schema, so no need to filter it out)
    const result = await this.db
      .update(conversations)
      .set(updates)
      .where(and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId)
      ))
      .returning();
    return result[0];
  }

  async updateConversationMetadata(
    id: string,
    metadata: Record<string, any>,
    tenantId: string
  ): Promise<Conversation | undefined> {
    // Get current conversation - MUST filter by tenantId for security
    const current = await this.getConversation(id, tenantId);
    if (!current) return undefined;

    // Merge new metadata with existing
    const updatedMetadata = { ...current.metadata, ...metadata };

    const conditions = tenantId
      ? and(eq(conversations.id, id), eq(conversations.tenantId, tenantId))
      : eq(conversations.id, id);

    const result = await this.db
      .update(conversations)
      .set({ metadata: updatedMetadata })
      .where(conditions)
      .returning();
    return result[0];
  }

  async deleteConversation(id: string, tenantId: string): Promise<void> {
    // ALWAYS filter by both id AND tenantId for security
    // Delete associated messages first
    await this.db.delete(messages).where(and(
      eq(messages.conversationId, id),
      eq(messages.tenantId, tenantId)
    ));
    // Then delete the conversation
    await this.db.delete(conversations).where(and(
      eq(conversations.id, id),
      eq(conversations.tenantId, tenantId)
    ));
  }

  // Analytics methods
  async createAnalyticsEvent(insertEvent: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const result = await this.db
      .insert(analyticsEvents)
      .values(insertEvent)
      .returning();
    return result[0];
  }

  async getAnalyticsEvents(tenantId: string, startDate: Date, endDate: Date): Promise<AnalyticsEvent[]> {
    return await this.db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, tenantId),
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      )
      .orderBy(analyticsEvents.timestamp);
  }

  async getDailyAnalytics(tenantId: string, startDate: Date, endDate: Date): Promise<DailyAnalytics[]> {
    return await this.db
      .select()
      .from(dailyAnalytics)
      .where(
        and(
          eq(dailyAnalytics.tenantId, tenantId),
          gte(dailyAnalytics.date, startDate),
          lte(dailyAnalytics.date, endDate)
        )
      )
      .orderBy(dailyAnalytics.date);
  }

  async createOrUpdateDailyAnalytics(insertAnalytics: InsertDailyAnalytics): Promise<DailyAnalytics> {
    // Try to find existing record
    const existing = await this.db
      .select()
      .from(dailyAnalytics)
      .where(
        and(
          eq(dailyAnalytics.tenantId, insertAnalytics.tenantId),
          eq(dailyAnalytics.date, insertAnalytics.date)
        )
      );

    if (existing.length > 0) {
      // Update existing
      const result = await this.db
        .update(dailyAnalytics)
        .set(insertAnalytics)
        .where(eq(dailyAnalytics.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      // Create new
      const result = await this.db
        .insert(dailyAnalytics)
        .values(insertAnalytics)
        .returning();
      return result[0];
    }
  }

  // User Invitation methods
  async createUserInvitation(insertInvitation: InsertUserInvitation): Promise<UserInvitation> {
    const result = await this.db
      .insert(userInvitations)
      .values(insertInvitation)
      .returning();
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
          or(
            eq(userInvitations.status, 'pending'),
            eq(userInvitations.status, 'sent')
          ),
          gt(userInvitations.expiresAt, now)
        )
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
            eq(userInvitations.tenantId, tenantId)
          )
        )
        .orderBy(desc(userInvitations.createdAt));
    } else {
      return await this.db
        .select()
        .from(userInvitations)
        .where(
          and(
            sql`${userInvitations.status} != 'accepted'`,
            gt(userInvitations.expiresAt, now)
          )
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
          or(
            eq(userInvitations.status, 'pending'),
            eq(userInvitations.status, 'sent')
          ),
          gt(userInvitations.expiresAt, now)
        )
      )
      .orderBy(desc(userInvitations.createdAt));
  }

  async updateInvitationStatus(id: string, status: string, lastSentAt?: Date): Promise<void> {
    const updates: any = { status };
    if (lastSentAt) {
      updates.lastSentAt = lastSentAt;
    }
    await this.db
      .update(userInvitations)
      .set(updates)
      .where(eq(userInvitations.id, id));
  }

  async markInvitationAccepted(id: string, userId: string): Promise<void> {
    await this.db
      .update(userInvitations)
      .set({ 
        status: 'accepted',
        invitedUserId: userId,
        acceptedAt: new Date(),
        // SECURITY: Null out plaintext password immediately after acceptance
        plainTemporaryPassword: null
      })
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
    await this.db
      .delete(userInvitations)
      .where(eq(userInvitations.id, id));
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
            sql`${userInvitations.createdAt} < ${sevenDaysAgo}`
          )
        )
      );

    // Return number of rows updated
    return result.rowCount || 0;
  }

  // Platform Admin methods
  async getAllUsers(): Promise<ClientUser[]> {
    return await this.db
      .select()
      .from(clientUsers)
      .orderBy(desc(clientUsers.createdAt));
  }

  async getPlatformAdmins(): Promise<ClientUser[]> {
    return await this.db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.isPlatformAdmin, true))
      .orderBy(desc(clientUsers.createdAt));
  }

  async updateUserRole(userId: string, role: string, isPlatformAdmin: boolean): Promise<ClientUser | undefined> {
    const result = await this.db
      .update(clientUsers)
      .set({ role, isPlatformAdmin })
      .where(eq(clientUsers.id, userId))
      .returning();
    return result[0];
  }

  // Password Reset Token methods
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await this.db
      .insert(passwordResetTokens)
      .values(token)
      .returning();
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
          gt(passwordResetTokens.expiresAt, now)
        )
      );
    return result[0];
  }

  async getAllUnexpiredResetTokens(): Promise<PasswordResetToken[]> {
    const now = new Date();
    return await this.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, now)
        )
      );
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
        or(
          eq(passwordResetTokens.used, true),
          sql`${passwordResetTokens.expiresAt} < ${now}`
        )
      );
    return result.rowCount || 0;
  }
}

// Use database storage in production, memory storage for testing
export const storage = process.env.DATABASE_URL
  ? new DbStorage()
  : new MemStorage();
