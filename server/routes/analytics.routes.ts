/**
 * Analytics Routes
 * Handles chat and voice analytics for platform admins and client admins
 * Platform admins can access any tenant's analytics
 * Client admins can only access their own tenant's analytics
 */

import { Router, Response } from 'express';
import { storage } from '../storage';
import {
  type AuthenticatedRequest,
  requireAuth,
  requirePlatformAdmin,
} from '../middleware/auth.middleware';

const router = Router();

// ============================================
// CHAT ANALYTICS API ENDPOINTS (Platform Admin + Client Admin)
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/analytics/overview
 * Get combined analytics overview (voice + chat)
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/analytics/overview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate, agentId } = req.query;

    console.log('[Analytics Overview] Request:', { tenantId, startDate, endDate, agentId });

    // Authorization: Platform admin can access any tenant, client admin only their own
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's analytics" });
    }

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      agentId: agentId as string | undefined,
    };

    console.log('[Analytics Overview] Filters:', filters);

    // Get chat analytics summary
    const chatSummary = await storage.getChatAnalyticsSummary(tenantId, filters);
    console.log('[Analytics Overview] Chat Summary:', chatSummary);

    // Get voice analytics summary
    const voiceSummary = await storage.getVoiceAnalyticsSummary(tenantId, filters);
    console.log('[Analytics Overview] Voice Summary:', voiceSummary);

    const response = {
      chat: chatSummary,
      voice: voiceSummary,
      combined: {
        totalInteractions: chatSummary.totalChats + voiceSummary.totalCalls,
        totalCost: chatSummary.totalCost + voiceSummary.totalCost,
        averageCost:
          chatSummary.totalChats + voiceSummary.totalCalls > 0
            ? (chatSummary.totalCost + voiceSummary.totalCost) /
              (chatSummary.totalChats + voiceSummary.totalCalls)
            : 0,
      },
    };

    console.log('[Analytics Overview] Response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * GET /api/platform/tenants/:tenantId/analytics/chats
 * Get list of chat sessions with filters
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/analytics/chats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate, agentId, sentiment, chatStatus, limit } = req.query;

    // Authorization: Platform admin can access any tenant, client admin only their own
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's analytics" });
    }

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      agentId: agentId as string | undefined,
      sentiment: sentiment as string | undefined,
      chatStatus: chatStatus as string | undefined,
      limit: limit ? parseInt(limit as string) : 100,
    };

    const chats = await storage.getChatAnalyticsByTenant(tenantId, filters);

    res.json(chats);
  } catch (error) {
    console.error('Error fetching chat analytics:', error);
    res.status(500).json({ error: 'Failed to fetch chat analytics' });
  }
});

/**
 * GET /api/platform/tenants/:tenantId/analytics/chats/time-series
 * Get time-series chat analytics for visualizations
 * IMPORTANT: This must come BEFORE the /:chatId route
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/chats/time-series',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { startDate, endDate, agentId, groupBy } = req.query;

      // Authorization: Platform admin can access any tenant, client admin only their own
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied to this tenant's analytics" });
      }

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        agentId: agentId as string | undefined,
        groupBy: (groupBy as 'hour' | 'day' | 'week') || 'day',
      };

      const timeSeriesData = await storage.getChatAnalyticsTimeSeries(tenantId, filters);

      res.json(timeSeriesData);
    } catch (error) {
      console.error('Error fetching time-series chat analytics:', error);
      res.status(500).json({ error: 'Failed to fetch time-series analytics' });
    }
  },
);

/**
 * GET /api/platform/tenants/:tenantId/analytics/chats/agent-breakdown
 * Get agent breakdown for chat analytics
 * IMPORTANT: This must come BEFORE the /:chatId route
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/chats/agent-breakdown',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { startDate, endDate } = req.query;

      // Authorization: Platform admin can access any tenant, client admin only their own
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied to this tenant's analytics" });
      }

      console.log('[Analytics Agent Breakdown] Querying for tenant:', tenantId);

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const agentBreakdown = await storage.getChatAnalyticsAgentBreakdown(tenantId, filters);

      console.log('[Analytics Agent Breakdown] Returning data:', {
        agentCount: agentBreakdown.length,
      });

      res.json(agentBreakdown);
    } catch (error) {
      console.error('Error fetching agent breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch agent breakdown' });
    }
  },
);

/**
 * GET /api/platform/tenants/:tenantId/analytics/chats/:chatId
 * Get detailed analytics for a specific chat session
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/chats/:chatId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, chatId } = req.params;

      // Authorization: Platform admin can access any tenant, client admin only their own
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied to this tenant's analytics" });
      }

      const chat = await storage.getChatAnalytics(chatId);

      if (!chat || chat.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      // Optionally get individual messages
      const messages = await storage.getChatMessages(chatId);

      res.json({
        ...chat,
        messages,
      });
    } catch (error) {
      console.error('Error fetching chat details:', error);
      res.status(500).json({ error: 'Failed to fetch chat details' });
    }
  },
);

/**
 * GET /api/platform/tenants/:tenantId/analytics/sentiment
 * Get sentiment analysis breakdown
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/sentiment',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { startDate, endDate, agentId } = req.query;

      // Authorization: Platform admin can access any tenant, client admin only their own
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied to this tenant's analytics" });
      }

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        agentId: agentId as string | undefined,
      };

      const summary = await storage.getChatAnalyticsSummary(tenantId, filters);

      res.json({
        sentimentBreakdown: summary.sentimentBreakdown,
        totalChats: summary.totalChats,
        successRate:
          summary.totalChats > 0 ? (summary.successfulChats / summary.totalChats) * 100 : 0,
      });
    } catch (error) {
      console.error('Error fetching sentiment analytics:', error);
      res.status(500).json({ error: 'Failed to fetch sentiment analytics' });
    }
  },
);

/**
 * GET /api/platform/tenants/:tenantId/analytics/costs
 * Get cost tracking analytics
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/analytics/costs', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate, agentId } = req.query;

    // Authorization: Platform admin can access any tenant, client admin only their own
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's analytics" });
    }

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      agentId: agentId as string | undefined,
    };

    const summary = await storage.getChatAnalyticsSummary(tenantId, filters);

    // Get individual chats for cost breakdown by day
    const chats = await storage.getChatAnalyticsByTenant(tenantId, filters);

    // Group costs by day
    const costsByDay: Record<string, number> = {};
    chats.forEach((chat) => {
      if (chat.startTimestamp) {
        const day = chat.startTimestamp.toISOString().split('T')[0];
        costsByDay[day] = (costsByDay[day] || 0) + (chat.combinedCost || 0);
      }
    });

    res.json({
      totalCost: summary.totalCost,
      averageCost: summary.averageCost,
      totalChats: summary.totalChats,
      costsByDay,
    });
  } catch (error) {
    console.error('Error fetching cost analytics:', error);
    res.status(500).json({ error: 'Failed to fetch cost analytics' });
  }
});

// ============================================
// VOICE ANALYTICS API ENDPOINTS (Platform Admin + Client Admin)
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/analytics/calls
 * Get list of voice call sessions with filters
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/analytics/calls', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate, agentId, sentiment, callStatus, limit } = req.query;

    // Authorization: Platform admin can access any tenant, client admin only their own
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's analytics" });
    }

    console.log('[Analytics Calls] Querying for tenant:', tenantId);
    console.log('[Analytics Calls] Filters:', {
      startDate,
      endDate,
      agentId,
      sentiment,
      callStatus,
      limit,
    });

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      agentId: agentId as string | undefined,
      sentiment: sentiment as string | undefined,
      callStatus: callStatus as string | undefined,
      limit: limit ? parseInt(limit as string) : 100,
    };

    const calls = await storage.getVoiceAnalyticsByTenant(tenantId, filters);

    console.log('[Analytics Calls] Found calls:', calls.length);
    if (calls.length > 0) {
      console.log('[Analytics Calls] First call sample:', {
        id: calls[0].id,
        tenantId: calls[0].tenantId,
        callId: calls[0].callId,
        agentId: calls[0].agentId,
      });
    }

    res.json(calls);
  } catch (error) {
    console.error('Error fetching voice analytics:', error);
    res.status(500).json({ error: 'Failed to fetch voice analytics' });
  }
});

/**
 * GET /api/platform/tenants/:tenantId/analytics/calls/:callId
 * Get detailed analytics for a specific voice call
 */
router.get(
  '/:tenantId/analytics/calls/:callId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, callId } = req.params;

      const call = await storage.getVoiceAnalytics(callId);

      if (!call || call.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Call not found' });
      }

      res.json(call);
    } catch (error) {
      console.error('Error fetching call details:', error);
      res.status(500).json({ error: 'Failed to fetch call details' });
    }
  },
);

export default router;
