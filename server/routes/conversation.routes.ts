/**
 * Conversation Routes
 * Conversation and message management
 */

import { Router } from 'express';
import {
  requireAuth,
  type AuthenticatedRequest,
  assertTenant,
} from '../middleware/auth.middleware';
import { storage } from '../storage';
import { insertMessageSchema, insertConversationSchema } from '@shared/schema';
import { z } from 'zod';
import { broadcastToTenant } from '../websocket';
import Retell from 'retell-sdk';

const router = Router();

// Helper function to get AI response from Retell agent
async function getRetellAgentResponse(
  userMessage: string,
  conversationId: string,
  conversation: any,
  tenantId: string,
): Promise<string> {
  try {
    // Get tenant's widget config to find their Retell agent ID
    const widgetConfig = await storage.getWidgetConfig(tenantId);

    // Enforce tenant isolation: no agent ID = no chat
    if (!widgetConfig?.retellAgentId) {
      console.error(`[Retell] Tenant ${tenantId} has no configured Retell agent ID`);
      throw new Error(
        'Retell agent ID not configured. Please complete your widget configuration to enable AI chat.',
      );
    }

    const agentId = widgetConfig.retellAgentId;

    // Check if this conversation already has a Retell chat session
    let retellChatId = conversation.metadata?.retellChatId;

    // If no Retell session exists, create one
    if (!widgetConfig?.retellApiKey) {
      throw new Error('Retell API key not configured for this tenant.');
    }
    if (!retellChatId) {
      console.log('[Retell] Creating new chat session for conversation:', conversationId);
      console.log('[Retell] Using agent ID:', agentId);

      const tenantRetellClient = new Retell({ apiKey: widgetConfig.retellApiKey });
      const chatSession = await tenantRetellClient.chat.create({
        agent_id: agentId,
        metadata: {
          conversationId: conversationId,
          tenantId: tenantId,
        },
      });

      retellChatId = chatSession.chat_id;

      // Save Retell chat ID to conversation metadata (with tenantId for security)
      await storage.updateConversationMetadata(
        conversationId,
        {
          retellChatId: retellChatId,
        },
        tenantId,
      );

      console.log('[Retell] Created chat session:', retellChatId);
    }

    // Send message to Retell and get response
    const tenantRetellClient = new Retell({ apiKey: widgetConfig.retellApiKey });
    console.log('[Retell] Sending message to agent:', userMessage);
    const completion = await tenantRetellClient.chat.createChatCompletion({
      chat_id: retellChatId,
      content: userMessage,
    });

    // Extract the agent's response from the completion
    // The response includes full conversation history, we want the last assistant message
    const messages = completion.messages || [];

    // Debug: Log the response structure
    console.log('[Retell] Messages array length:', messages.length);
    if (messages.length > 0) {
      console.log(
        '[Retell] Message roles:',
        messages.map((m: any) => m.role),
      );
    }

    // Find the last agent message
    const lastAssistantMessage = messages
      .reverse()
      .find((msg: any) => msg.role === 'agent' || msg.role === 'assistant');

    if (!lastAssistantMessage) {
      // Sometimes the agent is processing tools and hasn't generated a response yet
      // Check if there are only tool messages
      const hasToolMessages = messages.some(
        (msg: any) => msg.role === 'tool_call_invocation' || msg.role === 'tool_call_result',
      );

      if (hasToolMessages) {
        console.log(
          '[Retell] Agent is processing, no text response yet. Treating as acknowledgment.',
        );
        return "I'm processing your request...";
      }

      console.error('[Retell] No agent/assistant message found and no tool processing detected');
      console.error('[Retell] Full response:', JSON.stringify(completion, null, 2));
      throw new Error('No agent response in Retell completion');
    }

    const content = (lastAssistantMessage as any).content;
    if (typeof content === 'string') {
      console.log('[Retell] Received response:', content.slice(0, 100) + '...');
      return content;
    }

    console.error('[Retell] Message content is not a string:', typeof content);
    throw new Error('Invalid message content format from Retell');
  } catch (error) {
    console.error('[Retell] Error getting agent response:', error);
    throw new Error('Failed to get response from Retell agent');
  }
}

// Get messages for a conversation (PROTECTED)
router.get('/api/messages/:conversationId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate tenant ID exists in token
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;

    const { conversationId } = req.params;
    const messages = await storage.getMessagesByConversation(conversationId, tenantId);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create a new message and get AI response (PROTECTED)
router.post('/api/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate tenant ID exists in token
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;

    const validatedData = insertMessageSchema.parse(req.body);

    // Verify conversation exists and belongs to user's tenant
    const conversation = await storage.getConversation(validatedData.conversationId, tenantId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Save user message (server injects tenantId for security)
    const userMessage = await storage.createMessage(
      {
        ...validatedData,
        senderType: 'user', // Explicitly mark as end-user message
      },
      tenantId,
    );

    // Broadcast user message to all connected clients in this tenant
    broadcastToTenant(tenantId, 'message:created', {
      message: userMessage,
      conversationId: validatedData.conversationId,
    });

    // Get AI response using Retell AI agent
    try {
      const aiResponseContent = await getRetellAgentResponse(
        validatedData.content,
        validatedData.conversationId,
        conversation,
        tenantId,
      );

      const aiMessage = await storage.createMessage(
        {
          conversationId: validatedData.conversationId,
          role: 'assistant',
          content: aiResponseContent,
          senderType: 'ai', // Explicitly mark as AI agent message
        },
        tenantId,
      );

      // Broadcast AI message to all connected clients in this tenant
      broadcastToTenant(tenantId, 'message:created', {
        message: aiMessage,
        conversationId: validatedData.conversationId,
      });

      res.json({ userMessage, aiMessage });
    } catch (aiError) {
      console.error('AI response error:', aiError);
      // Return user message even if AI fails
      res.json({
        userMessage,
        aiMessage: null,
        error: 'AI response unavailable',
      });
    }
  } catch (error) {
    console.error('Error creating message:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create message' });
    }
  }
});

// Get all conversations for authenticated tenant (PROTECTED)
router.get('/api/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate tenant ID exists in token
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;

    const conversations = await storage.getConversationsByTenant(tenantId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Create a new conversation (PROTECTED)
router.post('/api/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate tenant ID exists in token
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;

    // Parse and validate request body (server injects tenantId for security)
    const validatedData = insertConversationSchema.parse(req.body);
    const conversation = await storage.createConversation(validatedData, tenantId);
    res.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }
});

// End a conversation (and its Retell chat session)
router.post(
  '/api/conversations/:conversationId/end',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const { conversationId } = req.params;

      // Get the conversation and verify it belongs to user's tenant
      const conversation = await storage.getConversation(conversationId, tenantId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // End the Retell chat session if it exists
      const metadata = conversation.metadata as {
        retellChatId?: string;
      } | null;
      const retellChatId = metadata?.retellChatId;
      if (retellChatId) {
        try {
          // Get tenant's widget config for API key
          const widgetConfig = await storage.getWidgetConfig(tenantId);
          if (widgetConfig?.retellApiKey) {
            const tenantRetellClient = new Retell({ apiKey: widgetConfig.retellApiKey });
            console.log('[Retell] Ending chat session:', retellChatId);
            await tenantRetellClient.chat.end(retellChatId);
            console.log('[Retell] Chat session ended successfully');
          } else {
            console.warn('[Retell] No API key configured for tenant, cannot end chat session.');
          }
        } catch (retellError) {
          console.error('[Retell] Error ending chat session:', retellError);
          // Continue even if Retell end fails
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error ending conversation:', error);
      res.status(500).json({ error: 'Failed to end conversation' });
    }
  },
);

export default router;
