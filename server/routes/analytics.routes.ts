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
  requireClientAdmin,
  assertTenant,
} from '../middleware/auth.middleware';
import Retell from 'retell-sdk';

const router = Router();

// ============================================
// CHAT ANALYTICS API ENDPOINTS (Platform Admin + Client Admin)
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/analytics/overview
 * Get combined analytics overview (voice + chat)
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/overview',
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

      // Get chat analytics summary
      const chatSummary = await storage.getChatAnalyticsSummary(tenantId, filters);

      // Get voice analytics summary
      const voiceSummary = await storage.getVoiceAnalyticsSummary(tenantId, filters);

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

      res.json(response);
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      res.status(500).json({ error: 'Failed to fetch analytics overview' });
    }
  },
);

/**
 * GET /api/platform/tenants/:tenantId/analytics/chats
 * Get list of chat sessions with filters
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/chats',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
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
  },
);

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

      const filters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const agentBreakdown = await storage.getChatAnalyticsAgentBreakdown(tenantId, filters);

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

      // NOTE: retell_transcript_messages table was dropped in migration 0015
      // Messages are stored in widget_chat_history during the conversation
      // To get chat history, fetch from widget_chat_history using chat.chatId

      res.json({
        ...chat,
        messages: [], // Transcript messages not stored by design
        note: 'Real-time messages available in widget_chat_history table',
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
router.get(
  '/:tenantId/analytics/costs',
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
  },
);

// ============================================
// VOICE ANALYTICS API ENDPOINTS (Platform Admin + Client Admin)
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/analytics/calls
 * Get list of voice call sessions with filters
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/analytics/calls',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
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
  },
);

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

// ============================================
// LEGACY ANALYTICS ENDPOINTS (Client Admin Only)
// ============================================
// Note: /summary endpoint removed (used deleted daily_analytics table)
// Use /api/analytics/chat and /api/analytics/voice endpoints instead

// Get analytics from Retell AI (PROTECTED)
router.get('/retell', requireAuth, requireClientAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate tenant ID exists in token
    const tenantId = assertTenant(req, res);
    if (!tenantId) return;

    // Get tenant's widget config to find their Retell API key
    const widgetConfig = await storage.getWidgetConfig(tenantId);

    // If no widget config or no API key configured, return empty analytics
    if (!widgetConfig?.retellApiKey) {
      console.log(`[Analytics] No Retell API key configured for tenant: ${tenantId}`);
      return res.json({
        totalCalls: 0,
        completedCalls: 0,
        averageDuration: 0,
        averageLatency: 0,
        successRate: 0,
        sentimentBreakdown: {
          Positive: 0,
          Negative: 0,
          Neutral: 0,
          Unknown: 0,
        },
        disconnectionReasons: {},
        callStatusBreakdown: {},
        callsOverTime: [],
        directionBreakdown: { inbound: 0, outbound: 0 },
      });
    }

    // Create a Retell client using the tenant's own API key
    const tenantRetellClient = new Retell({
      apiKey: widgetConfig.retellApiKey,
    });

    // Get time range from query params (default to all time)
    const { start_date, end_date } = req.query;

    // Build filter for time range (NO agent_id filter - we want ALL agents in this account)
    const filter: any = {};

    // Add time filtering if provided
    if (start_date) {
      filter.start_timestamp = {
        gte: new Date(start_date as string).getTime(),
      };
    }
    if (end_date) {
      filter.start_timestamp = {
        ...filter.start_timestamp,
        lte: new Date(end_date as string).getTime(),
      };
    }

    let calls: any[] = [];
    let agentNames: Record<string, string> = {}; // Declare in outer scope

    console.log(`[Analytics] Fetching account-wide calls for tenant: ${tenantId}`);
    console.log(`[Analytics] Filter criteria:`, JSON.stringify(filter, null, 2));

    try {
      // First, fetch list of active (non-deleted) agents and store their names
      let activeAgentIds: Set<string>;
      try {
        const activeAgents = await tenantRetellClient.agent.list();
        activeAgentIds = new Set(activeAgents.map((agent: any) => agent.agent_id));
        activeAgents.forEach((agent: any) => {
          if (agent.agent_id && agent.agent_name) {
            agentNames[agent.agent_id] = agent.agent_name;
          }
        });
        console.log(`[Analytics] Found ${activeAgentIds.size} active agents in account`);
      } catch (agentError) {
        console.warn(`[Analytics] Could not fetch agent list, including all calls:`, agentError);
        activeAgentIds = new Set(); // Empty set means we'll include all calls
      }

      // Fetch ALL calls from tenant's Retell account with pagination
      // Retell uses pagination_key (last call_id) for pagination
      let paginationKey: string | undefined = undefined;
      let pageCount = 0;
      const maxLimit = 1000; // Retell's max limit per request

      do {
        pageCount++;
        const pageParams: any = {
          filter_criteria: Object.keys(filter).length > 0 ? filter : undefined,
          limit: maxLimit,
          sort_order: 'descending', // Most recent first
        };

        if (paginationKey) {
          pageParams.pagination_key = paginationKey;
        }

        console.log(
          `[Analytics] Fetching page ${pageCount} with params:`,
          JSON.stringify({ limit: maxLimit, has_pagination_key: !!paginationKey }, null, 2),
        );

        const response: any = await tenantRetellClient.call.list(pageParams);

        // Retell returns an array of calls
        if (Array.isArray(response) && response.length > 0) {
          calls.push(...response);
          console.log(
            `[Analytics] Page ${pageCount}: Fetched ${response.length} calls (total so far: ${calls.length})`,
          );

          // If we got the max limit, there might be more pages
          // Use the last call's ID as pagination key for next request
          if (response.length === maxLimit) {
            const lastCall = response[response.length - 1];
            paginationKey = lastCall.call_id;
            console.log(`[Analytics] More pages available, next pagination_key: ${paginationKey}`);
          } else {
            // Got fewer than max limit, this is the last page
            paginationKey = undefined;
            console.log(`[Analytics] Last page reached (got ${response.length} < ${maxLimit})`);
          }
        } else {
          // Empty response or not an array
          paginationKey = undefined;
          console.log(`[Analytics] No more calls to fetch`);
        }

        // Safety limit: prevent infinite loops (max 100 pages = 100,000 calls)
        if (pageCount >= 100) {
          console.warn(
            `[Analytics] Reached pagination safety limit (100 pages, ${calls.length} total calls)`,
          );
          break;
        }
      } while (paginationKey);

      console.log(`[Analytics] ✓ Fetched ${calls.length} total calls across ${pageCount} pages`);

      // Filter out calls from deleted agents (if we successfully fetched agent list)
      if (activeAgentIds.size > 0) {
        const callsBeforeFilter = calls.length;
        calls = calls.filter((call: any) => activeAgentIds.has(call.agent_id));
        const callsRemoved = callsBeforeFilter - calls.length;

        if (callsRemoved > 0) {
          console.log(`[Analytics] Filtered out ${callsRemoved} calls from deleted agents`);
          console.log(
            `[Analytics] Remaining: ${calls.length} calls from ${activeAgentIds.size} active agents`,
          );
        }
      }

      // Filter by date range manually (Retell API doesn't respect filter_criteria for dates)
      if (Object.keys(filter).length > 0 && filter.start_timestamp) {
        const beforeDateFilter = calls.length;
        calls = calls.filter((call: any) => {
          if (!call.start_timestamp) return false;

          if (filter.start_timestamp.gte && call.start_timestamp < filter.start_timestamp.gte) {
            return false;
          }
          if (filter.start_timestamp.lte && call.start_timestamp > filter.start_timestamp.lte) {
            return false;
          }
          return true;
        });

        const dateFiltered = beforeDateFilter - calls.length;
        if (dateFiltered > 0) {
          console.log(
            `[Analytics] Filtered out ${dateFiltered} calls outside date range (${beforeDateFilter} → ${calls.length})`,
          );
        }
      }

      if (calls.length > 0) {
        const agentIds = Array.from(new Set(calls.map((c: any) => c.agent_id)));
        console.log(
          `[Analytics] Final dataset: ${calls.length} calls across ${agentIds.length} agents:`,
          agentIds,
        );

        // Log call status breakdown to debug discrepancies
        const statusCounts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};
        const directionCounts: Record<string, number> = {};

        calls.forEach((call: any) => {
          const status = call.call_status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;

          const type = call.call_type || 'unknown';
          typeCounts[type] = (typeCounts[type] || 0) + 1;

          const direction = call.direction || 'unknown';
          directionCounts[direction] = (directionCounts[direction] || 0) + 1;
        });

        console.log(`[Analytics] Call status breakdown:`, statusCounts);
        console.log(`[Analytics] Call type breakdown:`, typeCounts);
        console.log(`[Analytics] Call direction breakdown:`, directionCounts);

        // Check for calls with zero/null duration (might be filtered by Retell)
        const zeroDurationCalls = calls.filter((c: any) => !c.duration_ms || c.duration_ms === 0);
        if (zeroDurationCalls.length > 0) {
          console.log(
            `[Analytics] Found ${zeroDurationCalls.length} calls with zero/null duration`,
          );
        }

        // Check web_call vs phone_call
        const webCalls = calls.filter((c: any) => c.call_type === 'web_call');
        console.log(
          `[Analytics] Web calls: ${webCalls.length}, Phone calls: ${
            calls.length - webCalls.length
          }`,
        );

        // Check date range of actual calls received
        if (calls.length > 0) {
          const timestamps = calls
            .map((c: any) => c.start_timestamp)
            .filter(Boolean)
            .sort((a, b) => a - b);
          if (timestamps.length > 0) {
            const earliest = new Date(timestamps[0]).toISOString();
            const latest = new Date(timestamps[timestamps.length - 1]).toISOString();
            console.log(`[Analytics] Actual call date range: ${earliest} to ${latest}`);
          }
        }
      }
    } catch (retellError: any) {
      console.error('[Retell] Error fetching calls:', retellError);
      console.error('[Retell] Error details:', JSON.stringify(retellError, null, 2));
      console.error('[Retell] Error message:', retellError.message);
      // Return empty analytics if Retell API fails (don't break the dashboard)
      return res.json({
        totalCalls: 0,
        completedCalls: 0,
        averageDuration: 0,
        averageLatency: 0,
        successRate: 0,
        sentimentBreakdown: {
          Positive: 0,
          Negative: 0,
          Neutral: 0,
          Unknown: 0,
        },
        disconnectionReasons: {},
        callStatusBreakdown: {},
        callsOverTime: [],
        directionBreakdown: { inbound: 0, outbound: 0 },
      });
    }

    // Aggregate analytics data
    let totalDuration = 0;
    let totalLatency = 0;
    let successfulCalls = 0;
    let completedCalls = 0;
    let pickedUpCalls = 0;
    let transferredCalls = 0;
    let voicemailCalls = 0;

    const sentimentCounts: Record<string, number> = {};
    const disconnectionReasons: Record<string, number> = {};
    const callStatusBreakdown: Record<string, number> = {};
    const callsByDate: Record<string, number> = {};
    const directionBreakdown: Record<string, number> = {
      inbound: 0,
      outbound: 0,
    };

    // Additional tracking for charts
    const callsByDateStacked: Record<string, any> = {};
    const agentMetrics: Record<string, any> = {};

    for (const call of calls) {
      const agentId = call.agent_id;
      const dateKey = call.start_timestamp
        ? new Date(call.start_timestamp).toISOString().split('T')[0]
        : 'unknown';

      // Initialize agent metrics if not exists
      if (agentId && !agentMetrics[agentId]) {
        agentMetrics[agentId] = {
          totalCalls: 0,
          successfulCalls: 0,
          pickedUpCalls: 0,
          transferredCalls: 0,
          voicemailCalls: 0,
        };
      }

      // Initialize date metrics if not exists
      if (!callsByDateStacked[dateKey]) {
        callsByDateStacked[dateKey] = {
          successful: 0,
          unsuccessful: 0,
          agentHangup: 0,
          callTransfer: 0,
          userHangup: 0,
          otherDisconnection: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          otherSentiment: 0,
        };
      }

      // Count call status
      if (call.call_status) {
        callStatusBreakdown[call.call_status] = (callStatusBreakdown[call.call_status] || 0) + 1;
      }

      // Count direction (for all calls, not just completed)
      if (call.direction) {
        directionBreakdown[call.direction] = (directionBreakdown[call.direction] || 0) + 1;
      }

      // Track all calls metrics (not just ended)
      if (agentId) {
        agentMetrics[agentId].totalCalls++;
      }

      // Only analyze completed calls
      if (call.call_status === 'ended') {
        completedCalls++;

        // Duration
        if (call.duration_ms) {
          totalDuration += call.duration_ms;
        }

        // Latency (use e2e p50 if available)
        if (call.latency?.e2e?.p50) {
          totalLatency += call.latency.e2e.p50;
        }

        // Success rate (call_successful)
        const isSuccessful = call.call_analysis?.call_successful === true;
        if (isSuccessful) {
          successfulCalls++;
          if (agentId) agentMetrics[agentId].successfulCalls++;
          callsByDateStacked[dateKey].successful++;
        } else {
          callsByDateStacked[dateKey].unsuccessful++;
        }

        // Pickup rate (if call was answered/picked up)
        // A call is picked up if it wasn't disconnected before being answered
        if (
          call.disconnection_reason !== 'voicemail' &&
          call.disconnection_reason !== 'no_answer'
        ) {
          pickedUpCalls++;
          if (agentId) agentMetrics[agentId].pickedUpCalls++;
        }

        // Transfer rate
        if (call.disconnection_reason === 'call_transfer') {
          transferredCalls++;
          if (agentId) agentMetrics[agentId].transferredCalls++;
          callsByDateStacked[dateKey].callTransfer++;
        }

        // Voicemail rate
        if (call.disconnection_reason === 'voicemail') {
          voicemailCalls++;
          if (agentId) agentMetrics[agentId].voicemailCalls++;
        }

        // Sentiment
        const sentiment = call.call_analysis?.user_sentiment || 'unknown';
        sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;

        // Sentiment by date for stacked chart
        if (sentiment === 'positive') {
          callsByDateStacked[dateKey].positive++;
        } else if (sentiment === 'neutral') {
          callsByDateStacked[dateKey].neutral++;
        } else if (sentiment === 'negative') {
          callsByDateStacked[dateKey].negative++;
        } else {
          callsByDateStacked[dateKey].otherSentiment++;
        }

        // Disconnection reason
        const disconnectReason = call.disconnection_reason || 'unknown';
        disconnectionReasons[disconnectReason] = (disconnectionReasons[disconnectReason] || 0) + 1;

        // Disconnection by date for stacked chart
        if (disconnectReason === 'agent_hangup') {
          callsByDateStacked[dateKey].agentHangup++;
        } else if (disconnectReason === 'user_hangup') {
          callsByDateStacked[dateKey].userHangup++;
        } else if (disconnectReason !== 'call_transfer') {
          callsByDateStacked[dateKey].otherDisconnection++;
        }

        // Calls over time
        if (call.start_timestamp) {
          const date = new Date(call.start_timestamp).toISOString().split('T')[0];
          callsByDate[date] = (callsByDate[date] || 0) + 1;
        }
      }
    }

    // Calculate averages
    const averageDuration = completedCalls > 0 ? totalDuration / completedCalls : 0;
    const averageLatency = completedCalls > 0 ? totalLatency / completedCalls : 0;
    const successRate = completedCalls > 0 ? (successfulCalls / completedCalls) * 100 : 0;
    const pickupRate = completedCalls > 0 ? (pickedUpCalls / completedCalls) * 100 : 0;
    const transferRate = completedCalls > 0 ? (transferredCalls / completedCalls) * 100 : 0;
    const voicemailRate = completedCalls > 0 ? (voicemailCalls / completedCalls) * 100 : 0;

    // Format sentiment breakdown as percentages
    const sentimentBreakdown: Record<string, number> = {};
    for (const [sentiment, count] of Object.entries(sentimentCounts)) {
      sentimentBreakdown[sentiment] = completedCalls > 0 ? (count / completedCalls) * 100 : 0;
    }

    // Calculate per-date metrics for time-series charts
    const dailyMetrics: Record<string, any> = {};

    for (const call of calls) {
      if (call.call_status !== 'ended') continue;

      const dateKey = call.start_timestamp
        ? new Date(call.start_timestamp).toISOString().split('T')[0]
        : 'unknown';

      if (!dailyMetrics[dateKey]) {
        dailyMetrics[dateKey] = {
          totalCalls: 0,
          successfulCalls: 0,
          pickedUpCalls: 0,
          transferredCalls: 0,
          voicemailCalls: 0,
          totalDuration: 0,
          totalLatency: 0,
          callsWithLatency: 0,
        };
      }

      dailyMetrics[dateKey].totalCalls++;

      if (call.call_analysis?.call_successful) {
        dailyMetrics[dateKey].successfulCalls++;
      }

      if (call.disconnection_reason !== 'voicemail' && call.disconnection_reason !== 'no_answer') {
        dailyMetrics[dateKey].pickedUpCalls++;
      }

      if (call.disconnection_reason === 'call_transfer') {
        dailyMetrics[dateKey].transferredCalls++;
      }

      if (call.disconnection_reason === 'voicemail') {
        dailyMetrics[dateKey].voicemailCalls++;
      }

      if (call.duration_ms) {
        dailyMetrics[dateKey].totalDuration += call.duration_ms;
      }

      if (call.latency?.e2e?.p50) {
        dailyMetrics[dateKey].totalLatency += call.latency.e2e.p50;
        dailyMetrics[dateKey].callsWithLatency++;
      }
    }

    // Format daily metrics for time-series charts
    const dailyMetricsArray = Object.entries(dailyMetrics)
      .map(([date, metrics]: [string, any]) => ({
        date,
        pickupRate:
          metrics.totalCalls > 0
            ? Math.round((metrics.pickedUpCalls / metrics.totalCalls) * 100)
            : 0,
        successRate:
          metrics.totalCalls > 0
            ? Math.round((metrics.successfulCalls / metrics.totalCalls) * 100)
            : 0,
        transferRate:
          metrics.totalCalls > 0
            ? Math.round((metrics.transferredCalls / metrics.totalCalls) * 100)
            : 0,
        voicemailRate:
          metrics.totalCalls > 0
            ? Math.round((metrics.voicemailCalls / metrics.totalCalls) * 100)
            : 0,
        avgDuration:
          metrics.totalCalls > 0
            ? Math.round(metrics.totalDuration / metrics.totalCalls / 1000)
            : 0, // seconds
        avgLatency:
          metrics.callsWithLatency > 0
            ? Math.round(metrics.totalLatency / metrics.callsWithLatency)
            : 0, // ms
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format calls over time for charting
    const callsOverTime = Object.entries(callsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format stacked data for charts
    const callsByDateStackedArray = Object.entries(callsByDateStacked)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Format agent metrics for horizontal bar charts
    const agentMetricsArray = Object.entries(agentMetrics).map(
      ([agentId, metrics]: [string, any]) => ({
        agentId,
        agentName: agentNames[agentId] || agentId, // Use agent name if available, fallback to ID
        successRate:
          metrics.totalCalls > 0 ? (metrics.successfulCalls / metrics.totalCalls) * 100 : 0,
        pickupRate: metrics.totalCalls > 0 ? (metrics.pickedUpCalls / metrics.totalCalls) * 100 : 0,
        transferRate:
          metrics.totalCalls > 0 ? (metrics.transferredCalls / metrics.totalCalls) * 100 : 0,
        voicemailRate:
          metrics.totalCalls > 0 ? (metrics.voicemailCalls / metrics.totalCalls) * 100 : 0,
        totalCalls: metrics.totalCalls,
      }),
    );

    // IMPORTANT: Retell's dashboard applies multiple filters:
    // 1. Only "ended" status calls (not error, ongoing, etc.)
    // 2. Only phone_call type (exclude web_call)
    // 3. Only calls with positive duration (exclude null/zero duration)
    const endedCalls = calls.filter(
      (call: any) =>
        call.call_status === 'ended' &&
        call.call_type === 'phone_call' &&
        call.duration_ms &&
        call.duration_ms > 0,
    );
    console.log(
      `[Analytics] Filtered to phone calls with duration: ${endedCalls.length} out of ${calls.length} total`,
    );

    res.json({
      totalCalls: endedCalls.length, // Only count completed/ended calls to match Retell dashboard
      completedCalls,
      averageDuration: Math.round(averageDuration / 1000), // Convert to seconds
      averageLatency: Math.round(averageLatency), // Already in ms
      successRate: Math.round(successRate),
      pickupRate: Math.round(pickupRate),
      transferRate: Math.round(transferRate),
      voicemailRate: Math.round(voicemailRate),
      sentimentBreakdown,
      disconnectionReasons,
      callStatusBreakdown,
      callsOverTime,
      dailyMetrics: dailyMetricsArray, // Per-date metrics for time-series charts
      callsByDateStacked: callsByDateStackedArray,
      agentMetrics: agentMetricsArray,
      directionBreakdown,
    });
  } catch (error) {
    console.error('Error fetching Retell analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * POST /api/platform/admin/fix-costs
 * One-time backfill endpoint to fix cost values
 * PLATFORM ADMIN ONLY
 * Divides all costs > 10 by 100 (converts cents to dollars)
 */
router.post(
  '/admin/fix-costs',
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log('[Admin] Cost backfill requested by:', req.user!.email);

      // Create a direct database connection
      const pg = await import('pg');
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

      try {
        // Get current state
        const before = await pool.query(`
          SELECT 
            COUNT(*) as total_records,
            MIN(combined_cost) as min_cost,
            MAX(combined_cost) as max_cost,
            AVG(combined_cost) as avg_cost,
            SUM(combined_cost) as total_cost
          FROM chat_analytics
          WHERE combined_cost IS NOT NULL AND combined_cost > 0
        `);

        const likelyCents = await pool.query(`
          SELECT COUNT(*) as count
          FROM chat_analytics
          WHERE combined_cost > 10
        `);

        const recordsToFix = parseInt(String(likelyCents.rows[0].count));

        if (recordsToFix === 0) {
          await pool.end();
          return res.json({
            message: 'No records need fixing',
            before: before.rows[0],
          });
        }

        // Update costs: Divide by 100 if > 10 (cents), leave as-is if <= 10 (already in dollars)
        const result = await pool.query(`
          UPDATE chat_analytics
          SET combined_cost = CASE
            WHEN combined_cost > 10 THEN combined_cost / 100
            ELSE combined_cost
          END
          WHERE combined_cost IS NOT NULL AND combined_cost > 0
        `);

        // Get after state
        const after = await pool.query(`
          SELECT 
            COUNT(*) as total_records,
            MIN(combined_cost) as min_cost,
            MAX(combined_cost) as max_cost,
            AVG(combined_cost) as avg_cost,
            SUM(combined_cost) as total_cost
          FROM chat_analytics
          WHERE combined_cost IS NOT NULL AND combined_cost > 0
        `);

        await pool.end();

        console.log('[Admin] Cost backfill completed:', {
          recordsUpdated: result.rowCount,
          before: before.rows[0],
          after: after.rows[0],
        });

        res.json({
          success: true,
          message: `Successfully updated ${result.rowCount} records`,
          recordsUpdated: result.rowCount,
          before: before.rows[0],
          after: after.rows[0],
        });
      } catch (error) {
        await pool.end();
        throw error;
      }
    } catch (error) {
      console.error('[Admin] Error during cost backfill:', error);
      res.status(500).json({ error: 'Failed to fix costs' });
    }
  },
);

export default router;
