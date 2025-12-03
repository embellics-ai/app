/**
 * Miscellaneous Routes
 * Widget configuration, API keys, and health check
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireClientAdmin,
  assertTenant,
  hashPassword,
} from '../middleware/auth.middleware';
import {
  safeWidgetConfigCreateSchema,
  safeWidgetConfigUpdateSchema,
} from '@shared/schema';
import { randomBytes } from 'crypto';

const router = Router();

// ===== Widget Configuration Endpoints =====

// Get widget config for authenticated tenant (PROTECTED)
router.get(
  '/api/widget-config',
  requireAuth,
  requireClientAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const config = await storage.getWidgetConfig(tenantId);

      if (!config) {
        return res.status(404).json({ error: 'Widget configuration not found' });
      }

      // SECURITY: Client admins cannot view Retell AI credentials
      // Only platform admins can see retellApiKey and retellAgentId
      // Strip these sensitive fields from the response
      const { retellApiKey, retellAgentId, ...safeConfig } = config;

      res.json(safeConfig);
    } catch (error) {
      console.error('Error fetching widget config:', error);
      res.status(500).json({ error: 'Failed to fetch widget configuration' });
    }
  },
);

// Create widget config for authenticated tenant (PROTECTED)
router.post(
  '/api/widget-config',
  requireAuth,
  requireClientAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      // Check if config already exists
      const existingConfig = await storage.getWidgetConfig(tenantId);
      if (existingConfig) {
        return res.status(400).json({
          error: 'Widget configuration already exists. Use PATCH to update.',
        });
      }

      // SECURITY: Reject requests that include Retell AI credentials
      // Client admins cannot set retellApiKey or retellAgentId
      // Only platform admins can configure these during client onboarding
      if ('retellApiKey' in req.body || 'retellAgentId' in req.body) {
        return res.status(400).json({
          error: 'Client admins cannot configure Retell AI credentials. Contact platform admin.',
        });
      }

      // Parse and validate request body using safe create schema
      const validatedData = safeWidgetConfigCreateSchema.parse(req.body);

      // Create config with server-injected tenantId (without Retell credentials)
      const config = await storage.createWidgetConfig({
        ...validatedData,
        tenantId,
      });

      // Return safe config (Retell credentials excluded by type)
      const { retellApiKey, retellAgentId, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      console.error('Error creating widget config:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: 'Failed to create widget configuration' });
    }
  },
);

// Update widget config for authenticated tenant (PROTECTED)
router.patch(
  '/api/widget-config',
  requireAuth,
  requireClientAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      // SECURITY: Reject requests that include Retell AI credentials
      // Client admins cannot update retellApiKey or retellAgentId
      // Only platform admins can configure these during client onboarding
      if ('retellApiKey' in req.body || 'retellAgentId' in req.body) {
        return res.status(400).json({
          error: 'Client admins cannot modify Retell AI credentials. Contact platform admin.',
        });
      }

      // Parse and validate request body using safe update schema (partial updates allowed)
      const validatedData = safeWidgetConfigUpdateSchema.parse(req.body);

      // Update config
      const config = await storage.updateWidgetConfig(tenantId, validatedData);

      if (!config) {
        return res.status(404).json({ error: 'Widget configuration not found' });
      }

      // Return safe config (Retell credentials excluded by type)
      const { retellApiKey, retellAgentId, ...safeConfig } = config;
      res.json(safeConfig);
    } catch (error) {
      console.error('Error updating widget config:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: 'Failed to update widget configuration' });
    }
  },
);

// ===== API Key Management Endpoints =====

// List all API keys for authenticated tenant (PROTECTED)
router.get(
  '/api/api-keys',
  requireAuth,
  requireClientAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const apiKeys = await storage.getApiKeysByTenant(tenantId);

      // Never return the key hash - only return safe fields
      const safeKeys = apiKeys.map((key) => ({
        id: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name,
        lastUsed: key.lastUsed,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
      }));

      res.json(safeKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: 'Failed to fetch API keys' });
    }
  },
);

// Generate a new API key for authenticated tenant (PROTECTED)
router.post(
  '/api/api-keys',
  requireAuth,
  requireClientAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      // Parse optional name from request
      const nameSchema = z.object({
        name: z.string().optional(),
      });
      const { name } = nameSchema.parse(req.body);

      // Generate a secure random API key (32 bytes = 64 hex chars)
      const apiKey = randomBytes(32).toString('hex');
      const keyPrefix = apiKey.substring(0, 8); // First 8 chars for display
      const fullApiKey = `embellics_${apiKey}`;

      // Hash the FULL API key (with embellics_ prefix) using bcrypt for secure storage
      const keyHash = await hashPassword(fullApiKey);

      // Create API key record
      const apiKeyRecord = await storage.createApiKey({
        tenantId,
        keyHash,
        keyPrefix,
        name: name || null,
      });

      // Return the full API key ONLY on creation (never again)
      res.json({
        id: apiKeyRecord.id,
        apiKey: fullApiKey,
        keyPrefix: apiKeyRecord.keyPrefix,
        name: apiKeyRecord.name,
        createdAt: apiKeyRecord.createdAt,
        warning: "Save this API key now. You won't be able to see it again.",
      });
    } catch (error) {
      console.error('Error creating API key:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: 'Failed to create API key' });
    }
  },
);

// Delete an API key for authenticated tenant (PROTECTED)
router.delete(
  '/api/api-keys/:id',
  requireAuth,
  requireClientAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const { id } = req.params;

      // Delete the API key (storage layer ensures tenant isolation)
      await storage.deleteApiKey(id, tenantId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  },
);

// ===== Health Check =====

router.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
