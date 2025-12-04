# Analytics Page Fix - Chat Data Instead of Voice Calls

## Problem

The analytics page at `/analytics` was calling `/api/analytics/retell` which returns **Retell AI voice call data** (from phone calls), but the page was labeled and intended to show **chat widget analytics** (from web chat conversations). This caused:

- Wrong data displayed (voice calls instead of chat sessions)
- New chats not appearing (because they're in `chat_analytics` table, not fetched from Retell AI)
- Misleading labels ("Chat Count" showing voice call counts)

## Root Cause

During the routes refactoring, the analytics page was left calling the legacy Retell voice analytics endpoint instead of the proper chat analytics endpoints that were already implemented in `server/routes/analytics.routes.ts`.

## Solution

Completely rebuilt the analytics page to fetch from the correct **chat analytics endpoints**:

### Endpoints Used (NEW)

1. **`/api/platform/tenants/:tenantId/analytics/chats/agent-breakdown`**
   - Returns per-agent chat statistics
   - Used for "Chat Count by Agent" bar chart

2. **`/api/platform/tenants/:tenantId/analytics/chats`**
   - Returns list of recent chat sessions
   - Used for "Recent Chat Sessions" table

3. **`/api/platform/tenants/:tenantId/analytics/chats/time-series`**
   - Returns time-series sentiment data
   - Used for "Sentiment Over Time" area chart

### Files Changed

#### 1. `client/src/pages/analytics.tsx` (REPLACED)

- **Old**: Fetched from `/api/analytics/retell` (voice calls)
- **New**: Fetches from `/api/platform/tenants/:tenantId/analytics/chats/*` (chat sessions)

**Key Changes:**

- Changed interfaces from `RetellAnalytics`, `AgentMetric`, `CallsByDateStacked` → `ChatAnalytics`, `AgentBreakdown`, `TimeSeriesData`
- Changed icons from `Phone`, `Activity`, `CheckCircle` → `MessageSquare`, `Clock`, `DollarSign`, `TrendingUp`
- Changed metrics from "Total Calls", "Average Latency" → "Total Chats", "Total Cost"
- Changed charts to show:
  - Chat count by agent (was: call success rate by agent)
  - Sentiment over time (was: disconnection reasons pie chart)
  - Recent chat sessions table (was: voice call sessions)

#### 2. `client/src/pages/analytics-voice.tsx` (NEW - Backup)

- Saved original analytics.tsx as backup
- Contains Retell AI voice call analytics (for future use if needed)

#### 3. `client/src/pages/analytics-chat.tsx` (NEW - Source)

- New implementation file (used to generate analytics.tsx)
- Can be deleted after testing

## Data Structure

### Chat Analytics Schema

```typescript
{
  id: string;
  chatId: string; // Retell chat ID
  agentId: string; // Agent that handled chat
  agentName: string | null; // Display name
  chatStatus: string | null; // "completed", "abandoned"
  startTimestamp: string; // When chat started
  endTimestamp: string; // When chat ended
  duration: number; // Duration in seconds
  messageCount: number; // Total messages
  userSentiment: string; // "positive", "negative", "neutral"
  chatSuccessful: boolean; // Goal achieved?
  combinedCost: number; // Total cost in dollars
}
```

### Agent Breakdown

```typescript
{
  agentId: string;
  agentName: string;
  totalChats: number;
  successfulChats: number;
  successRate: number; // Percentage
  totalDuration: number; // Sum in seconds
  averageDuration: number; // Average in seconds
  totalCost: number; // Sum in dollars
  averageCost: number; // Average in dollars
  sentimentBreakdown: Record<string, number>; // e.g., { positive: 5, negative: 2 }
}
```

## Testing

1. ✅ TypeScript compiles with no errors
2. ✅ Dev server starts successfully
3. 🔄 **User to verify**: New chats appear in "Recent Chat Sessions" table
4. 🔄 **User to verify**: Agent breakdown shows correct chat counts
5. 🔄 **User to verify**: Date range filtering works correctly

## Next Steps

1. Test the page at `http://localhost:5000/analytics` (or production URL)
2. Verify new chats appear at the bottom of the table (sorted by most recent first)
3. Verify agent breakdown matches expected chat counts
4. If everything works, delete `client/src/pages/analytics-chat.tsx` (no longer needed)

## Rollback Plan

If the new analytics page has issues, restore the voice analytics:

```bash
cp client/src/pages/analytics-voice.tsx client/src/pages/analytics.tsx
```

## Notes

- The old voice call analytics is still available in `analytics-voice.tsx` if needed
- All chat analytics backend endpoints were already implemented and working
- The issue was purely frontend - calling wrong endpoint
- Date range filtering uses UTC timezone normalization (start of day → end of day)
