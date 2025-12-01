/**
 * REFERENCE IMPLEMENTATION - Function Proxy Endpoint
 *
 * This is a reference implementation that has been integrated into server/routes.ts
 * This file serves as documentation and reference for the implementation.
 *
 * Location in server/routes.ts: Before "// RETELL AI WEBHOOKS" section
 *
 * ============================================
 * RETELL FUNCTION PROXY ENDPOINTS
 * ============================================
 *
 * Function Proxy Endpoint
 * Acts as a secure proxy between Retell AI agents and tenant-specific N8N webhooks
 *
 * When Retell agents call custom functions during conversations, they call this endpoint
 * with the function name. We then route the request to the appropriate N8N webhook
 * based on tenant configuration.
 *
 * Flow:
 * 1. Retell calls: POST /api/functions/get_booking_details
 * 2. We identify tenant from agent_id in the request
 * 3. Look up which N8N webhook handles this function for this tenant
 * 4. Forward enriched request to N8N webhook
 * 5. Return N8N response back to Retell
 *
 * Benefits:
 * - N8N webhooks are not exposed directly to Retell
 * - Tenant-specific routing (different N8N workflows per tenant)
 * - Centralized monitoring and error handling
 * - No credentials stored in Retell or N8N
 */

import type { Request, Response } from 'express';

// This is a reference implementation - the actual code is in server/routes.ts
// Type definitions are illustrative
type Storage = any;

export function createFunctionProxyEndpoint(app: any, storage: Storage) {
  app.post('/api/functions/:functionName', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { functionName } = req.params;
    const { metadata, ...functionParams } = req.body;

    try {
      // Extract agent ID from metadata or body
      const agentId = metadata?.agent_id || req.body.agent_id || metadata?.agentId;

      if (!agentId) {
        return res.status(400).json({
          error: 'Missing agent_id',
          message: 'agent_id must be provided in metadata or request body',
        });
      }

      // Identify tenant from agent ID
      const widgetConfig = await storage.getWidgetConfigByAgentId(agentId);

      if (!widgetConfig) {
        return res.status(404).json({
          error: 'Agent not found',
          message: `No configuration found for agent: ${agentId}`,
        });
      }

      const tenantId = widgetConfig.tenantId;

      // Look up which N8N webhook handles this function for this tenant
      const webhook = await storage.getWebhookByFunction(tenantId, functionName);

      if (!webhook) {
        return res.status(404).json({
          error: 'Function not configured',
          message: `Function "${functionName}" is not configured for this tenant`,
        });
      }

      if (!webhook.isActive) {
        return res.status(503).json({
          error: 'Function inactive',
          message: `Function "${functionName}" is currently inactive`,
        });
      }

      // Enrich payload with tenant context
      const enrichedPayload = {
        tenant: {
          id: tenantId,
          name: widgetConfig.tenant?.name || 'Unknown',
        },
        function: functionName,
        parameters: functionParams,
        metadata: {
          ...metadata,
          agent_id: agentId,
          timestamp: new Date().toISOString(),
        },
      };

      // Forward to N8N webhook with timeout
      const timeout = webhook.responseTimeout || 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add auth token if configured
        if (webhook.authToken) {
          headers['Authorization'] = `Bearer ${webhook.authToken}`;
        }

        const n8nResponse = await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(enrichedPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        if (!n8nResponse.ok) {
          // N8N returned error
          const errorText = await n8nResponse.text();
          console.error(
            `[Function Proxy] N8N webhook error for ${functionName}:`,
            n8nResponse.status,
            errorText,
          );

          // Track failure
          await storage.incrementWebhookStats(webhook.id, false);

          return res.status(n8nResponse.status).json({
            error: 'Function execution failed',
            message: `N8N webhook returned ${n8nResponse.status}`,
            details: errorText,
          });
        }

        // Success - get response from N8N
        const result = await n8nResponse.json();

        // Track success
        await storage.incrementWebhookStats(webhook.id, true);

        console.log(
          `[Function Proxy] ✓ ${functionName} executed successfully in ${responseTime}ms`,
        );

        // Return result to Retell
        return res.json(result);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          // Timeout
          console.error(`[Function Proxy] Timeout for ${functionName} after ${timeout}ms`);
          await storage.incrementWebhookStats(webhook.id, false);

          return res.status(504).json({
            error: 'Function timeout',
            message: `Function execution exceeded ${timeout}ms timeout`,
          });
        }

        // Network or other error
        console.error(`[Function Proxy] Network error for ${functionName}:`, fetchError);
        await storage.incrementWebhookStats(webhook.id, false);

        return res.status(502).json({
          error: 'Function execution failed',
          message: 'Unable to reach N8N webhook',
          details: fetchError.message,
        });
      }
    } catch (error: any) {
      console.error(`[Function Proxy] Error handling ${functionName}:`, error);
      return res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });
}
