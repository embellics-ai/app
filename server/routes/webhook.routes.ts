/**
 * Webhook Receiver Routes
 * Retell.AI webhook receivers for chat and voice analytics
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';

const router = Router();

/**
 * POST /chat-analyzed
 * Retell AI Chat Analyzed Webhook
 * Receives chat_analyzed events from Retell AI and stores analytics
 * Public endpoint - no authentication, but signature verification recommended
 */
router.post('/chat-analyzed', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-retell-signature'] as string;

    // TODO: Implement signature verification
    // For now, we'll accept all requests (add verification in production)
    // const isValid = verifyRetellSignature(req.body, signature, process.env.RETELL_WEBHOOK_SECRET);
    // if (!isValid) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    const payload = req.body;

    // Retell sends data nested under "chat" object
    const chat = payload.chat || payload;

    // Log full payload structure for debugging
    console.log('[Retell Webhook] Received webhook for chat:', chat.chat_id);
    console.log('[Retell Webhook] Chat status:', chat.chat_status);
    console.log('[Retell Webhook] Full chat object keys:', Object.keys(chat));

    // Extract data from Retell's chat_analyzed event
    const startTimestamp = chat.start_timestamp ? new Date(chat.start_timestamp) : null;
    const endTimestamp = chat.end_timestamp ? new Date(chat.end_timestamp) : null;

    // Log timestamps for debugging
    console.log('[Retell Webhook] Timestamps:', {
      start_timestamp: chat.start_timestamp,
      end_timestamp: chat.end_timestamp,
      startTimestamp: startTimestamp?.toISOString(),
      endTimestamp: endTimestamp?.toISOString(),
      duration_from_retell: chat.duration,
    });

    // If end_timestamp is missing, log a warning
    if (!chat.end_timestamp) {
      console.warn('[Retell Webhook] ⚠️ end_timestamp is missing - chat may not have ended yet');
      console.warn('[Retell Webhook] This will result in duration = null until chat ends');
    }

    // Calculate duration in seconds if not provided by Retell
    let duration = chat.duration || null;
    let calculatedEndTimestamp = endTimestamp;

    // If end_timestamp is missing but chat has ended, use current time
    if (
      !endTimestamp &&
      startTimestamp &&
      (chat.chat_status === 'ended' || chat.chat_status === 'completed')
    ) {
      calculatedEndTimestamp = new Date();
      console.log(
        '[Retell Webhook] Chat ended but no end_timestamp, using current time:',
        calculatedEndTimestamp.toISOString(),
      );
    }

    if (!duration && startTimestamp && calculatedEndTimestamp) {
      duration = Math.round((calculatedEndTimestamp.getTime() - startTimestamp.getTime()) / 1000);
      console.log('[Retell Webhook] Calculated duration:', duration, 'seconds');
    }

    const chatData = {
      chatId: chat.chat_id,
      agentId: chat.agent_id,
      agentName: chat.agent_name || null,
      agentVersion: chat.agent_version || null,
      chatType: chat.chat_type || null, // Will be inferred below if null
      chatStatus: chat.chat_status || null,
      startTimestamp,
      endTimestamp: calculatedEndTimestamp,
      duration,
      messageCount: chat.messages?.length || 0,
      toolCallsCount: chat.tool_calls?.length || 0,
      dynamicVariables: chat.collected_dynamic_variables || chat.dynamic_variables || null,
      userSentiment: chat.chat_analysis?.user_sentiment || null,
      chatSuccessful: chat.chat_analysis?.chat_successful || null,
      combinedCost: chat.cost_analysis?.combined || 0,
      productCosts: chat.cost_analysis?.product_costs || null,
      metadata: {
        whatsapp_user: chat.metadata?.whatsapp_user || null,
        // Add any other metadata fields
        ...chat.metadata,
      },
    };

    // Determine tenant ID and chat type from metadata or by looking up the agent configuration
    let tenantId = chat.metadata?.tenant_id || payload.tenant_id;

    // Always look up widget config to infer chat type, even if we have tenantId from metadata
    if (chatData.agentId) {
      const widgetConfig = await storage.getWidgetConfigByAgentId(chatData.agentId);
      if (widgetConfig) {
        // Use widget config tenantId if we don't have one from metadata
        if (!tenantId) {
          tenantId = widgetConfig.tenantId;
        }

        // Infer chat type based on which agent ID matched
        // Override generic types like 'api_chat' with specific types
        if (!chatData.chatType || chatData.chatType === 'api_chat') {
          if (chatData.agentId === widgetConfig.whatsappAgentId) {
            chatData.chatType = 'whatsapp';
            console.log('[Retell Webhook] Inferred chat type: whatsapp');
          } else if (chatData.agentId === widgetConfig.retellAgentId) {
            chatData.chatType = 'web_chat';
            console.log('[Retell Webhook] Inferred chat type: web_chat');
          }
        }
      }
    }

    if (!tenantId) {
      console.error(
        '[Retell Webhook] Could not determine tenant_id from payload or agent configuration',
        'Agent ID:',
        chatData.agentId,
      );
      return res.status(400).json({
        error:
          'Could not determine tenant_id. Include tenant_id in metadata or configure agent in system.',
      });
    }

    // Create chat analytics record
    const createdAnalytics = await storage.createChatAnalytics({
      tenantId,
      ...chatData,
    });

    // Forward to tenant-specific N8N webhooks configured for this event
    const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'chat_analyzed');

    if (eventWebhooks.length > 0) {
      console.log(`[Retell Webhook] Forwarding to ${eventWebhooks.length} N8N webhook(s)`);

      // Get tenant name for enrichment
      const tenant = await storage.getTenant(tenantId);

      // Enrich payload with tenant context for N8N
      const enrichedPayload = {
        event: 'chat_analyzed',
        tenant: {
          id: tenantId,
          name: tenant?.name || 'Unknown',
        },
        chat: chatData,
        analytics: {
          id: createdAnalytics.id,
          chatId: createdAnalytics.chatId,
          agentId: createdAnalytics.agentId,
        },
        timestamp: new Date().toISOString(),
        originalPayload: payload,
      };

      // Forward to all configured webhooks (parallel execution)
      const forwardPromises = eventWebhooks.map(async (webhook) => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          // Add auth token if configured
          if (webhook.authToken) {
            headers['Authorization'] = `Bearer ${webhook.authToken}`;
          }

          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(enrichedPayload),
            signal: AbortSignal.timeout(30000), // 30s timeout for event listeners
          });

          if (response.ok) {
            console.log(`[Retell Webhook] ✓ Forwarded to ${webhook.workflowName}`);
            await storage.incrementWebhookStats(webhook.id, true);
          } else {
            const errorText = await response.text();
            console.error(
              `[Retell Webhook] ✗ ${webhook.workflowName} returned ${response.status}:`,
              errorText,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        } catch (forwardError: any) {
          console.error(
            `[Retell Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
            forwardError.message,
          );
          await storage.incrementWebhookStats(webhook.id, false);
        }
      });

      // Wait for all forwards to complete (don't block response to Retell)
      await Promise.allSettled(forwardPromises);
    }

    res.status(200).json({ success: true, message: 'Chat analytics stored' });
  } catch (error: any) {
    console.error('[Retell Webhook] Error processing chat_analyzed event:', error);
    res.status(500).json({ error: 'Failed to process chat analytics', details: error.message });
  }
});

/**
 * POST /call-ended
 * Retell AI Voice Call Ended Webhook
 * Receives call.ended events from Retell AI and stores voice analytics
 * Public endpoint - no authentication, but signature verification recommended
 */
router.post('/call-ended', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-retell-signature'] as string;

    // TODO: Implement signature verification
    // For now, we'll accept all requests (add verification in production)

    const payload = req.body;

    // DEBUG: Log full payload to understand what Retell sends
    console.log('[Retell Voice Webhook] === FULL PAYLOAD DEBUG ===');
    console.log(JSON.stringify(payload, null, 2));
    console.log('[Retell Voice Webhook] === END PAYLOAD ===');

    // Retell sends data nested under "call" object
    const call = payload.call || payload;

    // Extract data from Retell's call.ended event (mirrors chat structure)
    const startTimestamp = call.start_timestamp ? new Date(call.start_timestamp) : null;
    const endTimestamp = call.end_timestamp ? new Date(call.end_timestamp) : null;

    // Calculate duration in seconds if not provided by Retell
    let duration = call.duration || null;
    if (!duration && startTimestamp && endTimestamp) {
      duration = Math.round((endTimestamp.getTime() - startTimestamp.getTime()) / 1000);
    }

    const callData = {
      callId: call.call_id,
      agentId: call.agent_id,
      agentName: call.agent_name || null,
      agentVersion: call.agent_version || null,
      callType: call.call_type || null,
      callStatus: call.call_status || call.disconnect_reason || null,
      startTimestamp,
      endTimestamp,
      duration,
      messageCount: call.transcript?.length || call.messages?.length || 0,
      toolCallsCount: call.tool_calls?.length || 0,
      dynamicVariables: call.collected_dynamic_variables || call.dynamic_variables || null,
      userSentiment: call.call_analysis?.user_sentiment || null,
      callSuccessful: call.call_analysis?.call_successful || null,
      combinedCost: call.cost_analysis?.combined || 0,
      productCosts: call.cost_analysis?.product_costs || null,
      metadata: {
        disconnect_reason: call.disconnect_reason || null,
        from_number: call.from_number || null,
        to_number: call.to_number || null,
        // Add any other metadata fields
        ...call.metadata,
      },
    };

    // Determine tenant ID from metadata or by looking up the agent configuration
    let tenantId = call.metadata?.tenant_id || payload.tenant_id;

    if (!tenantId && callData.agentId) {
      // Try to find tenant by agent ID
      console.log(
        '[Retell Voice Webhook] No tenant_id in metadata, looking up by agent ID:',
        callData.agentId,
      );
      const widgetConfig = await storage.getWidgetConfigByAgentId(callData.agentId);
      if (widgetConfig) {
        tenantId = widgetConfig.tenantId;
        console.log('[Retell Voice Webhook] Found tenant from agent ID:', tenantId);
      }
    }

    if (!tenantId) {
      console.error(
        '[Retell Voice Webhook] Could not determine tenant_id from payload or agent configuration',
      );
      console.error('[Retell Voice Webhook] Payload metadata:', payload.metadata);
      console.error('[Retell Voice Webhook] Agent ID:', callData.agentId);
      return res.status(400).json({
        error:
          'Could not determine tenant_id. Include tenant_id in metadata or configure agent in system.',
      });
    }

    console.log(
      `[Retell Voice Webhook] Processing voice analytics for tenant ${tenantId}, call ${callData.callId}`,
    );

    console.log('[Retell Voice Webhook] Extracted call data:', {
      callId: callData.callId,
      startTimestamp: callData.startTimestamp,
      endTimestamp: callData.endTimestamp,
      duration: callData.duration,
    });

    // Create voice analytics record
    const createdAnalytics = await storage.createVoiceAnalytics({
      tenantId,
      ...callData,
    });

    console.log('[Retell Voice Webhook] Voice analytics created successfully:', {
      id: createdAnalytics.id,
      tenantId: createdAnalytics.tenantId,
      callId: createdAnalytics.callId,
      agentId: createdAnalytics.agentId,
      startTimestamp: createdAnalytics.startTimestamp,
      endTimestamp: createdAnalytics.endTimestamp,
      duration: createdAnalytics.duration,
    });

    console.log(`[Retell Voice Webhook] Stored voice analytics for call ${callData.callId}`);

    // Forward to tenant-specific N8N webhooks configured for this event
    const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'call_analyzed');

    if (eventWebhooks.length > 0) {
      console.log(`[Retell Voice Webhook] Forwarding to ${eventWebhooks.length} N8N webhook(s)`);

      // Get tenant name for enrichment
      const tenant = await storage.getTenant(tenantId);

      // Enrich payload with tenant context for N8N
      const enrichedPayload = {
        event: 'call_analyzed',
        tenant: {
          id: tenantId,
          name: tenant?.name || 'Unknown',
        },
        call: callData,
        analytics: {
          id: createdAnalytics.id,
          callId: createdAnalytics.callId,
          agentId: createdAnalytics.agentId,
        },
        timestamp: new Date().toISOString(),
        originalPayload: payload,
      };

      // Forward to all configured webhooks (parallel execution)
      const forwardPromises = eventWebhooks.map(async (webhook) => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          // Add auth token if configured
          if (webhook.authToken) {
            headers['Authorization'] = `Bearer ${webhook.authToken}`;
          }

          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(enrichedPayload),
            signal: AbortSignal.timeout(30000), // 30s timeout for event listeners
          });

          if (response.ok) {
            console.log(`[Retell Voice Webhook] ✓ Forwarded to ${webhook.workflowName}`);
            await storage.incrementWebhookStats(webhook.id, true);
          } else {
            const errorText = await response.text();
            console.error(
              `[Retell Voice Webhook] ✗ ${webhook.workflowName} returned ${response.status}:`,
              errorText,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        } catch (forwardError: any) {
          console.error(
            `[Retell Voice Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
            forwardError.message,
          );
          await storage.incrementWebhookStats(webhook.id, false);
        }
      });

      // Wait for all forwards to complete (don't block response to Retell)
      await Promise.allSettled(forwardPromises);
    }

    res.status(200).json({ success: true, message: 'Voice analytics stored' });
  } catch (error: any) {
    console.error('[Retell Voice Webhook] Error processing call.ended event:', error);
    res.status(500).json({ error: 'Failed to process voice analytics', details: error.message });
  }
});

export default router;
