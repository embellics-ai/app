import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  requireAuth,
  requirePlatformAdmin,
  type AuthenticatedRequest,
} from '../middleware/auth.middleware';
import {
  encryptWhatsAppConfig,
  decryptWhatsAppConfig,
  maskWhatsAppConfig,
  encryptSMSConfig,
  decryptSMSConfig,
  maskSMSConfig,
  encrypt,
  maskToken,
  type WhatsAppConfig,
  type SMSConfig,
} from '../encryption';

const router = Router();

// ===== Integration Routes =====

/**
 * Get integration configuration for a tenant
 *
 * Returns WhatsApp, SMS, and N8N configurations with masked sensitive data
 *
 * GET /api/platform/tenants/:tenantId/integrations
 */
router.get(
  '/:tenantId/integrations',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Get integration config
      const integration = await storage.getTenantIntegration(tenantId);

      if (!integration) {
        // Return empty/default config if not yet configured
        return res.json({
          tenantId,
          whatsappEnabled: false,
          whatsappConfig: null,
          smsEnabled: false,
          smsConfig: null,
          n8nBaseUrl: null,
        });
      }

      // Decrypt and mask sensitive fields before sending to frontend
      const maskedIntegration = {
        id: integration.id,
        tenantId: integration.tenantId,
        n8nBaseUrl: integration.n8nBaseUrl,
        n8nApiKey: integration.n8nApiKey ? maskToken(integration.n8nApiKey) : null,
        whatsappEnabled: integration.whatsappEnabled,
        whatsappConfig: integration.whatsappConfig
          ? maskWhatsAppConfig(decryptWhatsAppConfig(integration.whatsappConfig as any))
          : null,
        smsEnabled: integration.smsEnabled,
        smsConfig: integration.smsConfig
          ? maskSMSConfig(decryptSMSConfig(integration.smsConfig as any))
          : null,
        updatedAt: integration.updatedAt,
        createdAt: integration.createdAt,
      };

      res.json(maskedIntegration);
    } catch (error) {
      console.error('Error fetching tenant integrations:', error);
      res.status(500).json({ error: 'Failed to fetch integration configuration' });
    }
  },
);

/**
 * Update WhatsApp configuration for a tenant
 *
 * Enables/disables WhatsApp and manages encrypted credentials
 *
 * PUT /api/platform/tenants/:tenantId/integrations/whatsapp
 */
router.put(
  '/:tenantId/integrations/whatsapp',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Validate WhatsApp config
      const whatsappConfigSchema = z.object({
        enabled: z.boolean(),
        phoneNumberId: z.string().optional(),
        businessAccountId: z.string().optional(),
        accessToken: z.string().optional(),
        webhookVerifyToken: z.string().optional(),
        phoneNumber: z.string().optional(),
      });

      const data = whatsappConfigSchema.parse(req.body);

      // Get or create integration config
      let integration = await storage.getTenantIntegration(tenantId);

      if (!data.enabled) {
        // Disable WhatsApp
        if (integration) {
          await storage.updateTenantIntegration(tenantId, {
            whatsappEnabled: false,
            whatsappConfig: null,
            updatedBy: req.user!.userId,
          });
        } else {
          await storage.createTenantIntegration({
            tenantId,
            whatsappEnabled: false,
            whatsappConfig: null,
            createdBy: req.user!.userId,
            updatedBy: req.user!.userId,
          });
        }

        return res.json({ success: true, message: 'WhatsApp integration disabled' });
      }

      // Get existing config if updating
      const existingConfig = integration?.whatsappConfig
        ? decryptWhatsAppConfig(integration.whatsappConfig as any)
        : null;

      // Validate required fields when enabling (for new config or when fields are provided)
      const phoneNumberId = data.phoneNumberId || existingConfig?.phoneNumberId;
      const businessAccountId = data.businessAccountId || existingConfig?.businessAccountId;
      const accessToken = data.accessToken || existingConfig?.accessToken;
      const webhookVerifyToken = data.webhookVerifyToken || existingConfig?.webhookVerifyToken;
      const phoneNumber = data.phoneNumber || existingConfig?.phoneNumber;

      if (!phoneNumberId || !businessAccountId || !accessToken || !webhookVerifyToken) {
        return res.status(400).json({
          error: 'All WhatsApp fields are required when enabling integration',
        });
      }

      // Create WhatsApp config object (merge with existing if present)
      const whatsappConfig: WhatsAppConfig = {
        phoneNumberId,
        businessAccountId,
        accessToken,
        webhookVerifyToken,
        phoneNumber,
      };

      // Encrypt sensitive fields
      const encryptedConfig = encryptWhatsAppConfig(whatsappConfig);

      if (integration) {
        // Update existing
        await storage.updateTenantIntegration(tenantId, {
          whatsappEnabled: true,
          whatsappConfig: encryptedConfig as any,
          updatedBy: req.user!.userId,
        });
      } else {
        // Create new
        await storage.createTenantIntegration({
          tenantId,
          whatsappEnabled: true,
          whatsappConfig: encryptedConfig as any,
          createdBy: req.user!.userId,
          updatedBy: req.user!.userId,
        });
      }

      res.json({ success: true, message: 'WhatsApp integration configured successfully' });
    } catch (error) {
      console.error('Error configuring WhatsApp integration:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to configure WhatsApp integration' });
      }
    }
  },
);

/**
 * Update SMS configuration for a tenant
 *
 * Supports Twilio, Vonage, and AWS SNS providers
 *
 * PUT /api/platform/tenants/:tenantId/integrations/sms
 */
router.put(
  '/:tenantId/integrations/sms',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Validate SMS config
      const smsConfigSchema = z.object({
        enabled: z.boolean(),
        provider: z.enum(['twilio', 'vonage', 'aws_sns']).optional(),
        accountSid: z.string().min(1).optional(),
        authToken: z.string().min(1).optional(),
        phoneNumber: z.string().min(1).optional(),
        messagingServiceSid: z.string().optional(),
      });

      const data = smsConfigSchema.parse(req.body);

      // Get or create integration config
      let integration = await storage.getTenantIntegration(tenantId);

      if (!data.enabled) {
        // Disable SMS
        if (integration) {
          await storage.updateTenantIntegration(tenantId, {
            smsEnabled: false,
            smsConfig: null,
            updatedBy: req.user!.userId,
          });
        } else {
          await storage.createTenantIntegration({
            tenantId,
            smsEnabled: false,
            smsConfig: null,
            createdBy: req.user!.userId,
            updatedBy: req.user!.userId,
          });
        }
        return res.json({ success: true, message: 'SMS integration disabled' });
      }

      // Validate required fields when enabling
      if (!data.provider || !data.accountSid || !data.authToken || !data.phoneNumber) {
        return res.status(400).json({
          error: 'Provider, accountSid, authToken, and phoneNumber are required when enabling SMS',
        });
      }

      // Create SMS config object
      const smsConfig: SMSConfig = {
        provider: data.provider,
        accountSid: data.accountSid,
        authToken: data.authToken,
        phoneNumber: data.phoneNumber,
        messagingServiceSid: data.messagingServiceSid,
      };

      // Encrypt sensitive fields
      const encryptedConfig = encryptSMSConfig(smsConfig);

      if (integration) {
        // Update existing
        await storage.updateTenantIntegration(tenantId, {
          smsEnabled: true,
          smsConfig: encryptedConfig as any,
          updatedBy: req.user!.userId,
        });
      } else {
        // Create new
        await storage.createTenantIntegration({
          tenantId,
          smsEnabled: true,
          smsConfig: encryptedConfig as any,
          createdBy: req.user!.userId,
          updatedBy: req.user!.userId,
        });
      }

      res.json({ success: true, message: 'SMS integration configured successfully' });
    } catch (error) {
      console.error('Error configuring SMS integration:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to configure SMS integration' });
      }
    }
  },
);

/**
 * Update N8N base URL for a tenant
 *
 * Configures N8N webhook integration with optional API key
 *
 * PUT /api/platform/tenants/:tenantId/integrations/n8n
 */
router.put(
  '/:tenantId/integrations/n8n',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Validate N8N config
      const n8nConfigSchema = z.object({
        baseUrl: z.string().url().optional().nullable(),
        apiKey: z.string().optional().nullable(),
      });

      const data = n8nConfigSchema.parse(req.body);

      // Get or create integration config
      let integration = await storage.getTenantIntegration(tenantId);

      const updates: any = {
        n8nBaseUrl: data.baseUrl || null,
        updatedBy: req.user!.userId,
      };

      // Encrypt API key if provided
      if (data.apiKey) {
        updates.n8nApiKey = encrypt(data.apiKey);
      } else if (data.apiKey === null) {
        updates.n8nApiKey = null;
      }

      if (integration) {
        await storage.updateTenantIntegration(tenantId, updates);
      } else {
        await storage.createTenantIntegration({
          tenantId,
          ...updates,
          createdBy: req.user!.userId,
        });
      }

      res.json({ success: true, message: 'N8N configuration updated successfully' });
    } catch (error) {
      console.error('Error configuring N8N integration:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to configure N8N integration' });
      }
    }
  },
);

// ===== N8N Webhook Routes =====

/**
 * Get all N8N webhooks for a tenant
 *
 * Returns webhooks with masked auth tokens
 *
 * GET /api/platform/tenants/:tenantId/webhooks
 */
router.get(
  '/:tenantId/webhooks',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const webhooks = await storage.getN8nWebhooksByTenant(tenantId);

      // Mask auth tokens
      const maskedWebhooks = webhooks.map((webhook: any) => ({
        ...webhook,
        authToken: webhook.authToken ? maskToken(webhook.authToken) : null,
      }));

      res.json(maskedWebhooks);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({ error: 'Failed to fetch webhooks' });
    }
  },
);

/**
 * Create a new N8N webhook
 *
 * Supports event_listener and function_call webhook types
 *
 * POST /api/platform/tenants/:tenantId/webhooks
 */
router.post(
  '/:tenantId/webhooks',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Validate webhook data
      const webhookSchema = z.object({
        workflowName: z.string().min(1),
        webhookUrl: z.string().url(),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
        authToken: z.string().optional(),
        webhookType: z.enum(['event_listener', 'function_call']).default('event_listener'),
        eventType: z.string().optional(),
        functionName: z.string().optional(),
        responseTimeout: z.number().min(1000).max(30000).optional(),
        retryOnFailure: z.boolean().optional(),
      });

      const data = webhookSchema.parse(req.body);

      // Check for duplicate workflow name
      const existing = await storage.getN8nWebhookByName(tenantId, data.workflowName);
      if (existing) {
        return res.status(400).json({
          error: `Webhook with workflow name "${data.workflowName}" already exists for this tenant`,
        });
      }

      // Encrypt auth token if provided
      const webhookData: any = {
        tenantId,
        workflowName: data.workflowName,
        webhookUrl: data.webhookUrl,
        description: data.description || null,
        isActive: data.isActive,
        authToken: data.authToken ? encrypt(data.authToken) : null,
        webhookType: data.webhookType,
        eventType: data.eventType || null,
        functionName: data.functionName || null,
        responseTimeout: data.responseTimeout || null,
        retryOnFailure: data.retryOnFailure ?? false,
        createdBy: req.user!.userId,
      };

      const webhook = await storage.createN8nWebhook(webhookData);

      res.status(201).json({
        ...webhook,
        authToken: webhook.authToken ? maskToken(webhook.authToken) : null,
      });
    } catch (error) {
      console.error('Error creating webhook:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create webhook' });
      }
    }
  },
);

/**
 * Update an N8N webhook
 *
 * PUT /api/platform/tenants/:tenantId/webhooks/:webhookId
 */
router.put(
  '/:tenantId/webhooks/:webhookId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, webhookId } = req.params;

      // Verify webhook exists and belongs to tenant
      const webhook = await storage.getN8nWebhook(webhookId);
      if (!webhook || webhook.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      // Validate update data
      const webhookUpdateSchema = z.object({
        workflowName: z.string().min(1).optional(),
        webhookUrl: z.string().url().optional(),
        description: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
        authToken: z.string().optional().nullable(),
        webhookType: z.enum(['event_listener', 'function_call']).optional(),
        eventType: z.string().optional().nullable(),
        functionName: z.string().optional().nullable(),
        responseTimeout: z.number().min(1000).max(30000).optional().nullable(),
        retryOnFailure: z.boolean().optional(),
      });

      const data = webhookUpdateSchema.parse(req.body);

      // Check for duplicate workflow name if changing
      if (data.workflowName && data.workflowName !== webhook.workflowName) {
        const existing = await storage.getN8nWebhookByName(tenantId, data.workflowName);
        if (existing) {
          return res.status(400).json({
            error: `Webhook with workflow name "${data.workflowName}" already exists for this tenant`,
          });
        }
      }

      const updates: any = { ...data };

      // Encrypt auth token if provided
      if (data.authToken !== undefined) {
        updates.authToken = data.authToken ? encrypt(data.authToken) : null;
      }

      const updated = await storage.updateN8nWebhook(webhookId, updates);

      res.json({
        ...updated,
        authToken: updated?.authToken ? maskToken(updated.authToken) : null,
      });
    } catch (error) {
      console.error('Error updating webhook:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update webhook' });
      }
    }
  },
);

/**
 * Delete an N8N webhook
 *
 * DELETE /api/platform/tenants/:tenantId/webhooks/:webhookId
 */
router.delete(
  '/:tenantId/webhooks/:webhookId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, webhookId } = req.params;

      // Verify webhook exists and belongs to tenant
      const webhook = await storage.getN8nWebhook(webhookId);
      if (!webhook || webhook.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      await storage.deleteN8nWebhook(webhookId, tenantId);

      res.json({ success: true, message: 'Webhook deleted successfully' });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  },
);

/**
 * Get webhook analytics summary for a tenant
 *
 * GET /api/platform/tenants/:tenantId/webhooks/analytics/summary
 */
router.get(
  '/:tenantId/webhooks/analytics/summary',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { startDate, endDate } = req.query;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      const summary = await storage.getWebhookAnalyticsSummary(tenantId, start, end);

      res.json(summary);
    } catch (error) {
      console.error('Error fetching webhook analytics summary:', error);
      res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  },
);

/**
 * Get detailed analytics for a specific webhook
 *
 * GET /api/platform/tenants/:tenantId/webhooks/:webhookId/analytics
 */
router.get(
  '/:tenantId/webhooks/:webhookId/analytics',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, webhookId } = req.params;
      const { limit } = req.query;

      // Verify webhook exists and belongs to tenant
      const webhook = await storage.getN8nWebhook(webhookId);
      if (!webhook || webhook.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Webhook not found' });
      }

      const analytics = await storage.getWebhookAnalytics(
        webhookId,
        limit ? parseInt(limit as string) : undefined,
      );

      res.json(analytics);
    } catch (error) {
      console.error('Error fetching webhook analytics:', error);
      res.status(500).json({ error: 'Failed to fetch webhook analytics' });
    }
  },
);

// ===== External API Configuration Routes =====

/**
 * Get all external API configurations for a tenant
 *
 * Lists all configured external APIs with masked credentials
 *
 * GET /api/platform/tenants/:tenantId/external-apis
 */
router.get(
  '/:tenantId/external-apis',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Platform admins can access any tenant, regular users only their own
      if (!req.user?.isPlatformAdmin) {
        const userTenantId = req.user?.tenantId;
        if (!userTenantId) {
          return res.status(401).json({ error: 'Invalid token: missing tenant ID' });
        }
        if (userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }
      }

      const configs = await storage.listExternalApiConfigs(tenantId);

      // Return safe configuration (mask credentials)
      const safeConfigs = configs.map((config) => ({
        id: config.id,
        serviceName: config.serviceName,
        displayName: config.displayName,
        baseUrl: config.baseUrl,
        authType: config.authType,
        description: config.description,
        isActive: config.isActive,
        lastUsedAt: config.lastUsedAt,
        totalCalls: config.totalCalls,
        successfulCalls: config.successfulCalls,
        failedCalls: config.failedCalls,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        // Don't expose encrypted credentials or custom headers
      }));

      res.json(safeConfigs);
    } catch (error) {
      console.error('[External API] Error listing configurations:', error);
      res.status(500).json({ error: 'Failed to list external API configurations' });
    }
  },
);

/**
 * Create external API configuration
 *
 * Creates a new external API configuration with encrypted credentials
 *
 * POST /api/platform/tenants/:tenantId/external-apis
 */
router.post(
  '/:tenantId/external-apis',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const {
        serviceName,
        displayName,
        baseUrl,
        authType,
        credentials,
        customHeaders,
        description,
      } = req.body;

      // Platform admins can access any tenant, regular users only their own
      if (!req.user?.isPlatformAdmin) {
        const userTenantId = req.user?.tenantId;
        if (!userTenantId) {
          return res.status(401).json({ error: 'Invalid token: missing tenant ID' });
        }
        if (userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }
      }

      // Validate required fields
      if (!serviceName || !displayName || !baseUrl || !authType) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Service name, display name, base URL, and auth type are required',
        });
      }

      // Check if service name already exists for this tenant
      const existing = await storage.getExternalApiConfig(tenantId, serviceName);
      if (existing) {
        return res.status(400).json({
          error: 'Service name already exists',
          message: `Service '${serviceName}' is already configured for this tenant`,
        });
      }

      // Encrypt credentials if provided
      let encryptedCredentials = null;
      if (credentials && authType !== 'none') {
        encryptedCredentials = encrypt(JSON.stringify(credentials));
      }

      // Create configuration
      const config = await storage.createExternalApiConfig({
        tenantId,
        serviceName,
        displayName,
        baseUrl,
        authType,
        encryptedCredentials,
        customHeaders: customHeaders || null,
        description: description || null,
        isActive: true,
        createdBy: req.user?.userId || null,
      });

      console.log('[External API] Created configuration:', serviceName, 'for tenant:', tenantId);

      res.json({
        id: config.id,
        serviceName: config.serviceName,
        displayName: config.displayName,
        baseUrl: config.baseUrl,
        authType: config.authType,
        description: config.description,
        isActive: config.isActive,
        createdAt: config.createdAt,
      });
    } catch (error) {
      console.error('[External API] Error creating configuration:', error);
      res.status(500).json({ error: 'Failed to create external API configuration' });
    }
  },
);

/**
 * Update external API configuration
 *
 * Updates an existing external API configuration
 *
 * PUT /api/platform/tenants/:tenantId/external-apis/:id
 */
router.put(
  '/:tenantId/external-apis/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, id } = req.params;
      const {
        displayName,
        baseUrl,
        authType,
        credentials,
        customHeaders,
        description,
        isActive,
      } = req.body;

      // Platform admins can access any tenant, regular users only their own
      if (!req.user?.isPlatformAdmin) {
        const userTenantId = req.user?.tenantId;
        if (!userTenantId) {
          return res.status(401).json({ error: 'Invalid token: missing tenant ID' });
        }
        if (userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }
      }

      // Prepare updates
      const updates: any = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (baseUrl !== undefined) updates.baseUrl = baseUrl;
      if (authType !== undefined) updates.authType = authType;
      if (description !== undefined) updates.description = description;
      if (isActive !== undefined) updates.isActive = isActive;

      // Update credentials if provided
      if (credentials !== undefined) {
        if (authType === 'none') {
          updates.encryptedCredentials = null;
        } else {
          updates.encryptedCredentials = encrypt(JSON.stringify(credentials));
        }
      }

      // Update custom headers if provided
      if (customHeaders !== undefined) {
        updates.customHeaders = customHeaders;
      }

      const updated = await storage.updateExternalApiConfig(id, updates);

      if (!updated) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      console.log('[External API] Updated configuration:', id);

      res.json({
        id: updated.id,
        serviceName: updated.serviceName,
        displayName: updated.displayName,
        baseUrl: updated.baseUrl,
        authType: updated.authType,
        description: updated.description,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      console.error('[External API] Error updating configuration:', error);
      res.status(500).json({ error: 'Failed to update external API configuration' });
    }
  },
);

/**
 * Delete external API configuration
 *
 * Removes an external API configuration
 *
 * DELETE /api/platform/tenants/:tenantId/external-apis/:id
 */
router.delete(
  '/:tenantId/external-apis/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, id } = req.params;

      // Platform admins can access any tenant, regular users only their own
      if (!req.user?.isPlatformAdmin) {
        const userTenantId = req.user?.tenantId;
        if (!userTenantId) {
          return res.status(401).json({ error: 'Invalid token: missing tenant ID' });
        }
        if (userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }
      }

      await storage.deleteExternalApiConfig(id);

      console.log('[External API] Deleted configuration:', id);

      res.json({ success: true });
    } catch (error) {
      console.error('[External API] Error deleting configuration:', error);
      res.status(500).json({ error: 'Failed to delete external API configuration' });
    }
  },
);

export default router;
