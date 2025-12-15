/**
 * Dynamic N8N Webhook Routes
 * Unified webhook handler that routes ALL requests (events and functions) to N8N workflows
 * based on workflow name
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * POST /api/n8n/:workflowName
 * Universal webhook endpoint for all N8N integrations
 *
 * This endpoint:
 * 1. Receives ANY webhook/function call from external systems (Retell, WhatsApp, etc.)
 * 2. Resolves tenantId from agent_id in the payload
 * 3. Looks up the N8N webhook URL by workflow name
 * 4. Forwards the complete payload to the configured N8N workflow
 * 5. Returns N8N's response (for sync calls) or 200 OK (for async)
 *
 * Examples:
 * - POST /api/n8n/inbound-booking-call-analyzed
 * - POST /api/n8n/outbound-booking-call-ended
 * - POST /api/n8n/get-available-services
 * - POST /api/n8n/whatsapp-chat-analyzed
 */
router.post('/:workflowName', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { workflowName } = req.params;
  const payload = req.body;

  try {
    console.log('=================================================');
    console.log('[N8N Proxy] 🚀 REQUEST RECEIVED');
    console.log('[N8N Proxy] Workflow Name:', workflowName);
    console.log('[N8N Proxy] Full URL:', req.originalUrl);
    console.log('[N8N Proxy] Method:', req.method);
    console.log('[N8N Proxy] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[N8N Proxy] Payload:', JSON.stringify(payload, null, 2));
    console.log('=================================================');

    // Extract agent_id from various possible payload structures
    let agentId: string | undefined;

    // Try different payload structures
    if (payload.agent_id) {
      agentId = payload.agent_id;
    } else if (payload.chat?.agent_id) {
      agentId = payload.chat.agent_id;
    } else if (payload.call?.agent_id) {
      agentId = payload.call.agent_id;
    } else if (payload.body?.agent_id) {
      agentId = payload.body.agent_id;
    }

    if (!agentId) {
      console.error('[N8N Proxy] No agent_id found in payload');
      return res.status(400).json({
        error: 'Missing agent_id',
        message: 'Could not resolve tenant from payload. agent_id is required.',
      });
    }

    console.log('[N8N Proxy] Resolved agent_id:', agentId);

    // Lookup tenant from agent_id using new agent management system
    let tenantId: string;
    let agentInfo;

    // Try new system first (tenant_retell_agents table)
    const agentResult = await storage.getTenantByAgentId(agentId);
    if (agentResult) {
      tenantId = agentResult.tenantId;
      agentInfo = agentResult.agent;
      console.log(
        '[N8N Proxy] Resolved tenant from agent table:',
        tenantId,
        `(channel: ${agentInfo.channel})`,
      );
    } else {
      // Fallback to legacy widget_configs lookup for backward compatibility
      console.log('[N8N Proxy] Agent not found in tenant_retell_agents, trying widget_configs...');
      const widgetConfig = await storage.getWidgetConfigByAgentId(agentId);
      if (!widgetConfig) {
        console.error('[N8N Proxy] No configuration found for agent_id:', agentId);
        return res.status(404).json({
          error: 'Agent not found',
          message:
            'This agent is not configured for any tenant. Please configure it in the admin panel.',
        });
      }
      tenantId = widgetConfig.tenantId;
      console.log('[N8N Proxy] Resolved tenant from widget_configs (legacy):', tenantId);
    }

    // Get tenant details for enrichment
    const tenant = await storage.getTenant(tenantId);

    // Lookup N8N webhook by workflow name and tenant
    const webhook = await storage.getN8nWebhookByName(tenantId, workflowName);
    if (!webhook) {
      console.error(
        '[N8N Proxy] No webhook configured for workflow:',
        workflowName,
        'tenant:',
        tenantId,
      );
      return res.status(404).json({
        error: 'Workflow not configured',
        message: `No N8N webhook configured for workflow: ${workflowName}`,
      });
    }

    if (!webhook.isActive) {
      console.error('[N8N Proxy] Webhook is disabled:', workflowName);
      return res.status(403).json({
        error: 'Workflow disabled',
        message: `Webhook "${workflowName}" is currently disabled`,
      });
    }

    console.log('[N8N Proxy] Routing to N8N:', webhook.webhookUrl);

    // Enrich payload with tenant and agent context
    const enrichedPayload = {
      workflow: workflowName,
      tenant: {
        id: tenantId,
        name: tenant?.name || 'Unknown',
      },
      agent: agentInfo
        ? {
            id: agentInfo.agentId,
            name: agentInfo.agentName,
            channel: agentInfo.channel,
          }
        : {
            id: agentId,
            channel: 'unknown',
          },
      originalPayload: payload,
      timestamp: new Date().toISOString(),
    };

    // Set up request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-ID': tenantId,
      'X-Workflow-Name': workflowName,
    };

    // Add auth token if configured
    if (webhook.authToken) {
      headers['Authorization'] = `Bearer ${webhook.authToken}`;
    }

    // Forward to N8N
    const n8nResponse = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(enrichedPayload),
    });

    const responseTime = Date.now() - startTime;

    // Update webhook stats
    await storage.incrementWebhookStats(webhook.id, n8nResponse.ok);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('[N8N Proxy] N8N webhook returned error:', n8nResponse.status, errorText);
      return res.status(n8nResponse.status).json({
        error: 'N8N workflow failed',
        details: errorText,
      });
    }

    // Get N8N response
    const n8nData = await n8nResponse.json().catch(() => ({}));

    console.log(
      `[N8N Proxy] Success! Workflow: ${workflowName}, Tenant: ${tenantId}, Response time: ${responseTime}ms`,
    );

    // Return N8N's response (important for sync function calls)
    res.json(n8nData);
  } catch (error: any) {
    console.error('[N8N Proxy] Error processing request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to process webhook',
    });
  }
});

export default router;
