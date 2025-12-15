/**
 * Retell AI Agent Management Routes
 * Handles syncing agents from Retell API and configuring tenant agent assignments
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { decryptApiKey } from '../encryption';
import { z } from 'zod';

const router = Router();

// Validation schema for agent configuration
const agentConfigSchema = z.object({
  agents: z.array(
    z.object({
      agentId: z.string(),
      channel: z.enum(['inbound', 'outbound']),
    }),
  ),
});

/**
 * GET /api/platform/tenants/:tenantId/retell/agents
 * Fetch agents from Retell AI API and merge with tenant's current configuration
 */
router.get('/:tenantId/retell/agents', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Get tenant to access Retell API key from widget_configs (where it's actually stored)
    const widgetConfig = await storage.getWidgetConfig(tenantId);

    console.log('[Retell Agents] Widget config:', {
      exists: !!widgetConfig,
      hasRetellApiKey: !!widgetConfig?.retellApiKey,
      retellApiKeyType: typeof widgetConfig?.retellApiKey,
      retellApiKeyLength: widgetConfig?.retellApiKey?.length,
    });

    if (!widgetConfig) {
      return res.status(404).json({ error: 'Tenant configuration not found' });
    }

    if (!widgetConfig.retellApiKey) {
      return res.status(400).json({
        error: 'Retell API key not configured',
        message: 'Please configure your Retell API key first',
      });
    }

    console.log(`[Retell Agents] Fetching agents for tenant: ${tenantId}`);

    // The API key from widget_configs is already decrypted by the storage layer
    const decryptedApiKey = widgetConfig.retellApiKey;

    // Fetch agents from Retell API
    const retellResponse = await fetch('https://api.retellai.com/list-agents', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error('[Retell Agents] Retell API error:', retellResponse.status, errorText);
      return res.status(retellResponse.status).json({
        error: 'Failed to fetch agents from Retell',
        details: errorText,
      });
    }

    const retellAgents = await retellResponse.json();
    console.log(`[Retell Agents] Found ${retellAgents.length} agents from Retell API`);

    // Check for duplicates in Retell API response
    const agentIds = retellAgents.map((a: any) => a.agent_id);
    const uniqueIds = new Set(agentIds);
    console.log(`[Retell Agents] Unique agent IDs: ${uniqueIds.size} (total: ${agentIds.length})`);

    if (agentIds.length !== uniqueIds.size) {
      console.warn('[Retell Agents] ⚠️  DUPLICATES FOUND in Retell API response!');
      const duplicates = agentIds.filter((id: string, idx: number) => agentIds.indexOf(id) !== idx);
      console.warn('[Retell Agents] Duplicate IDs:', Array.from(new Set(duplicates)));
    }

    // Get currently configured agents for this tenant
    const configuredAgents = await storage.getTenantAgents(tenantId);
    console.log(`[Retell Agents] Tenant has ${configuredAgents.length} configured agents`);
    console.log(
      '[Retell Agents] Configured agents:',
      JSON.stringify(
        configuredAgents.map((a) => ({
          id: a.id,
          agentId: a.agentId,
          channel: a.channel,
          isActive: a.isActive,
        })),
        null,
        2,
      ),
    );

    // Deduplicate agents by agent_id (Retell API returns duplicates)
    const uniqueAgentsMap = new Map();
    retellAgents.forEach((agent: any) => {
      if (!uniqueAgentsMap.has(agent.agent_id)) {
        uniqueAgentsMap.set(agent.agent_id, agent);
      }
    });
    const deduplicatedAgents = Array.from(uniqueAgentsMap.values());
    console.log(`[Retell Agents] After deduplication: ${deduplicatedAgents.length} unique agents`);

    // Merge Retell data with tenant configuration
    const agentsWithStatus = deduplicatedAgents.map((agent: any) => {
      const configured = configuredAgents.find((ca) => ca.agentId === agent.agent_id);

      return {
        agentId: agent.agent_id,
        agentName: agent.agent_name,
        voice: agent.voice_id,
        voiceTemperature: agent.voice_temperature,
        responsiveness: agent.responsiveness,
        enabled: !!configured,
        channel: configured?.channel || 'inbound', // Default to inbound
        isActive: configured?.isActive ?? true,
      };
    });

    return res.json({
      agents: agentsWithStatus,
      totalAgents: retellAgents.length,
      configuredCount: configuredAgents.length,
    });
  } catch (error: any) {
    console.error('[Retell Agents] Error fetching agents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to fetch agents',
    });
  }
});

/**
 * POST /api/platform/tenants/:tenantId/retell/agents/sync
 * Save selected agents with their channel assignments
 */
router.post('/:tenantId/retell/agents/sync', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validation = agentConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { agents } = validation.data;

    console.log(`[Retell Agents] Syncing ${agents.length} agents for tenant: ${tenantId}`);

    // Verify tenant exists and get API key
    const widgetConfig = await storage.getWidgetConfig(tenantId);
    if (!widgetConfig?.retellApiKey) {
      return res.status(400).json({ error: 'Retell API key not configured' });
    }

    // Fetch agent details from Retell API to get agent names
    const retellResponse = await fetch('https://api.retellai.com/list-agents', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${widgetConfig.retellApiKey}`,
      },
    });

    if (!retellResponse.ok) {
      return res.status(retellResponse.status).json({
        error: 'Failed to fetch agents from Retell',
      });
    }

    const retellAgents = await retellResponse.json();
    const agentNameMap = new Map<string, string>(
      retellAgents.map((a: any) => [a.agent_id, a.agent_name]),
    );

    // Upsert agent configurations (add or update, don't clear existing ones)
    const savedAgents = [];
    for (const agent of agents) {
      const agentName: string = agentNameMap.get(agent.agentId) || 'Unknown Agent';

      // Check if agent already exists
      const existingAgents = await storage.getTenantAgents(tenantId);
      const existing = existingAgents.find((a) => a.agentId === agent.agentId);

      if (existing) {
        // Update existing agent
        const updated = await storage.updateTenantAgent(existing.id, {
          channel: agent.channel,
          agentName: agentName,
          isActive: true,
        });
        if (updated) savedAgents.push(updated);
      } else {
        // Add new agent
        const added = await storage.addTenantAgent({
          tenantId,
          agentId: agent.agentId,
          agentName: agentName,
          channel: agent.channel,
          isActive: true,
        });
        savedAgents.push(added);
      }
    }

    console.log(`[Retell Agents] Successfully configured ${savedAgents.length} agents`);

    return res.json({
      success: true,
      configuredAgents: savedAgents,
      message: `Successfully configured ${savedAgents.length} agents`,
    });
  } catch (error: any) {
    console.error('[Retell Agents] Error syncing agents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to sync agents',
    });
  }
});

/**
 * GET /api/platform/tenants/:tenantId/retell/agents/configured
 * Get list of configured agents for a tenant (without calling Retell API)
 */
router.get('/:tenantId/retell/agents/configured', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const agents = await storage.getTenantAgents(tenantId);

    return res.json({
      agents,
      count: agents.length,
    });
  } catch (error: any) {
    console.error('[Retell Agents] Error fetching configured agents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to fetch configured agents',
    });
  }
});

/**
 * PUT /api/platform/tenants/:tenantId/retell-api-key
 * Update tenant's Retell API key
 */
router.put('/:tenantId/retell-api-key', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'API key is required' });
    }

    console.log(`[Retell API Key] Updating for tenant: ${tenantId}`);

    // Update tenant's Retell API key
    const updated = await storage.updateTenant(tenantId, { retellApiKey: apiKey });

    if (!updated) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    return res.json({
      success: true,
      message: 'Retell API key updated successfully',
    });
  } catch (error: any) {
    console.error('[Retell API Key] Error updating:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to update API key',
    });
  }
});

export default router;
