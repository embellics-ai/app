/**
 * Handoff Routes
 * Human agent handoff management
 */

import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  type AuthenticatedRequest,
  requireAuth,
  assertTenant,
} from '../middleware/auth.middleware';
import { insertHumanAgentSchema } from '@shared/schema';
import { broadcastToTenant } from '../websocket';

const router = Router();

// Helper function to generate conversation summary
async function generateConversationSummary(messages: any[]): Promise<string> {
  try {
    // If no messages, return default summary
    if (!messages || messages.length === 0) {
      return 'New conversation with no messages yet.';
    }

    // Create a simple summary from the conversation
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const summary = `Conversation Summary:
- Total messages: ${messages.length}
- User messages: ${userMessages.length}
- Assistant messages: ${assistantMessages.length}
- Latest user message: ${userMessages[userMessages.length - 1]?.content || 'N/A'}
- Topic: Customer inquiry requiring human assistance`;

    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Unable to generate summary';
  }
}

// ============================================
// HUMAN AGENTS CRUD ENDPOINTS (PROTECTED)
// ============================================

// Get all human agents for tenant
router.get('/api/human-agents', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const agents = await storage.getHumanAgentsByTenant(tenantId);
    res.json(agents);
  } catch (error) {
    console.error('Error fetching human agents:', error);
    res.status(500).json({ error: 'Failed to fetch human agents' });
  }
});

// Create a new human agent
router.post('/api/human-agents', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const agentData = insertHumanAgentSchema.parse(req.body);
    const agent = await storage.createHumanAgent(agentData, tenantId);
    res.json(agent);
  } catch (error) {
    console.error('Error creating human agent:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create human agent' });
    }
  }
});

// Update human agent status
router.patch(
  '/api/human-agents/:id/status',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const { status } = z.object({ status: z.string() }).parse(req.body);

      await storage.updateHumanAgentStatus(id, status, tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating agent status:', error);
      res.status(500).json({ error: 'Failed to update agent status' });
    }
  },
);

// Get available human agents
router.get('/api/human-agents/available', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const agents = await storage.getAvailableHumanAgents(tenantId);
    res.json(agents);
  } catch (error) {
    console.error('Error fetching available agents:', error);
    res.status(500).json({ error: 'Failed to fetch available agents' });
  }
});

// ============================================
// WIDGET HANDOFF MANAGEMENT ENDPOINTS (PROTECTED)
// ============================================

// Get all widget handoffs for tenant
router.get('/api/widget-handoffs', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const handoffs = await storage.getWidgetHandoffsByTenant(tenantId);
    res.json(handoffs);
  } catch (error) {
    console.error('Error fetching widget handoffs:', error);
    res.status(500).json({ error: 'Failed to fetch handoffs' });
  }
});

// Get pending widget handoffs
router.get('/api/widget-handoffs/pending', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const handoffs = await storage.getPendingWidgetHandoffs(tenantId);
    res.json(handoffs);
  } catch (error) {
    console.error('Error fetching pending handoffs:', error);
    res.status(500).json({ error: 'Failed to fetch pending handoffs' });
  }
});

// Get active widget handoffs
router.get('/api/widget-handoffs/active', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const handoffs = await storage.getActiveWidgetHandoffs(tenantId);
    res.json(handoffs);
  } catch (error) {
    console.error('Error fetching active handoffs:', error);
    res.status(500).json({ error: 'Failed to fetch active handoffs' });
  }
});

// Get specific widget handoff
router.get('/api/widget-handoffs/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const { id } = req.params;
    const handoff = await storage.getWidgetHandoff(id);

    if (!handoff || handoff.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    res.json(handoff);
  } catch (error) {
    console.error('Error fetching handoff:', error);
    res.status(500).json({ error: 'Failed to fetch handoff' });
  }
});

// Pick up a widget handoff (agent claims it)
router.post(
  '/api/widget-handoffs/:id/pickup',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;

      if (!req.user?.email) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const handoff = await storage.getWidgetHandoff(id);

      if (!handoff || handoff.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      if (handoff.status !== 'pending') {
        return res.status(400).json({ error: 'Handoff is not available' });
      }

      // Find agent record for this user
      const agents = await storage.getHumanAgentsByTenant(tenantId);
      const agent = agents.find((a) => a.email === req.user?.email);

      if (!agent) {
        return res.status(404).json({ error: 'Agent record not found' });
      }

      // Assign handoff to agent
      const updatedHandoff = await storage.assignHandoffToAgent(id, agent.id, tenantId);

      // Increment agent's active chats
      await storage.incrementActiveChats(agent.id, tenantId);

      // Broadcast via WebSocket
      const wss = (req as any).ws;
      if (wss) {
        wss.clients.forEach((client: any) => {
          if (client.tenantId === tenantId && client.readyState === 1) {
            client.send(
              JSON.stringify({
                type: 'handoff_picked_up',
                handoffId: id,
                agentId: agent.id,
                agentName: agent.name,
              }),
            );
          }
        });
      }

      res.json(updatedHandoff);
    } catch (error) {
      console.error('Error picking up handoff:', error);
      res.status(500).json({ error: 'Failed to pick up handoff' });
    }
  },
);

// Resolve a widget handoff
router.post(
  '/api/widget-handoffs/:id/resolve',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;

      const handoff = await storage.getWidgetHandoff(id);

      if (!handoff || handoff.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      if (handoff.status !== 'active') {
        return res.status(400).json({ error: 'Handoff is not active' });
      }

      // Find agent record for authorization check
      const agents = await storage.getHumanAgentsByTenant(tenantId);
      const agent = agents.find((a) => a.email === req.user?.email);

      if (!agent) {
        return res.status(404).json({ error: 'Agent record not found' });
      }

      // Authorization check: only the assigned agent can resolve
      if (handoff.assignedAgentId !== agent.id) {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'This conversation is assigned to another agent',
        });
      }

      // Update handoff status
      const updatedHandoff = await storage.updateWidgetHandoffStatus(id, 'resolved');

      // Decrement agent's active chats
      if (handoff.assignedAgentId) {
        await storage.decrementActiveChats(handoff.assignedAgentId, tenantId);
      }

      // Broadcast via WebSocket
      const wss = (req as any).ws;
      if (wss) {
        wss.clients.forEach((client: any) => {
          if (client.tenantId === tenantId && client.readyState === 1) {
            client.send(
              JSON.stringify({
                type: 'handoff_resolved',
                handoffId: id,
              }),
            );
          }
        });
      }

      res.json(updatedHandoff);
    } catch (error) {
      console.error('Error resolving handoff:', error);
      res.status(500).json({ error: 'Failed to resolve handoff' });
    }
  },
);

// Send message from agent to user (during active handoff)
router.post(
  '/api/widget-handoffs/:id/send-message',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const { message } = z.object({ message: z.string().min(1) }).parse(req.body);

      const handoff = await storage.getWidgetHandoff(id);

      if (!handoff || handoff.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      if (handoff.status !== 'active') {
        return res.status(400).json({ error: 'Handoff is not active' });
      }

      // Find agent record
      const agents = await storage.getHumanAgentsByTenant(tenantId);
      const agent = agents.find((a) => a.email === req.user?.email);

      if (!agent) {
        return res.status(404).json({ error: 'Agent record not found' });
      }

      // Authorization check: only the assigned agent can send messages
      if (handoff.assignedAgentId !== agent.id) {
        return res.status(403).json({
          error: 'Unauthorized',
          message: 'This conversation is assigned to another agent',
        });
      }

      // Save message
      const savedMessage = await storage.createWidgetHandoffMessage({
        handoffId: id,
        senderType: 'agent',
        senderId: agent.id,
        content: message,
      });

      // Broadcast to widget via WebSocket (if connected)
      const wss = (req as any).ws;
      if (wss) {
        wss.clients.forEach((client: any) => {
          // Widget clients don't have userId, only chatId or handoffId
          if (client.readyState === 1) {
            client.send(
              JSON.stringify({
                type: 'agent_message',
                handoffId: id,
                message: {
                  id: savedMessage.id,
                  content: savedMessage.content,
                  senderType: 'agent',
                  timestamp: savedMessage.timestamp,
                },
              }),
            );
          }
        });
      }

      res.json(savedMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to send message' });
    }
  },
);

// Get messages for a handoff
router.get(
  '/api/widget-handoffs/:id/messages',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;

      const handoff = await storage.getWidgetHandoff(id);

      if (!handoff || handoff.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      const messages = await storage.getWidgetHandoffMessages(id);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },
);

// ============================================
// HANDOFF LIFECYCLE MANAGEMENT (PROTECTED)
// ============================================
// Note: Handoff lifecycle events (trigger/assign/complete) are broadcast-only via WebSocket.
// They update conversation metadata but do not persist messages. Only actual chat messages
// from users, AI, or human agents are stored via storage.createMessage with explicit senderType.

// Trigger a handoff from AI to human agent (PROTECTED)
router.post('/api/handoff/trigger', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId, reason } = z
      .object({
        conversationId: z.string(),
        reason: z.string().optional(),
      })
      .parse(req.body);

    const tenantId = assertTenant(req, res);
    if (!tenantId) return;

    // Get handoff
    const handoff = await storage.getWidgetHandoff(conversationId);
    if (!handoff) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    // Generate conversation summary
    const messages = await storage.getWidgetHandoffMessages(conversationId);
    const summary = await generateConversationSummary(messages);

    // Update handoff status to pending_handoff
    await storage.updateWidgetHandoffStatus(conversationId, 'pending', {
      conversationHistory: summary,
      lastUserMessage: messages[messages.length - 1]?.content || '',
      metadata: {
        ...((handoff.metadata as object) || {}),
        handoffReason: reason || 'user_request',
      },
    });

    // Broadcast handoff event to tenant's admin dashboard
    broadcastToTenant(tenantId, 'handoff_requested', {
      conversationId,
      summary,
      reason: reason || 'user_request',
    });

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error triggering handoff:', error);
    res.status(500).json({ error: 'Failed to trigger handoff' });
  }
});

// Get pending handoffs for tenant
router.get('/api/handoff/pending', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const pending = await storage.getPendingWidgetHandoffs(tenantId);
    res.json(pending);
  } catch (error) {
    console.error('Error fetching pending handoffs:', error);
    res.status(500).json({ error: 'Failed to fetch pending handoffs' });
  }
});

// Assign human agent to widget handoff
router.post('/api/handoff/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const { conversationId, humanAgentId } = z
      .object({
        conversationId: z.string(), // This is actually the widget_handoff ID
        humanAgentId: z.string(),
      })
      .parse(req.body);

    console.log(`[Assign Handoff] Assigning handoff ${conversationId} to agent ${humanAgentId}`);

    // Get the widget handoff
    const handoff = await storage.getWidgetHandoff(conversationId);

    if (!handoff || handoff.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Handoff not found' });
    }

    if (handoff.status !== 'pending') {
      return res.status(400).json({ error: 'Handoff is not available for assignment' });
    }

    // Update widget handoff status to active and assign agent
    await storage.assignHandoffToAgent(conversationId, humanAgentId, tenantId);

    // Increment agent's active chats
    await storage.incrementActiveChats(humanAgentId, tenantId);

    console.log(
      `[Assign Handoff] Successfully assigned handoff ${conversationId} to agent ${humanAgentId}`,
    );

    // Broadcast assignment via WebSocket
    const wss = (req as any).ws;
    if (wss) {
      wss.clients.forEach((client: any) => {
        if (client.tenantId === tenantId && client.readyState === 1) {
          client.send(
            JSON.stringify({
              type: 'handoff_assigned',
              handoffId: conversationId,
              agentId: humanAgentId,
            }),
          );
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning handoff:', error);
    res.status(500).json({ error: 'Failed to assign handoff' });
  }
});

// Get ALL active handoffs for tenant (all agents)
router.get('/api/handoff/active', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const activeChats = await storage.getActiveWidgetHandoffs(tenantId);
    res.json(activeChats);
  } catch (error) {
    console.error('Error fetching active handoffs:', error);
    res.status(500).json({ error: 'Failed to fetch active handoffs' });
  }
});

// Get active chats for a specific human agent
router.get(
  '/api/handoff/agent/:agentId/active',
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { agentId } = req.params;

      const handoffs = await storage.getWidgetHandoffsByTenant(tenantId);
      const activeChats = handoffs.filter(
        (h) => h.status === 'active' && h.assignedAgentId === agentId,
      );

      res.json(activeChats);
    } catch (error) {
      console.error('Error fetching active chats:', error);
      res.status(500).json({ error: 'Failed to fetch active chats' });
    }
  },
);

// Send message from human agent
router.post('/api/handoff/send-message', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const { conversationId, content, humanAgentId } = z
      .object({
        conversationId: z.string(),
        content: z.string(),
        humanAgentId: z.string(),
      })
      .parse(req.body);

    // Verify handoff is assigned to this agent
    const handoff = await storage.getWidgetHandoff(conversationId);
    if (!handoff || handoff.assignedAgentId !== humanAgentId) {
      return res.status(403).json({ error: 'Not authorized for this handoff' });
    }

    // Create message
    const message = await storage.createWidgetHandoffMessage({
      handoffId: conversationId,
      senderType: 'agent',
      senderId: humanAgentId,
      content,
    });

    // Broadcast message to chat widget
    broadcastToTenant(tenantId, 'human_agent_message', {
      conversationId,
      message,
    });

    res.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Complete handoff (end human agent session)
router.post('/api/handoff/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;
    const { conversationId, humanAgentId } = z
      .object({
        conversationId: z.string(),
        humanAgentId: z.string(),
      })
      .parse(req.body);

    // Update handoff status to completed
    await storage.updateWidgetHandoffStatus(conversationId, 'resolved', {
      resolvedAt: new Date(),
    });

    // Decrement agent's active chats
    await storage.decrementActiveChats(humanAgentId, tenantId);

    // Broadcast completion
    broadcastToTenant(tenantId, 'handoff_completed', {
      conversationId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error completing handoff:', error);
    res.status(500).json({ error: 'Failed to complete handoff' });
  }
});

export default router;
