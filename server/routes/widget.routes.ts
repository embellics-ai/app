/**
 * Widget Routes
 * Public widget embedding endpoints and widget API
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { verifyPassword } from '../middleware/auth.middleware';
import Retell from 'retell-sdk';

const router = Router();

// In-memory storage for widget test tokens (platform admin only)
interface WidgetTestTokenData {
  tenantId: string;
  createdAt: Date;
  createdBy?: string;
}
export const widgetTestTokens = new Map<string, WidgetTestTokenData>();

// ===== Widget Embed Endpoints (Public) =====

// Serve widget.js with CORS headers for embedding
router.get('/widget.js', async (_req, res) => {
  try {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // In development, disable caching for easier iteration
    // In production, cache for 1 hour
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    // In production, serve from dist/public
    // In development, serve from client/public
    const fs = await import('fs');
    const path = await import('path');

    const widgetPath = isDev
      ? path.resolve(process.cwd(), 'client/public/widget.js')
      : path.resolve(import.meta.dirname, 'public/widget.js');

    if (!fs.existsSync(widgetPath)) {
      return res.status(404).json({ error: 'Widget file not found' });
    }

    const widgetContent = fs.readFileSync(widgetPath, 'utf-8');
    res.send(widgetContent);
  } catch (error) {
    console.error('Error serving widget.js:', error);
    res.status(500).json({ error: 'Failed to load widget' });
  }
});

// Helper function to validate domain restrictions for widget endpoints
function validateWidgetDomain(widgetConfig: any, referrer: string | undefined): boolean {
  // If no domains configured, allow all
  if (!widgetConfig.allowedDomains || widgetConfig.allowedDomains.length === 0) {
    return true;
  }

  // If no referrer provided, block (should always have referrer from widget)
  if (!referrer) {
    return false;
  }

  // Check if referrer matches any allowed domain
  return widgetConfig.allowedDomains.some((domain: string) => {
    // Support wildcard subdomains (*.example.com)
    if (domain.startsWith('*.')) {
      const baseDomain = domain.slice(2);
      return referrer.endsWith(baseDomain) || referrer === baseDomain.replace('*.', '');
    }
    return referrer === domain || referrer.endsWith('.' + domain);
  });
}

// Widget initialization endpoint - validates API key and returns configuration
router.post('/api/widget/init', async (req, res) => {
  try {
    const { apiKey, referrer } = z
      .object({
        apiKey: z.string(),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    // Enable CORS for widget embedding
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let tenantId: string;
    let widgetConfig;

    // Check if this is a platform admin test token
    if (apiKey.startsWith('test_')) {
      console.log('[Widget Test] Received test token:', apiKey);
      console.log('[Widget Test] Available tokens:', Array.from(widgetTestTokens.keys()));

      const testTokenData = widgetTestTokens.get(apiKey);

      if (!testTokenData) {
        console.log('[Widget Test] Test token not found in map');
        return res.status(401).json({ error: 'Invalid or expired test token' });
      }

      tenantId = testTokenData.tenantId;
      console.log('[Widget Test] Platform admin testing widget for tenant:', tenantId);
    } else {
      // Normal API key validation - get all keys for tenant and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Update last used timestamp
      await storage.updateApiKeyLastUsed(apiKeyRecord.id);
      tenantId = apiKeyRecord.tenantId;
    }

    // Get widget configuration for this tenant
    widgetConfig = await storage.getWidgetConfig(tenantId);

    if (!widgetConfig) {
      return res.status(404).json({ error: 'Widget configuration not found' });
    }

    // Check domain restrictions if configured
    if (widgetConfig.allowedDomains && widgetConfig.allowedDomains.length > 0 && referrer) {
      const isAllowed = widgetConfig.allowedDomains.some((domain: string) => {
        // Support wildcard subdomains (*.example.com)
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2);
          return referrer.endsWith(baseDomain) || referrer === baseDomain.replace('*.', '');
        }
        return referrer === domain || referrer.endsWith('.' + domain);
      });

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains.join(', ')}`,
        });
      }
    }

    // Get tenant integration for WhatsApp config
    const integration = await storage.getTenantIntegration(tenantId);
    let whatsappPhoneNumber = null;

    // Check if WhatsApp is available - either through integration OR if widget has whatsappAgentId
    const hasWhatsappIntegration = integration?.whatsappEnabled && integration?.whatsappConfig;
    const hasWhatsappAgent = !!widgetConfig.whatsappAgentId;

    if (hasWhatsappIntegration) {
      try {
        const config = integration.whatsappConfig as any;
        whatsappPhoneNumber = config.phoneNumber || null;
      } catch (e) {
        console.error('[Widget Init] Error parsing WhatsApp config:', e);
      }
    }

    // WhatsApp is available if we have BOTH agent ID and phone number
    const whatsappAvailable = hasWhatsappAgent && !!whatsappPhoneNumber;

    // Return safe configuration (exclude sensitive data)
    res.json({
      tenantId: tenantId,
      greeting: widgetConfig.greeting,
      primaryColor: widgetConfig.primaryColor || '#9b7ddd',
      textColor: widgetConfig.textColor || '#ffffff',
      borderRadius: widgetConfig.borderRadius || '12px',
      position: widgetConfig.position || 'bottom-right',
      whatsappAvailable: whatsappAvailable,
      whatsappPhoneNumber: whatsappPhoneNumber,
    });
  } catch (error) {
    console.error('Error initializing widget:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to initialize widget' });
  }
});

// Handle CORS preflight for widget init
router.options('/api/widget/init', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Widget chat endpoint for text-based conversations
router.post('/api/widget/chat', async (req, res) => {
  try {
    const { apiKey, message, chatId, referrer } = z
      .object({
        apiKey: z.string(),
        message: z.string().min(1),
        chatId: z.string().nullable().optional(),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    // Enable CORS for widget embedding
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let tenantId: string;

    // Check if this is a platform admin test token
    if (apiKey.startsWith('test_')) {
      const testTokenData = widgetTestTokens.get(apiKey);

      if (!testTokenData) {
        return res.status(401).json({ error: 'Invalid or expired test token' });
      }

      tenantId = testTokenData.tenantId;
      console.log('[Widget Test] Platform admin chat message for tenant:', tenantId);
    } else {
      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      tenantId = apiKeyRecord.tenantId;
    }

    // Get widget configuration for this tenant
    const widgetConfig = await storage.getWidgetConfig(tenantId);

    if (!widgetConfig || !widgetConfig.retellApiKey || !widgetConfig.retellAgentId) {
      return res.status(400).json({
        error: 'Widget not configured',
        message: 'Please configure Retell AI credentials in the admin panel',
      });
    }

    // Check domain restrictions
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig?.allowedDomains?.join(', ')}`,
      });
    }

    // Create a Retell client using the tenant's API key
    const tenantRetellClient = new Retell({
      apiKey: widgetConfig.retellApiKey,
    });

    // Use existing chatId or create new session
    let retellChatId = chatId;
    let isNewSession = false;

    if (!retellChatId) {
      console.log('[Widget Chat] Creating new chat session');
      const chatSession = await tenantRetellClient.chat.create({
        agent_id: widgetConfig.retellAgentId,
        metadata: {
          tenantId: tenantId,
          source: 'widget',
        },
      });
      retellChatId = chatSession.chat_id;
      isNewSession = true;
      console.log('[Widget Chat] Created session:', retellChatId);

      // Give Retell a moment to fully initialize the new session
      // This prevents the first message from failing due to session not being ready
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Send message to Retell and get response with retry logic for new sessions
    console.log('[Widget Chat] Sending message:', message);
    let completion;
    let retries = isNewSession ? 3 : 1;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        completion = await tenantRetellClient.chat.createChatCompletion({
          chat_id: retellChatId,
          content: message,
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        console.error(`[Widget Chat] Attempt ${attempt}/${retries} failed:`, error.message);

        if (attempt < retries) {
          // Exponential backoff: 300ms, 600ms
          const delay = 300 * attempt;
          console.log(`[Widget Chat] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!completion) {
      throw lastError || new Error('Failed to get completion from Retell');
    }

    // Extract ALL agent responses from this interaction
    const messages = completion.messages || [];
    const assistantMessages = messages.filter(
      (msg: any) =>
        (msg.role === 'agent' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0,
    );

    // Return all messages as an array for client-side display with delays
    let responseMessages = ["I'm processing your request..."];
    if (assistantMessages.length > 0) {
      responseMessages = assistantMessages.map((msg: any) => msg.content);
    }

    console.log('[Widget Chat] Total assistant messages:', assistantMessages.length);

    // Save messages to database for history persistence
    try {
      // Save user message
      await storage.createWidgetChatMessage({
        tenantId: tenantId,
        chatId: retellChatId,
        role: 'user',
        content: message,
      });

      // Save combined assistant response
      const combinedResponse = responseMessages.join('\n\n');
      await storage.createWidgetChatMessage({
        tenantId: tenantId,
        chatId: retellChatId,
        role: 'assistant',
        content: combinedResponse,
      });

      console.log('[Widget Chat] Messages saved to database');
    } catch (dbError) {
      console.error('[Widget Chat] Failed to save messages to database:', dbError);
      // Don't fail the request if database save fails
    }

    // Return all messages for client-side sequential display
    res.json({
      messages: responseMessages,
      chatId: retellChatId,
    });
  } catch (error: any) {
    console.error('[Widget Chat] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to process chat message';
    if (error.message?.includes('chat_id')) {
      errorMessage = 'Chat session error. Please try again.';
    } else if (error.message?.includes('agent_id')) {
      errorMessage = 'AI agent configuration error. Please contact support.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
    }

    res.status(500).json({
      error: errorMessage,
      message: error.message, // Include detailed error for debugging
    });
  }
});

// Handle CORS preflight for chat endpoint
router.options('/api/widget/chat', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// Get complete session history (chat + handoff messages)
router.get('/api/widget/session/:chatId/history', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { apiKey, handoffId, referrer } = z
      .object({
        apiKey: z.string(),
        handoffId: z.string().optional(),
        referrer: z.string().optional(),
      })
      .parse(req.query);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Check if this is a platform admin test token
    let tenantId: string;
    if (apiKey.startsWith('test_')) {
      const testTokenData = widgetTestTokens.get(apiKey);
      if (!testTokenData) {
        return res.status(401).json({ error: 'Invalid or expired test token' });
      }
      tenantId = testTokenData.tenantId;
      console.log('[Widget Test] Platform admin loading history for tenant:', tenantId);
    } else {
      // Validate regular API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      tenantId = apiKeyRecord.tenantId;
    }

    // Get widget configuration for domain validation
    const widgetConfig = await storage.getWidgetConfig(tenantId);
    if (!widgetConfig) {
      return res.status(500).json({ error: 'Widget configuration not found' });
    }

    // Validate domain restriction
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
      });
    }

    // Get chat messages from database
    const chatMessages = await storage.getWidgetChatMessages(chatId);

    // Get handoff messages if handoffId provided
    let handoffMessages: any[] = [];
    let handoffStatus = 'none';

    if (handoffId) {
      handoffMessages = await storage.getWidgetHandoffMessages(handoffId);

      // Get handoff status
      const handoff = await storage.getWidgetHandoff(handoffId);
      if (handoff) {
        handoffStatus = handoff.status;
      }
    }

    // Merge and sort all messages by timestamp
    const allMessages = [
      ...chatMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
      ...handoffMessages.map((msg) => ({
        id: msg.id,
        role: msg.senderType === 'agent' ? 'agent' : msg.senderType,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`[Widget History] Returning ${allMessages.length} messages for chat ${chatId}`);

    // Return complete history
    res.json({
      chatId,
      handoffId: handoffId || null,
      handoffStatus,
      messages: allMessages,
    });
  } catch (error) {
    console.error('[Widget History] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to fetch session history' });
  }
}); // Handle CORS preflight for session history endpoint
router.options('/api/widget/session/:chatId/history', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// ============================================
// WIDGET HANDOFF ENDPOINTS
// ============================================

// Request human agent handoff
router.post('/api/widget/handoff', async (req, res) => {
  try {
    const {
      apiKey,
      chatId,
      conversationHistory,
      lastUserMessage,
      userEmail,
      userMessage,
      referrer,
    } = z
      .object({
        apiKey: z.string(),
        chatId: z.string(),
        conversationHistory: z.array(z.any()).optional(),
        lastUserMessage: z.string().optional(),
        userEmail: z.string().email().optional(),
        userMessage: z.string().optional(),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Validate API key - get all keys and verify with bcrypt
    const allApiKeys = await storage.getAllApiKeys();
    let apiKeyRecord = null;

    for (const key of allApiKeys) {
      const isMatch = await verifyPassword(apiKey, key.keyHash);
      if (isMatch) {
        apiKeyRecord = key;
        break;
      }
    }

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get widget configuration for domain validation
    const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
    if (!widgetConfig) {
      return res.status(500).json({ error: 'Widget configuration not found' });
    }

    // Validate domain restriction
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
      });
    }

    // Check if agents are available
    const availableAgents = await storage.getAvailableHumanAgents(apiKeyRecord.tenantId);
    const hasAvailableAgents = availableAgents.some(
      (agent) => agent.status === 'available' && agent.activeChats < agent.maxChats,
    );

    // Create handoff request
    const handoff = await storage.createWidgetHandoff({
      tenantId: apiKeyRecord.tenantId,
      chatId,
      status: hasAvailableAgents ? 'pending' : 'pending', // Will be 'pending' either way
      conversationHistory: conversationHistory || null,
      lastUserMessage: lastUserMessage || null,
      userEmail: userEmail || null,
      userMessage: userMessage || null,
      metadata: null,
      assignedAgentId: null,
      pickedUpAt: null,
      resolvedAt: null,
    });

    // Broadcast to agents via WebSocket (if available)
    const wss = (req as any).ws;
    if (wss) {
      wss.clients.forEach((client: any) => {
        if (
          client.tenantId === apiKeyRecord.tenantId &&
          client.readyState === 1 // OPEN
        ) {
          client.send(
            JSON.stringify({
              type: 'new_handoff',
              handoff: {
                id: handoff.id,
                chatId: handoff.chatId,
                lastUserMessage: handoff.lastUserMessage,
                requestedAt: handoff.requestedAt,
              },
            }),
          );
        }
      });
    }

    res.json({
      handoffId: handoff.id,
      status: hasAvailableAgents ? 'pending' : 'after-hours',
      message: hasAvailableAgents
        ? 'Handoff request created. An agent will be with you shortly.'
        : 'No agents available. Please leave your contact information.',
    });
  } catch (error) {
    console.error('[Widget Handoff] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create handoff request' });
  }
});

// Get handoff status
router.get('/api/widget/handoff/:handoffId/status', async (req, res) => {
  try {
    const { handoffId } = req.params;
    const { apiKey, referrer } = z
      .object({
        apiKey: z.string(),
        referrer: z.string().optional(),
      })
      .parse(req.query);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Validate API key - get all keys and verify with bcrypt
    const allApiKeys = await storage.getAllApiKeys();
    let apiKeyRecord = null;

    for (const key of allApiKeys) {
      const isMatch = await verifyPassword(apiKey, key.keyHash);
      if (isMatch) {
        apiKeyRecord = key;
        break;
      }
    }

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get widget configuration for domain validation
    const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
    if (!widgetConfig) {
      return res.status(500).json({ error: 'Widget configuration not found' });
    }

    // Validate domain restriction
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
      });
    }

    const handoff = await storage.getWidgetHandoff(handoffId);

    if (!handoff || handoff.tenantId !== apiKeyRecord.tenantId) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    let agentName = null;
    if (handoff.assignedAgentId) {
      const agent = await storage.getHumanAgent(handoff.assignedAgentId);
      agentName = agent?.name || null;
    }

    res.json({
      status: handoff.status,
      agentName,
      pickedUpAt: handoff.pickedUpAt,
      resolvedAt: handoff.resolvedAt,
    });
  } catch (error) {
    console.error('[Widget Handoff Status] Error:', error);
    res.status(500).json({ error: 'Failed to get handoff status' });
  }
});

// Send message during handoff
router.post('/api/widget/handoff/:handoffId/message', async (req, res) => {
  try {
    const { handoffId } = req.params;
    const { apiKey, message, referrer } = z
      .object({
        apiKey: z.string(),
        message: z.string().min(1),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Validate API key - get all keys and verify with bcrypt
    const allApiKeys = await storage.getAllApiKeys();
    let apiKeyRecord = null;

    for (const key of allApiKeys) {
      const isMatch = await verifyPassword(apiKey, key.keyHash);
      if (isMatch) {
        apiKeyRecord = key;
        break;
      }
    }

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get widget configuration for domain validation
    const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
    if (!widgetConfig) {
      return res.status(500).json({ error: 'Widget configuration not found' });
    }

    // Validate domain restriction
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
      });
    }

    const handoff = await storage.getWidgetHandoff(handoffId);

    if (!handoff || handoff.tenantId !== apiKeyRecord.tenantId) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    if (handoff.status !== 'active') {
      return res.status(400).json({ error: 'Handoff is not active' });
    }

    // Save user message
    const savedMessage = await storage.createWidgetHandoffMessage({
      handoffId,
      senderType: 'user',
      senderId: null,
      content: message,
    });

    // Send to agent via WebSocket
    const wss = (req as any).ws;
    if (wss && handoff.assignedAgentId) {
      wss.clients.forEach((client: any) => {
        if (
          client.userId === handoff.assignedAgentId &&
          client.readyState === 1 // OPEN
        ) {
          client.send(
            JSON.stringify({
              type: 'handoff_message',
              handoffId,
              message: {
                id: savedMessage.id,
                content: savedMessage.content,
                senderType: 'user',
                timestamp: savedMessage.timestamp,
              },
            }),
          );
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Widget Handoff Message] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get handoff messages (for polling)
router.get('/api/widget/handoff/:handoffId/messages', async (req, res) => {
  try {
    const { handoffId } = req.params;
    const { apiKey, since, referrer } = z
      .object({
        apiKey: z.string(),
        since: z.string().optional(),
        referrer: z.string().optional(),
      })
      .parse(req.query);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Validate API key - get all keys and verify with bcrypt
    const allApiKeys = await storage.getAllApiKeys();
    let apiKeyRecord = null;

    for (const key of allApiKeys) {
      const isMatch = await verifyPassword(apiKey, key.keyHash);
      if (isMatch) {
        apiKeyRecord = key;
        break;
      }
    }

    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Get widget configuration for domain validation
    const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
    if (!widgetConfig) {
      return res.status(500).json({ error: 'Widget configuration not found' });
    }

    // Validate domain restriction
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
      });
    }

    const handoff = await storage.getWidgetHandoff(handoffId);

    if (!handoff || handoff.tenantId !== apiKeyRecord.tenantId) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    let messages;
    if (since) {
      const sinceDate = new Date(since);
      messages = await storage.getWidgetHandoffMessagesSince(handoffId, sinceDate);
    } else {
      messages = await storage.getWidgetHandoffMessages(handoffId);
    }

    res.json({ messages });
  } catch (error) {
    console.error('[Widget Handoff Messages] Error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// CORS preflight handlers
router.options('/api/widget/handoff', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

router.options('/api/widget/handoff/:handoffId/status', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

router.options('/api/widget/handoff/:handoffId/message', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

router.options('/api/widget/handoff/:handoffId/messages', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

// End chat (user-initiated) - Resolves active handoff if exists
router.post('/api/widget/end-chat', async (req, res) => {
  try {
    const { apiKey, chatId, handoffId, referrer } = z
      .object({
        apiKey: z.string(),
        chatId: z.string(),
        handoffId: z.string().optional(),
        referrer: z.string().optional(),
      })
      .parse(req.body);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Check if this is a platform admin test token
    let tenantId: string;
    if (apiKey.startsWith('test_')) {
      const testTokenData = widgetTestTokens.get(apiKey);
      if (!testTokenData) {
        return res.status(401).json({ error: 'Invalid or expired test token' });
      }
      tenantId = testTokenData.tenantId;
      console.log('[Widget Test] Platform admin ending test chat for tenant:', tenantId);
    } else {
      // Validate regular API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      tenantId = apiKeyRecord.tenantId;
    }

    // Get widget configuration for domain validation
    const widgetConfig = await storage.getWidgetConfig(tenantId);
    if (!widgetConfig) {
      return res.status(500).json({ error: 'Widget configuration not found' });
    }

    // Validate domain restriction
    if (!validateWidgetDomain(widgetConfig, referrer)) {
      return res.status(403).json({
        error: 'Domain not allowed',
        message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
      });
    }

    // If there's an active handoff, resolve it
    if (handoffId) {
      const handoff = await storage.getWidgetHandoff(handoffId);

      if (handoff && handoff.tenantId === tenantId && handoff.status === 'active') {
        // Update handoff status to resolved
        await storage.updateWidgetHandoffStatus(handoffId, 'resolved');

        // Decrement agent's active chats
        if (handoff.assignedAgentId) {
          await storage.decrementActiveChats(handoff.assignedAgentId, tenantId);
        }

        // Add system message that user ended the chat
        await storage.createWidgetHandoffMessage({
          handoffId,
          senderType: 'system',
          senderId: null,
          content: 'User ended the chat',
        });

        // Broadcast via WebSocket to agent
        const wss = (req as any).ws;
        if (wss) {
          wss.clients.forEach((client: any) => {
            if (client.tenantId === tenantId && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: 'handoff_resolved',
                  handoffId: handoffId,
                  resolvedBy: 'user',
                }),
              );
            }
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Chat ended successfully',
    });
  } catch (error) {
    console.error('[Widget End Chat] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to end chat' });
  }
});

// CORS preflight for end chat
router.options('/api/widget/end-chat', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

export default router;
