# Analytics Showing €0.00 Cost and 0 Messages - Investigation

**Date:** 2025-12-04  
**Status:** 🔍 INVESTIGATING

## Problem

Analytics dashboard shows:

- **Total Cost:** €0.00
- **Avg Messages:** 0.0

But there are 9 chats in the database, so data IS being stored.

## Root Cause Analysis

### Issue #1: Backend Not Calculating Metrics ✅ FIXED

The `getChatAnalyticsAgentBreakdown()` function was only returning basic counts:

```javascript
{
  agentId: string;
  agentName: string;
  count: number; // ❌ Only this!
}
```

But the frontend expects:

```javascript
{
  agentId: string;
  agentName: string;
  totalChats: number;
  totalCost: number; // ❌ Missing!
  averageCost: number; // ❌ Missing!
  totalDuration: number; // ❌ Missing!
  averageDuration: number; // ❌ Missing!
  sentimentBreakdown: {
  } // ❌ Missing!
}
```

**Fix Applied:** Enhanced `storage.getChatAnalyticsAgentBreakdown()` to:

- Calculate `totalCost` by summing `combinedCost` from all chats
- Calculate `averageCost` = totalCost / totalChats
- Calculate `totalDuration` and `averageDuration`
- Calculate `successRate` from `chatSuccessful` field
- Build `sentimentBreakdown` from `userSentiment` field

### Issue #2: Retell Not Sending Cost/Message Data ⚠️ NEEDS VERIFICATION

The webhook code extracts:

```javascript
messageCount: chat.messages?.length || 0,
combinedCost: chat.cost_analysis?.combined || 0,
```

But Retell might be sending these fields with different names or structure.

**From previous logs**, we saw Retell sends:

- `transcript` (array) - NOT `messages`
- `chat_cost` (object) - NOT `cost_analysis`

## Debug Logging Added

Added logging to webhook to see what Retell actually sends:

```javascript
console.log('[Retell Webhook] Messages field:', typeof chat.messages, chat.messages?.length);
console.log('[Retell Webhook] Transcript field:', typeof chat.transcript, chat.transcript?.length);
console.log('[Retell Webhook] Chat cost:', chat.chat_cost);
console.log('[Retell Webhook] Cost analysis:', chat.cost_analysis);
```

## Next Steps

### Step 1: Check Production Webhook Logs

After next chat, check Render logs for:

```
[Retell Webhook] Messages field: ...
[Retell Webhook] Transcript field: ...
[Retell Webhook] Chat cost: ...
```

This will tell us:

- Does Retell send `messages` or `transcript`?
- Does Retell send `cost_analysis` or `chat_cost`?
- What is the structure of these fields?

### Step 2: Fix Field Mapping (Expected)

Based on logs, likely need to change:

**Before:**

```javascript
messageCount: chat.messages?.length || 0,
combinedCost: chat.cost_analysis?.combined || 0,
```

**After (probably):**

```javascript
messageCount: chat.transcript?.length || chat.messages?.length || 0,
combinedCost: chat.chat_cost || chat.cost_analysis?.combined || 0,
```

### Step 3: Verify Database Has Data

After fix, check database:

```sql
SELECT
  chat_id,
  message_count,
  combined_cost,
  duration
FROM chat_analytics
ORDER BY created_at DESC
LIMIT 5;
```

Should see actual values, not 0/null.

### Step 4: Test Analytics Dashboard

After fix and new chat:

- ✅ Total Cost should show actual amount
- ✅ Avg Messages should show actual count
- ✅ Duration already working (shows "3m 16s")

## Temporary Workaround

If Retell doesn't send message count, we can calculate it from `transcript`:

```javascript
// Count user + assistant messages from transcript
const messageCount = chat.transcript
  ? chat.transcript.filter((t) => t.role === 'user' || t.role === 'assistant').length
  : 0;
```

If Retell doesn't send cost, we might need to:

1. Calculate from token usage (if Retell sends that)
2. Or accept that cost tracking requires Retell API key to fetch separately

## Files Modified

1. **`server/storage.ts`** - Enhanced `getChatAnalyticsAgentBreakdown()`
   - Now calculates totalCost, averageCost, totalDuration, averageDuration
   - Groups by sentiment for breakdown
   - Calculates success rate

2. **`server/routes/webhook.routes.ts`** - Added debug logging
   - Logs messages field (to see if it exists)
   - Logs transcript field (alternative)
   - Logs chat_cost vs cost_analysis structure

## Expected Outcome

After next chat (with new webhook logging):

1. Logs will show what fields Retell actually sends
2. We update field mapping in webhook
3. Cost and message count populate correctly
4. Analytics dashboard shows real numbers

## Commits

- `7c757a9` - Fix agent breakdown to calculate cost/duration metrics
- Previous - Add webhook logging for messages/cost debugging

## Related Issues

- Duration = 0 ✅ FIXED (using current time fallback)
- End chat 401 ✅ FIXED (test token support)
- Widget history 401 ✅ FIXED (test token support)
- Cost and messages = 0 ⚠️ IN PROGRESS

---

**Next Action:** Wait for new chat → Check logs → Update field mapping
