# N8N Voice Analytics Fix

## Problem Identified

**Issue:** N8N voice calls were not recording any detailed analytics - only showing "1 call" with no duration, cost, sentiment, or other details.

**Root Cause:** The N8N webhook proxy route (`/api/n8n/:workflowName`) was only forwarding payloads to N8N workflows but **not storing analytics data** to the local `voice_analytics` database table.

## What Was Fixed

### 1. **Analytics Storage in N8N Route** (`server/routes/n8n.routes.ts`)

**Updated Lines 191-265** to properly extract and store voice analytics data:

#### Key Improvements:

1. **Better Payload Extraction**:
   - Supports both `payload.call` and `payload` structures
   - Handles multiple timestamp formats

2. **Duration Calculation**:
   - Auto-calculates duration from start/end timestamps if not provided
   - Fallback to Retell's duration field

3. **Cost Conversion**:
   - **CRITICAL**: Retell sends costs in **cents**, now properly converted to dollars
   - Example: `call_cost.combined_cost: 3` → `$0.03`
   - Supports both `call_cost` and `cost_breakdown` structures

4. **Field Mapping Fixed**:

   ```typescript
   // OLD (incorrect):
   duration: call.call_analysis?.call_summary?.duration_seconds
   messageCount: call.transcript?.length

   // NEW (correct):
   duration: calculated from timestamps or call.duration
   messageCount: call.transcript?.length || call.messages?.length || 0
   combinedCost: costInCents / 100  // Convert cents to dollars
   ```

5. **Deduplication**:
   - Checks if `call_id` already exists before inserting
   - Prevents duplicate analytics records

6. **Enhanced Logging**:
   - Full payload dump for debugging
   - Error stack traces for troubleshooting

### 2. **What Gets Stored**

The system now captures these fields from Retell webhooks:

| Field            | Source                               | Notes                                  |
| ---------------- | ------------------------------------ | -------------------------------------- |
| `callId`         | `call.call_id`                       | Unique identifier                      |
| `agentId`        | `call.agent_id`                      | From agent config                      |
| `agentName`      | From DB or `call.agent_name`         | Looked up from tenant config           |
| `startTimestamp` | `call.start_timestamp`               | Converted to Date                      |
| `endTimestamp`   | `call.end_timestamp`                 | Converted to Date                      |
| `duration`       | Calculated or `call.duration`        | In seconds                             |
| `messageCount`   | `call.transcript.length`             | Number of turns                        |
| `toolCallsCount` | `call.tool_calls.length`             | Function calls made                    |
| `userSentiment`  | `call.call_analysis.user_sentiment`  | positive/negative/neutral              |
| `callSuccessful` | `call.call_analysis.call_successful` | boolean                                |
| `combinedCost`   | `call.call_cost.combined_cost / 100` | **Converted from cents to dollars**    |
| `productCosts`   | `call.call_cost.product_costs`       | Cost breakdown by model                |
| `metadata`       | Various fields                       | disconnect_reason, numbers, URLs, etc. |

## Testing Instructions

### 1. **Restart the Server**

```bash
# If server is running, stop it (Ctrl+C)
npm run dev
```

### 2. **Make a Test Call Through N8N**

1. Go to your Retell dashboard
2. Configure a test agent to use your N8N webhook:
   ```
   https://your-domain.com/api/n8n/inbound-booking-call-analyzed
   ```
3. Make a test voice call
4. The call should complete normally

### 3. **Check Server Logs**

Look for these log messages in your terminal:

```
[N8N Proxy] 🚀 REQUEST RECEIVED
[N8N Proxy] Workflow Name: inbound-booking-call-analyzed
[N8N Proxy] 📊 ANALYTICS DEBUG - Raw call data:
{
  "call_id": "abc123...",
  "agent_id": "agent_xyz...",
  "call_analysis": {
    "user_sentiment": "positive",
    "call_successful": true
  },
  "call_cost": {
    "combined_cost": 150,  // 150 cents = $1.50
    "product_costs": {...}
  },
  ...
}
[N8N Proxy] Storing voice analytics for call: abc123...
[N8N Proxy] ✓ Voice analytics stored successfully
```

### 4. **Check the Analytics Dashboard**

1. Log in to your platform
2. Navigate to **Analytics** → **Voice Only**
3. Select your tenant (e.g., "SWC-Bhukkha")
4. You should now see:
   - ✅ **Total Interactions**: Correct call count
   - ✅ **Voice Success Rate**: Actual percentage
   - ✅ **Total Cost**: Dollar amount (not $0.00)
   - ✅ **Detailed visualizations**: Sentiment, duration, cost breakdown
   - ✅ **Recent call sessions table**: With all details

### 5. **Verify Database Storage**

If you have DBeaver or psql access:

```sql
SELECT
  call_id,
  agent_name,
  duration,
  user_sentiment,
  call_successful,
  combined_cost,
  message_count,
  start_timestamp,
  end_timestamp
FROM voice_analytics
WHERE tenant_id = 'your-tenant-id'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Results:**

- `duration`: Should be a number (e.g., 45, 120)
- `combined_cost`: Should be decimal dollars (e.g., 0.03, 1.50)
- `user_sentiment`: Should be "positive", "negative", or "neutral"
- `call_successful`: Should be true/false
- `message_count`: Should be > 0

## What to Look For

### ✅ Success Indicators:

1. **Server logs show**:
   - `📊 ANALYTICS DEBUG - Raw call data`
   - `✓ Voice analytics stored successfully`

2. **Analytics dashboard shows**:
   - Call count matches actual calls made
   - Success rate calculated correctly
   - Cost displayed in dollars (not $0.00)
   - Detailed charts and graphs populated

3. **Database has**:
   - New rows in `voice_analytics` table
   - All fields populated (not NULL)
   - Costs in dollars (not cents)

### ❌ Failure Indicators:

1. **Server logs show**:
   - `Failed to store voice analytics: ...`
   - Missing fields in raw call data
   - TypeScript/validation errors

2. **Analytics dashboard still shows**:
   - "1 call" with no details
   - "$0.00 cost"
   - Empty charts

3. **Database shows**:
   - No new rows in `voice_analytics`
   - NULL fields for duration/cost/sentiment

## Troubleshooting

### Issue: "Voice analytics already exists for call: abc123"

**Cause:** The call was already stored (duplicate webhook)

**Action:** This is normal - deduplication is working. No action needed.

### Issue: "Failed to store voice analytics: ..."

**Causes:**

1. Missing required fields in payload
2. Invalid data types (e.g., non-numeric duration)
3. Database constraint violations

**Actions:**

1. Check the `📊 ANALYTICS DEBUG - Raw call data` log
2. Verify the payload structure matches expectations
3. Check error stack trace for specific field issues

### Issue: Analytics dashboard still empty

**Possible Causes:**

1. Retell webhook not configured to hit N8N proxy
2. Different workflow name than expected
3. Data stored but not queried correctly

**Actions:**

1. Verify webhook URL in Retell dashboard
2. Check workflow name matches route (e.g., `call-analyzed`)
3. Query database directly to confirm data exists

## Next Steps

After confirming analytics are working:

1. ✅ **Commit the fix**:

   ```bash
   git add server/routes/n8n.routes.ts
   git commit -m "fix: Store voice analytics for N8N webhook calls

   - Extract call data from Retell webhook payloads
   - Convert costs from cents to dollars
   - Calculate duration from timestamps
   - Add deduplication to prevent duplicates
   - Enhanced logging for debugging"
   git push origin dev
   ```

2. ✅ **Monitor production**:
   - Check analytics dashboard daily
   - Verify all calls are being tracked
   - Confirm costs are accurate

3. ✅ **Test edge cases**:
   - Failed calls (disconnect before answer)
   - Very short calls (<5 seconds)
   - Very long calls (>10 minutes)
   - Calls with tool/function invocations

## Technical Details

### Webhook Flow:

```
Retell AI
  ↓
  Sends webhook: call.analyzed or call.ended
  ↓
/api/n8n/:workflowName
  ↓
  1. Resolve tenant from agent_id
  2. Extract call data from payload
  3. Store to voice_analytics table  ← NEW
  4. Forward to N8N workflow
  5. Return N8N response
```

### Database Schema:

```sql
CREATE TABLE voice_analytics (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  call_id TEXT UNIQUE NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  start_timestamp TIMESTAMP,
  end_timestamp TIMESTAMP,
  duration INTEGER,  -- seconds
  message_count INTEGER,
  user_sentiment TEXT,
  call_successful BOOLEAN,
  combined_cost REAL,  -- dollars (converted from cents)
  product_costs JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Summary

- ✅ N8N voice calls now store full analytics data
- ✅ Costs converted from cents to dollars
- ✅ Duration calculated automatically
- ✅ Deduplication prevents duplicate records
- ✅ Enhanced logging for debugging
- ✅ Compatible with existing `/call-ended` webhook

**Ready to test!** Make a call and verify the analytics appear in the dashboard. 🚀
