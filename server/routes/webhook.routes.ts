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

    console.log('[Retell Webhook] Processing chat:', chat.chat_id, '- Status:', chat.chat_status);

    // Extract cost from multiple possible fields
    let combinedCost = 0;
    let productCosts = null;

    // Try different cost field structures based on Retell's actual webhook payload
    // Retell sends: chat.chat_cost.combined_cost and chat.chat_cost.product_costs
    // CONFIRMED from N8N webhook: Retell sends costs in CENTS (e.g., 3 = $0.03, 120 = $1.20)
    // We need to divide by 100 to convert to dollars for storage
    if (chat.chat_cost && typeof chat.chat_cost === 'object') {
      // Handle chat_cost as object (current Retell format)
      const costInCents = chat.chat_cost.combined_cost || 0;
      combinedCost = costInCents / 100; // Convert cents to dollars
      productCosts = chat.chat_cost.product_costs || null;
      console.log(
        '[Retell Webhook] ✅ Cost from chat.chat_cost.combined_cost:',
        costInCents,
        'cents = $' + combinedCost.toFixed(4),
      );
    } else if (typeof chat.chat_cost === 'number' && chat.chat_cost > 0) {
      // Fallback: Handle chat_cost as number (legacy format) - also in cents
      combinedCost = chat.chat_cost / 100; // Convert cents to dollars
      console.log(
        '[Retell Webhook] Cost from chat.chat_cost:',
        chat.chat_cost,
        'cents = $' + combinedCost.toFixed(4),
      );
    } else if (chat.cost_analysis?.combined) {
      // Alternative format: cost_analysis.combined - also in cents
      combinedCost = chat.cost_analysis.combined / 100; // Convert cents to dollars
      productCosts = chat.cost_analysis.product_costs || null;
      console.log(
        '[Retell Webhook] Cost from cost_analysis.combined:',
        chat.cost_analysis.combined,
        'cents = $' + combinedCost.toFixed(4),
      );
    } else if (chat.cost_analysis?.total) {
      // Alternative format: cost_analysis.total - also in cents
      combinedCost = chat.cost_analysis.total / 100; // Convert cents to dollars
      console.log(
        '[Retell Webhook] Cost from cost_analysis.total:',
        chat.cost_analysis.total,
        'cents = $' + combinedCost.toFixed(4),
      );
    } else {
      console.warn('[Retell Webhook] ⚠️ No cost data found in webhook payload');
      console.warn('[Retell Webhook] Available cost fields:', {
        chat_cost: chat.chat_cost,
        cost_analysis: chat.cost_analysis,
      });
    }

    // Extract data from Retell's chat_analyzed event
    const startTimestamp = chat.start_timestamp ? new Date(chat.start_timestamp) : null;
    const endTimestamp = chat.end_timestamp ? new Date(chat.end_timestamp) : null;

    // Calculate duration in seconds if not provided by Retell
    let duration = chat.duration || null;
    let calculatedEndTimestamp = endTimestamp;

    // If end_timestamp is missing but chat has ended, use current time as fallback
    if (
      !endTimestamp &&
      startTimestamp &&
      (chat.chat_status === 'ended' || chat.chat_status === 'completed')
    ) {
      calculatedEndTimestamp = new Date();
      console.log(
        '[Retell Webhook] Using current time as end_timestamp (Retell did not provide it)',
      );
    }

    if (!duration && startTimestamp && calculatedEndTimestamp) {
      duration = Math.round((calculatedEndTimestamp.getTime() - startTimestamp.getTime()) / 1000);
      console.log('[Retell Webhook] Duration:', duration, 'seconds');
    } else if (!endTimestamp && !calculatedEndTimestamp) {
      console.warn(
        '[Retell Webhook] ⚠️ Chat still active - will calculate duration on next webhook',
      );
    }

    // Get message count - strategy depends on chat type
    // For web chats: Count from widget_chat_messages (real-time storage)
    // For WhatsApp/voice: Count from transcript_object array (if available)
    const widgetMessages = await storage.getWidgetChatMessages(chat.chat_id);
    const widgetMessageCount = widgetMessages.length;

    // CRITICAL FIX: Retell sends message_with_tool_calls (array of all messages)
    // This includes user messages, agent messages, tool calls, and node transitions
    // We only count user and agent messages (not tool calls or transitions)
    let transcriptMessageCount = 0;

    if (Array.isArray(chat.message_with_tool_calls) && chat.message_with_tool_calls.length > 0) {
      // Count only user and agent messages (exclude tool_call_invocation, tool_call_result, node_transition)
      transcriptMessageCount = chat.message_with_tool_calls.filter(
        (msg: any) => msg.role === 'user' || msg.role === 'agent',
      ).length;
      console.log(
        '[Retell Webhook] ✅ Using message_with_tool_calls array:',
        transcriptMessageCount,
        'messages (filtered from',
        chat.message_with_tool_calls.length,
        'total entries)',
      );
    } else if (Array.isArray(chat.transcript_object) && chat.transcript_object.length > 0) {
      // Fallback: Use transcript_object array if available
      transcriptMessageCount = chat.transcript_object.length;
      console.log(
        '[Retell Webhook] ✅ Using transcript_object array:',
        transcriptMessageCount,
        'messages',
      );
    } else if (Array.isArray(chat.messages) && chat.messages.length > 0) {
      // Alternative field: messages array
      transcriptMessageCount = chat.messages.length;
      console.log('[Retell Webhook] ✅ Using messages array:', transcriptMessageCount, 'messages');
    } else if (Array.isArray(chat.transcript) && chat.transcript.length > 0) {
      // Fallback: If transcript is an array (older format?)
      transcriptMessageCount = chat.transcript.length;
      console.log('[Retell Webhook] Using transcript array:', transcriptMessageCount, 'messages');
    } else if (typeof chat.transcript === 'string' && chat.transcript.length > 0) {
      // Last resort: Estimate message count from transcript string
      // Count "User:" / "Agent:" occurrences as rough estimate
      const agentMatches = (chat.transcript.match(/Agent:/gi) || []).length;
      const userMatches = (chat.transcript.match(/User:/gi) || []).length;
      transcriptMessageCount = agentMatches + userMatches;
      console.log(
        '[Retell Webhook] ⚠️ Estimating message count from transcript string:',
        transcriptMessageCount,
        'messages (Agent:',
        agentMatches,
        'User:',
        userMatches,
        ')',
      );
    } else {
      console.warn('[Retell Webhook] ⚠️ Could not determine message count from transcript data');
      transcriptMessageCount = 0;
    }

    // Use widget count if available (web chats), otherwise use transcript message count
    // If no transcript data available, estimate from duration (1 message per 30 seconds)
    let messageCount = widgetMessageCount > 0 ? widgetMessageCount : transcriptMessageCount;

    if (messageCount === 0 && duration && duration > 0) {
      // Estimate message count from duration for WhatsApp/phone chats without transcript
      // Conservative estimate: 1 message exchange (user + agent) per 30 seconds
      messageCount = Math.max(2, Math.round(duration / 30));
      console.log(
        '[Retell Webhook] ⚠️  No transcript data - estimated',
        messageCount,
        'messages from',
        duration,
        'seconds duration',
      );
    }

    console.log(
      '[Retell Webhook] Message count:',
      messageCount,
      '(Widget:',
      widgetMessageCount,
      'Transcript:',
      transcriptMessageCount,
      ')',
    );

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
      messageCount,
      toolCallsCount: chat.tool_calls?.length || 0,
      dynamicVariables: chat.collected_dynamic_variables || chat.dynamic_variables || null,
      userSentiment: chat.chat_analysis?.user_sentiment || null,
      chatSuccessful: chat.chat_analysis?.chat_successful || null,
      combinedCost,
      productCosts,
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
      console.log('[Retell Webhook] Looking up agent config for agent ID:', chatData.agentId);
      const widgetConfig = await storage.getWidgetConfigByAgentId(chatData.agentId);
      if (widgetConfig) {
        console.log('[Retell Webhook] Found widget config for tenant:', widgetConfig.tenantId);
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
      } else {
        console.warn('[Retell Webhook] No widget config found for agent ID:', chatData.agentId);
        console.warn('[Retell Webhook] Agent ID may not be configured in Widget Settings');
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
        agentId: chatData.agentId, // Include agent ID in response for debugging
      });
    }

    // Create chat analytics record
    const createdAnalytics = await storage.createChatAnalytics({
      tenantId,
      ...chatData,
    });

    // NOTE: We intentionally DO NOT store Retell's transcript
    // Rationale: Messages are already stored in real-time in widget_chat_history during the conversation
    // The retell_transcript_messages table was dropped in migration 0015
    // This avoids duplicate storage and we already have the message history we need
    console.log(
      `[Retell Webhook] Chat analytics stored. Messages already captured in widget_chat_history during conversation.`,
    );

    // Forward to tenant-specific N8N webhooks configured for this event
    const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'chat_analyzed');

    if (eventWebhooks.length > 0) {
      console.log(`[Retell Webhook] Forwarding to ${eventWebhooks.length} webhook(s)`);

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

/**
 * POST /chat-ended
 * Retell AI Chat Ended Webhook
 * Alternative endpoint for chat completion events
 * Some Retell configurations use "chat-ended" instead of "chat-analyzed"
 */
router.post('/chat-ended', async (req: Request, res: Response) => {
  try {
    console.log('[Retell Webhook] Received chat-ended event, forwarding to chat-analyzed handler');

    // Forward to the chat-analyzed handler by calling the same logic
    // We'll modify the request to match the expected format
    const payload = req.body;

    // Get tenant_id from metadata or lookup agent
    const chat = payload.chat || payload;
    let tenantId = chat.metadata?.tenant_id || payload.tenant_id;

    if (!tenantId && chat.agent_id) {
      const widgetConfig = await storage.getWidgetConfigByAgentId(chat.agent_id);
      if (widgetConfig) {
        tenantId = widgetConfig.tenantId;
      }
    }

    if (!tenantId) {
      console.error('[Retell Webhook] chat-ended: Could not determine tenant_id');
      return res.status(400).json({
        error: 'Could not determine tenant_id',
        agentId: chat.agent_id,
      });
    }

    // Forward to N8N webhooks registered for chat_ended event
    const n8nWebhooks = await storage.getWebhooksByEvent(tenantId, 'chat_ended');

    if (n8nWebhooks.length > 0) {
      console.log(`[Retell Webhook] Forwarding chat-ended to ${n8nWebhooks.length} N8N webhook(s)`);

      const forwardPromises = n8nWebhooks.map(async (webhook) => {
        try {
          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            console.log(`[Retell Webhook] ✓ Forwarded to ${webhook.workflowName}`);
            await storage.incrementWebhookStats(webhook.id, true);
          } else {
            console.error(
              `[Retell Webhook] ✗ Failed to forward to ${webhook.workflowName}:`,
              response.statusText,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        } catch (error: any) {
          console.error(
            `[Retell Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
            error.message,
          );
          await storage.incrementWebhookStats(webhook.id, false);
        }
      });

      await Promise.allSettled(forwardPromises);
    }

    res.status(200).json({ success: true, message: 'Chat ended event processed' });
  } catch (error: any) {
    console.error('[Retell Webhook] Error processing chat-ended event:', error);
    res.status(500).json({ error: 'Failed to process chat ended event', details: error.message });
  }
});

/**
 * POST /chat-started
 * Retell AI Chat Started Webhook
 * Receives chat start notifications
 */
router.post('/chat-started', async (req: Request, res: Response) => {
  try {
    console.log('[Retell Webhook] Received chat-started event');

    const payload = req.body;
    const chat = payload.chat || payload;
    let tenantId = chat.metadata?.tenant_id || payload.tenant_id;

    if (!tenantId && chat.agent_id) {
      const widgetConfig = await storage.getWidgetConfigByAgentId(chat.agent_id);
      if (widgetConfig) {
        tenantId = widgetConfig.tenantId;
      }
    }

    if (!tenantId) {
      console.error('[Retell Webhook] chat-started: Could not determine tenant_id');
      return res.status(400).json({
        error: 'Could not determine tenant_id',
        agentId: chat.agent_id,
      });
    }

    // Forward to N8N webhooks
    const n8nWebhooks = await storage.getWebhooksByEvent(tenantId, 'chat_started');

    if (n8nWebhooks.length > 0) {
      console.log(
        `[Retell Webhook] Forwarding chat-started to ${n8nWebhooks.length} N8N webhook(s)`,
      );

      const forwardPromises = n8nWebhooks.map(async (webhook) => {
        try {
          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            console.log(`[Retell Webhook] ✓ Forwarded to ${webhook.workflowName}`);
            await storage.incrementWebhookStats(webhook.id, true);
          } else {
            console.error(
              `[Retell Webhook] ✗ Failed to forward to ${webhook.workflowName}:`,
              response.statusText,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        } catch (error: any) {
          console.error(
            `[Retell Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
            error.message,
          );
          await storage.incrementWebhookStats(webhook.id, false);
        }
      });

      await Promise.allSettled(forwardPromises);
    }

    res.status(200).json({ success: true, message: 'Chat started event processed' });
  } catch (error: any) {
    console.error('[Retell Webhook] Error processing chat-started event:', error);
    res.status(500).json({ error: 'Failed to process chat started event', details: error.message });
  }
});

/**
 * POST /call-started
 * Retell AI Call Started Webhook
 * Receives call start notifications for voice calls
 */
router.post('/call-started', async (req: Request, res: Response) => {
  try {
    console.log('[Retell Webhook] Received call-started event');

    const payload = req.body;
    const call = payload.call || payload;
    let tenantId = call.metadata?.tenant_id || payload.tenant_id;

    if (!tenantId && call.agent_id) {
      const widgetConfig = await storage.getWidgetConfigByAgentId(call.agent_id);
      if (widgetConfig) {
        tenantId = widgetConfig.tenantId;
      }
    }

    if (!tenantId) {
      console.error('[Retell Webhook] call-started: Could not determine tenant_id');
      return res.status(400).json({
        error: 'Could not determine tenant_id',
        agentId: call.agent_id,
      });
    }

    // Forward to N8N webhooks
    const n8nWebhooks = await storage.getWebhooksByEvent(tenantId, 'call_started');

    if (n8nWebhooks.length > 0) {
      console.log(
        `[Retell Webhook] Forwarding call-started to ${n8nWebhooks.length} N8N webhook(s)`,
      );

      const forwardPromises = n8nWebhooks.map(async (webhook) => {
        try {
          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            console.log(`[Retell Webhook] ✓ Forwarded to ${webhook.workflowName}`);
            await storage.incrementWebhookStats(webhook.id, true);
          } else {
            console.error(
              `[Retell Webhook] ✗ Failed to forward to ${webhook.workflowName}:`,
              response.statusText,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        } catch (error: any) {
          console.error(
            `[Retell Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
            error.message,
          );
          await storage.incrementWebhookStats(webhook.id, false);
        }
      });

      await Promise.allSettled(forwardPromises);
    }

    res.status(200).json({ success: true, message: 'Call started event processed' });
  } catch (error: any) {
    console.error('[Retell Webhook] Error processing call-started event:', error);
    res.status(500).json({ error: 'Failed to process call started event', details: error.message });
  }
});

/**
 * POST /call-analyzed
 * Retell AI Call Analyzed Webhook
 * Alternative endpoint for voice call analytics (similar to call-ended)
 */
router.post('/call-analyzed', async (req: Request, res: Response) => {
  try {
    console.log('[Retell Webhook] Received call-analyzed event');

    const payload = req.body;
    const call = payload.call || payload;
    let tenantId = call.metadata?.tenant_id || payload.tenant_id;

    if (!tenantId && call.agent_id) {
      const widgetConfig = await storage.getWidgetConfigByAgentId(call.agent_id);
      if (widgetConfig) {
        tenantId = widgetConfig.tenantId;
      }
    }

    if (!tenantId) {
      console.error('[Retell Webhook] call-analyzed: Could not determine tenant_id');
      return res.status(400).json({
        error: 'Could not determine tenant_id',
        agentId: call.agent_id,
      });
    }

    // Forward to N8N webhooks
    const n8nWebhooks = await storage.getWebhooksByEvent(tenantId, 'call_analyzed');

    if (n8nWebhooks.length > 0) {
      console.log(
        `[Retell Webhook] Forwarding call-analyzed to ${n8nWebhooks.length} N8N webhook(s)`,
      );

      const forwardPromises = n8nWebhooks.map(async (webhook) => {
        try {
          const response = await fetch(webhook.webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            console.log(`[Retell Webhook] ✓ Forwarded to ${webhook.workflowName}`);
            await storage.incrementWebhookStats(webhook.id, true);
          } else {
            console.error(
              `[Retell Webhook] ✗ Failed to forward to ${webhook.workflowName}:`,
              response.statusText,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        } catch (error: any) {
          console.error(
            `[Retell Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
            error.message,
          );
          await storage.incrementWebhookStats(webhook.id, false);
        }
      });

      await Promise.allSettled(forwardPromises);
    }

    res.status(200).json({ success: true, message: 'Call analyzed event processed' });
  } catch (error: any) {
    console.error('[Retell Webhook] Error processing call-analyzed event:', error);
    res
      .status(500)
      .json({ error: 'Failed to process call analyzed event', details: error.message });
  }
});

export default router;
