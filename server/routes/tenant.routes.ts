/**
 * Tenant Management Routes
 * Platform admin operations for managing tenants
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  type AuthenticatedRequest,
  requireAuth,
  requirePlatformAdmin,
} from '../middleware/auth.middleware';

const router = Router();

// All routes are prefixed with /api/platform/tenants by the main router

/**
 * GET /
 * Get all tenants
 */
router.get(
  '/',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenants = await storage.getAllTenants();

      // Get widget configs to check if Retell API key is set
      const tenantsWithApiKeyStatus = await Promise.all(
        tenants.map(async (tenant) => {
          const widgetConfig = await storage.getWidgetConfig(tenant.id);

          // Mask the Retell API key
          let maskedRetellApiKey = null;
          if (widgetConfig?.retellApiKey) {
            const underscoreIndex = widgetConfig.retellApiKey.indexOf('_');
            if (underscoreIndex !== -1 && widgetConfig.retellApiKey.length > underscoreIndex + 8) {
              const visiblePart = widgetConfig.retellApiKey.substring(0, underscoreIndex + 9);
              maskedRetellApiKey = `${visiblePart}********`;
            } else {
              maskedRetellApiKey = `${widgetConfig.retellApiKey.substring(0, 12)}********`;
            }
          }

          // Mask the Agent ID
          let maskedAgentId = null;
          if (widgetConfig?.retellAgentId) {
            const underscoreIndex = widgetConfig.retellAgentId.indexOf('_');
            if (underscoreIndex !== -1 && widgetConfig.retellAgentId.length > underscoreIndex + 8) {
              const visiblePart = widgetConfig.retellAgentId.substring(0, underscoreIndex + 9);
              maskedAgentId = `${visiblePart}********`;
            } else {
              maskedAgentId = `${widgetConfig.retellAgentId.substring(0, 12)}********`;
            }
          }

          // Mask WhatsApp Agent ID
          let maskedWhatsappAgentId = '';
          if (widgetConfig?.whatsappAgentId) {
            const underscoreIndex = widgetConfig.whatsappAgentId.indexOf('_');
            if (
              underscoreIndex !== -1 &&
              widgetConfig.whatsappAgentId.length > underscoreIndex + 8
            ) {
              const visiblePart = widgetConfig.whatsappAgentId.substring(0, underscoreIndex + 9);
              maskedWhatsappAgentId = `${visiblePart}********`;
            } else {
              maskedWhatsappAgentId = `${widgetConfig.whatsappAgentId.substring(0, 12)}********`;
            }
          }

          return {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            phone: tenant.phone,
            plan: tenant.plan,
            status: tenant.status,
            hasRetellApiKey: !!widgetConfig?.retellApiKey,
            hasRetellAgentId: !!widgetConfig?.retellAgentId,
            hasWhatsappAgentId: !!widgetConfig?.whatsappAgentId,
            retellApiKey: maskedRetellApiKey,
            retellAgentId: widgetConfig?.retellAgentId || null,
            maskedRetellApiKey,
            maskedAgentId,
            maskedWhatsappAgentId,
            createdAt: tenant.createdAt,
          };
        }),
      );

      res.json(tenantsWithApiKeyStatus);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      res.status(500).json({ error: 'Failed to fetch tenants' });
    }
  },
);

/**
 * PATCH /:tenantId/retell-api-key
 * Update tenant's Retell API key and agent IDs
 */
router.patch(
  '/:tenantId/retell-api-key',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { retellApiKey, retellAgentId, whatsappAgentId } = req.body;

      // Validate Retell API key format if provided
      if (retellApiKey && retellApiKey !== '__KEEP_EXISTING__') {
        if (typeof retellApiKey !== 'string') {
          return res.status(400).json({ error: 'Retell API key must be a string' });
        }

        if (!retellApiKey.trim().startsWith('key_')) {
          return res.status(400).json({
            error: 'Invalid Retell API key format. API keys must start with "key_"',
          });
        }
      }

      // Validate Retell Agent ID format if provided
      if (retellAgentId) {
        if (typeof retellAgentId !== 'string') {
          return res.status(400).json({ error: 'Retell Agent ID must be a string' });
        }

        if (!retellAgentId.trim().startsWith('agent_')) {
          return res.status(400).json({
            error:
              'Invalid Retell Agent ID format. Agent IDs must start with "agent_". Did you accidentally provide an API key instead?',
          });
        }
      }

      // Validate WhatsApp Agent ID format if provided
      if (whatsappAgentId) {
        if (typeof whatsappAgentId !== 'string') {
          return res.status(400).json({ error: 'WhatsApp Agent ID must be a string' });
        }

        if (!whatsappAgentId.trim().startsWith('agent_')) {
          return res.status(400).json({
            error:
              'Invalid WhatsApp Agent ID format. Agent IDs must start with "agent_". Did you accidentally provide an API key instead?',
          });
        }
      }

      // Check if tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Get or create widget config for this tenant
      let widgetConfig = await storage.getWidgetConfig(tenantId);

      const updateData: any = {};

      // Only update API key if provided and not the sentinel value
      if (retellApiKey && retellApiKey.trim() !== '__KEEP_EXISTING__') {
        updateData.retellApiKey = retellApiKey.trim();
      }

      // Include retellAgentId if provided and not empty
      if (retellAgentId && retellAgentId.trim()) {
        updateData.retellAgentId = retellAgentId.trim();
      }

      // Include whatsappAgentId if provided and not empty
      if (whatsappAgentId && whatsappAgentId.trim()) {
        updateData.whatsappAgentId = whatsappAgentId.trim();
      }

      // Check if we have anything to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          error: 'No updates provided. Please provide API key, Agent ID, or WhatsApp Agent ID.',
        });
      }

      if (!widgetConfig) {
        // Create a new widget config - must have actual API key
        if (!updateData.retellApiKey) {
          return res
            .status(400)
            .json({ error: 'Retell API key is required for new configuration' });
        }
        widgetConfig = await storage.createWidgetConfig({
          tenantId,
          ...updateData,
        });
      } else {
        // Update existing widget config (only provided fields)
        widgetConfig = await storage.updateWidgetConfig(tenantId, updateData);
      }

      if (!widgetConfig) {
        return res.status(500).json({ error: 'Failed to update Retell API key' });
      }

      res.json({
        message: 'Retell API key updated successfully',
        tenantId,
      });
    } catch (error) {
      console.error('Error updating Retell API key:', error);
      res.status(500).json({ error: 'Failed to update Retell API key' });
    }
  },
);

/**
 * DELETE /:tenantId
 * Delete tenant
 */
router.delete(
  '/:tenantId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      console.log(`[Delete Tenant] Attempting to delete tenant: ${tenantId}`);

      // Get tenant info before deletion for logging
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Get all client admins for this tenant
      const allUsers = await storage.getAllUsers();
      const tenantClientAdmins = allUsers.filter(
        (user) => user.tenantId === tenantId && user.role === 'client_admin',
      );

      console.log(
        `[Delete Tenant] Found ${tenantClientAdmins.length} client admin(s) in tenant ${tenant.name}`,
      );

      // Delete all client admins (and their support staff) in this tenant
      for (const clientAdmin of tenantClientAdmins) {
        console.log(
          `[Delete Tenant] Deleting client admin and associated data: ${clientAdmin.email}`,
        );
        await storage.deleteClientUser(clientAdmin.id);
      }

      // Delete the tenant itself (cascade deletes widget config, API keys, etc.)
      console.log(`[Delete Tenant] Deleting tenant: ${tenant.name}`);
      await storage.deleteTenant(tenantId);

      console.log(
        `[Delete Tenant] ✓ Successfully deleted tenant: ${tenant.name} and all associated data`,
      );

      res.json({
        message: 'Tenant deleted successfully',
        tenantId,
        tenantName: tenant.name,
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      res.status(500).json({ error: 'Failed to delete tenant' });
    }
  },
);

export default router;
