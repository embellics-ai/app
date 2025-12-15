# URGENT: Retell Webhook Configuration Fix

## Problem Identified

Your analytics show **"2 calls"** but **NO detailed data** (0% success, €0.00 cost) because:

1. ✅ Webhooks ARE reaching the server (4 records in database)
2. ❌ But they're **"ongoing"** status (call.started events)
3. ❌ **NOT "ended"** or "analyzed"\*\* status (which have analytics data)

### Database Evidence:

```
Call ID: call_2ed51ed310762e893ec4d347c37
Status: ongoing  ⚠️
Duration: NULL
Cost: NULL
Sentiment: NULL
Successful: NULL
Messages: NULL
```

**Root Cause:** Retell is configured to send webhooks for **"call.started"** events, but analytics data only exists in **"call.ended"** or **"call.analyzed"** events.

## Solution: Update Retell Webhook Configuration

### Step 1: Go to Retell Dashboard

1. Log in to https://retellai.com/dashboard
2. Navigate to **Settings** → **Webhooks**
3. Find your webhook configuration for agent: `SWC-Booking-Inbound-Prompt-Format`

### Step 2: Check Current Configuration

Your current webhook is probably set to:

```
❌ Event: call.started
❌ URL: https://your-domain.com/api/n8n/your-workflow-name
```

### Step 3: Update to Correct Event

Change to one of these events:

**Option 1: call.ended (Recommended)**

```
✅ Event: call.ended
✅ URL: https://your-domain.com/api/n8n/your-workflow-name
```

- Fires immediately when call ends
- Contains: duration, transcript, cost, sentiment, success
- Best for real-time N8N workflows

**Option 2: call.analyzed**

```
✅ Event: call.analyzed
✅ URL: https://your-domain.com/api/n8n/your-workflow-name
```

- Fires after AI analysis completes (~30s delay)
- Contains: full analysis, sentiment, extracted variables
- Best if you need AI-analyzed data

### Step 4: Test the Fix

1. **Make a Test Call**:
   - Call your Retell agent
   - Complete the call (hang up)
   - Wait 5-10 seconds

2. **Check Server Logs**:

   ```bash
   # Look for these messages:
   [N8N Proxy] 📊 ANALYTICS - Completed call detected: call_xxx Status: ended
   [N8N Proxy] ✓ Voice analytics stored/updated successfully
   ```

3. **Verify Database**:

   ```bash
   npm run check-voice-analytics

   # Should show:
   Duration: 45s ✅ (not NULL)
   Cost: €0.15 ✅ (not NULL)
   Sentiment: positive ✅ (not NULL)
   Successful: true ✅ (not NULL)
   ```

4. **Check Analytics Dashboard**:
   - Refresh: http://localhost:3000/analytics
   - Select: SWC-Bhukkha tenant
   - Filter: Voice Only
   - Should show: Real costs, success rates, durations

## Alternative: Multiple Webhooks

If you want BOTH events (for different purposes):

### Setup in Retell:

1. **Webhook 1 - Call Started** (for live monitoring):

   ```
   Event: call.started
   URL: https://your-domain.com/api/n8n/live-call-monitor
   ```

2. **Webhook 2 - Call Ended** (for analytics):
   ```
   Event: call.ended
   URL: https://your-domain.com/api/n8n/booking-call-ended
   ```

The system will now:

- Save initial record when call starts (with basic info)
- **UPDATE** that record when call ends (with full analytics)

## Code Changes Made

I've updated `server/routes/n8n.routes.ts` to:

### Before:

```typescript
// Only stored if workflow name included "call-analyzed" or "call-ended"
if (workflowName.includes('call-analyzed') || workflowName.includes('call-ended')) {
  // Store analytics
}
```

### After:

```typescript
// Checks call STATUS instead of workflow name
const isCompletedCall =
  call.call_status && call.call_status !== 'ongoing' && call.call_status !== 'registered';

if (isCompletedCall) {
  // Store/update analytics with UPSERT
}
```

**Benefits:**

- ✅ Works with ANY workflow name
- ✅ Detects completed calls by status, not name
- ✅ Updates existing records (if call.started was received first)
- ✅ Logs full payload for debugging

## Verification Commands

### Check What's in Database:

```bash
npm run check-voice-analytics
```

### Watch Server Logs:

```bash
# In terminal where npm run dev is running, look for:
[N8N Proxy] 📊 ANALYTICS - Completed call detected
[N8N Proxy] 📊 ANALYTICS DEBUG - Raw call data:
```

### Make Test Call:

1. Call your Retell number
2. Have a short conversation
3. Hang up
4. Wait 10 seconds
5. Check analytics dashboard

## What to Look For

### ✅ Success Indicators:

**Server Logs:**

```
[N8N Proxy] 📊 ANALYTICS - Completed call detected: call_abc123 Status: ended
[N8N Proxy] Updating existing voice analytics for call: call_abc123
[N8N Proxy] ✓ Voice analytics stored/updated successfully
```

**Database:**

```
Duration:    45s          ✅
Cost:        €0.15        ✅
Sentiment:   positive     ✅
Successful:  true         ✅
Messages:    12           ✅
```

**Analytics Dashboard:**

```
Total Interactions:    3 calls
Voice Success Rate:    66.7%
Total Cost:           €0.45
```

### ❌ Failure Indicators:

**Server Logs:**

```
[N8N Proxy] 🚀 REQUEST RECEIVED
[N8N Proxy] Workflow Name: booking-call
# No "ANALYTICS" log = not a completed call
```

**Database:**

```
Duration:    NULL     ❌
Cost:        NULL     ❌
Status:      ongoing  ❌
```

**Analytics Dashboard:**

```
Voice Success Rate:  0.0%  ❌
Total Cost:         0,00 €  ❌
```

## Immediate Next Steps

1. ✅ **Code is already fixed** (just committed)
2. ⏳ **Update Retell webhook** (do this NOW)
3. ⏳ **Make test call** (verify it works)
4. ⏳ **Check analytics dashboard** (see real data)

## Retell Webhook Event Types

For reference, here are all Retell webhook events:

| Event             | When Fired              | Has Analytics Data?       |
| ----------------- | ----------------------- | ------------------------- |
| `call.started`    | Call begins             | ❌ No (only basic info)   |
| `call.ended`      | Call completes          | ✅ Yes (full data)        |
| `call.analyzed`   | After AI analysis       | ✅ Yes (with AI insights) |
| `call.registered` | Phone number registered | ❌ No                     |

**You MUST use `call.ended` or `call.analyzed` for analytics to work!**

## Summary

**Problem:** Retell sending "call.started" webhooks → no analytics data
**Solution:** Change Retell webhook to "call.ended" event
**Status:** Code fixed ✅, Webhook config pending ⏳

Make this one change in Retell dashboard and your analytics will start working immediately! 🚀
