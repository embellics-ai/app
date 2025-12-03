/**
 * Function Proxy Routes
 * Dynamic function routing proxy for Retell AI function calls to N8N workflows
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * POST /api/functions/:functionName
 * Proxy Retell AI function calls to configured N8N webhooks
 *
 * This endpoint:
 * 1. Receives function calls from Retell AI agents
 * 2. Looks up the tenant from agent_id
 * 3. Finds the configured N8N webhook for this function
 * 4. Forwards the request with tenant context
 * 5. Returns N8N's response back to Retell
 */
router.post('/:functionName', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { functionName } = req.params;

  try {
    console.log('[Function Proxy] Function called:', functionName);
    console.log('[Function Proxy] Request body:', JSON.stringify(req.body, null, 2));

    // Extract agent_id from request (Retell sends this in the function call)
    const { agent_id, call_id, args } = req.body;

    if (!agent_id) {
      console.error('[Function Proxy] Missing agent_id in request');
      return res.status(400).json({
        error: 'agent_id is required',
        message: 'Retell must send agent_id with function calls',
      });
    }

    // Lookup tenant from agent configuration
    const widgetConfig = await storage.getWidgetConfigByAgentId(agent_id);
    if (!widgetConfig) {
      console.error('[Function Proxy] No widget config found for agent_id:', agent_id);
      return res.status(404).json({
        error: 'Agent not found',
        message: 'No configuration found for this agent',
      });
    }

    const tenantId = widgetConfig.tenantId;
    console.log('[Function Proxy] Resolved tenant:', tenantId);

    // Get tenant details for enrichment
    const tenant = await storage.getTenant(tenantId);

    // Lookup N8N webhook configured for this function
    const webhook = await storage.getWebhookByFunction(tenantId, functionName);
    if (!webhook) {
      console.error(
        '[Function Proxy] No webhook configured for function:',
        functionName,
        'tenant:',
        tenantId,
      );
      return res.status(404).json({
        error: 'Function not configured',
        message: `No N8N webhook configured for function: ${functionName}`,
      });
    }

    console.log('[Function Proxy] Routing to workflow:', webhook.workflowName);

    // Enrich payload with tenant context for N8N
    const enrichedPayload = {
      function: functionName,
      tenant: {
        id: tenantId,
        name: tenant?.name || 'Unknown',
      },
      call: {
        id: call_id,
        agent_id: agent_id,
      },
      args: args || {},
      timestamp: new Date().toISOString(),
      originalPayload: req.body,
    };

    // Set up request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if configured
    if (webhook.authToken) {
      headers['Authorization'] = `Bearer ${webhook.authToken}`;
    }

    // Forward to N8N with timeout
    const timeout = webhook.responseTimeout || 10000; // Default 10s
    console.log('[Function Proxy] Forwarding with timeout (ms):', timeout);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(enrichedPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      console.log('[Function Proxy] Response received in (ms):', duration);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Function Proxy] N8N returned status:', response.status, errorText);
        await storage.incrementWebhookStats(webhook.id, false);

        return res.status(response.status).json({
          error: 'Function execution failed',
          message: errorText || `N8N webhook returned ${response.status}`,
        });
      }

      // Parse N8N response
      const n8nResponse = await response.json();
      console.log('[Function Proxy] N8N response:', JSON.stringify(n8nResponse, null, 2));

      // Update success statistics
      await storage.incrementWebhookStats(webhook.id, true);

      // Return N8N response to Retell
      // N8N should return the data in the format Retell expects for the function
      res.json(n8nResponse);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (fetchError.name === 'AbortError') {
        console.error('[Function Proxy] Timeout after (ms):', duration);
        await storage.incrementWebhookStats(webhook.id, false);

        return res.status(504).json({
          error: 'Function timeout',
          message: `N8N workflow did not respond within ${timeout}ms`,
        });
      }

      console.error('[Function Proxy] Fetch error:', fetchError.message);
      await storage.incrementWebhookStats(webhook.id, false);

      return res.status(502).json({
        error: 'Function execution error',
        message: fetchError.message,
      });
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[Function Proxy] Error after (ms):', duration, error);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
