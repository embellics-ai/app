# Chat Analytics Not Storing - Debug Guide

## Problem

Chat analytics page shows only 3 old chats. New chats are happening but not appearing in the database.

## Root Cause Analysis

After investigating the refactored code, **the webhook endpoint code is correct and identical to the original**. The refactoring did NOT break the chat analytics storage logic.

### What the Code Does (Correctly)

1. **Webhook Route**: `POST /api/retell/chat-analyzed` in `server/routes/webhook.routes.ts`
2. **Route Registration**: Properly registered at `/api/retell` in `server/routes/index.ts` (line 73)
3. **Storage Call**: Calls `storage.createChatAnalytics()` at line 106
4. **Full URL**: `https://embellics-app.onrender.com/api/retell/chat-analyzed`

### The webhook code:

```typescript
// Create chat analytics record
const createdAnalytics = await storage.createChatAnalytics({
  tenantId,
  ...chatData,
});
```

This is **working correctly** - the refactoring preserved this logic exactly.

## Likely Causes

Since the code is correct, the issue is likely one of these:

### 1. Retell AI Dashboard Not Configured ⚠️ MOST LIKELY

**Check Retell AI Dashboard Settings:**

1. Go to https://dashboard.retell.ai
2. Navigate to **Settings** → **Webhooks**
3. Check if webhook URL is set for `chat_analyzed` events:
   - **Production**: `https://embellics-app.onrender.com/api/retell/chat-analyzed`
   - **Dev**: `https://embellics-dev.onrender.com/api/retell/chat-analyzed`

**What should be there:**

- Event type: `chat.analyzed` or `chat_analyzed`
- URL: Your production URL + `/api/retell/chat-analyzed`
- HTTP Method: POST
- Status: Enabled

**If missing or wrong:**

- Add the correct webhook URL
- Select the `chat.analyzed` event type
- Save and test

### 2. Agent Configuration Missing Chat Analysis

**Check Retell AI Agent Settings:**

1. Go to agent configuration in Retell dashboard
2. Check that **"Send chat_analyzed events"** is enabled
3. Verify agent is set to analyze chats and send webhooks

**What to look for:**

- Chat analysis enabled
- Webhook events enabled
- Agent is in production mode (not test mode)

### 3. Webhook Events Not Being Triggered

**Possible reasons:**

- Chats ending without triggering analysis
- Agent not configured to send analytics
- Webhook events disabled for specific agents

### 4. Network/Firewall Issues

**Check:**

- Render.com allows incoming webhooks (it should by default)
- No firewall blocking Retell AI's webhook IPs
- HTTPS certificate is valid

## How to Test

### Test 1: Manual Webhook Test

Send a test payload to verify the endpoint works:

```bash
curl -X POST https://embellics-app.onrender.com/api/retell/chat-analyzed \
  -H "Content-Type: application/json" \
  -d '{
    "event": "chat_analyzed",
    "chat": {
      "chat_id": "test_'$(date +%s)'",
      "agent_id": "YOUR_AGENT_ID",
      "metadata": {
        "tenant_id": "YOUR_TENANT_ID"
      },
      "start_timestamp": '$(date +%s)'000,
      "end_timestamp": '$(($(date +%s) + 180))'000,
      "duration": 180,
      "messages": [],
      "chat_analysis": {
        "user_sentiment": "positive",
        "chat_successful": true
      },
      "cost_analysis": {
        "combined": 0.05
      }
    }
  }'
```

**Expected response:**

```json
{ "success": true, "message": "Chat analytics stored" }
```

### Test 2: Check Render Logs

1. Go to https://dashboard.render.com
2. Open your production service
3. Check **Logs** tab
4. Look for incoming webhook requests:
   - `[Retell Webhook]` log messages
   - HTTP POST requests to `/api/retell/chat-analyzed`

**What you should see after a chat:**

```
[Retell Webhook] Inferred chat type: web_chat
[Retell Webhook] Forwarding to X N8N webhook(s)
```

**If you DON'T see these logs**, Retell AI is NOT sending webhooks.

### Test 3: Check Database Directly

Connect to your database and run:

```sql
SELECT
  id,
  "chatId",
  "agentId",
  "startTimestamp",
  "chatStatus",
  "userSentiment",
  "createdAt"
FROM chat_analytics
ORDER BY "createdAt" DESC
LIMIT 10;
```

Compare the `createdAt` timestamps with when you had recent chats.

## Immediate Action Required

### 1. Check Retell Dashboard Webhook Configuration ⚠️

This is the MOST LIKELY issue. Without the webhook configured, Retell AI will never send analytics to your server.

**Steps:**

1. Log in to Retell AI dashboard
2. Go to Settings → Webhooks
3. Add webhook if missing
4. Verify URL is correct: `https://embellics-app.onrender.com/api/retell/chat-analyzed`
5. Enable `chat.analyzed` event

### 2. Have a New Chat and Monitor

After configuring the webhook:

1. Start a new chat on your widget
2. Complete the chat (make sure it ends properly)
3. Immediately check Render logs for webhook receipt
4. Check database for new entry
5. Refresh analytics page

## Expected Behavior After Fix

1. Chat happens on widget
2. Chat ends
3. Retell AI sends `chat_analyzed` event to your webhook
4. Your server logs: `[Retell Webhook] Inferred chat type: web_chat`
5. Database gets new row in `chat_analytics` table
6. Analytics page shows the new chat immediately

## Verification Steps

After configuring webhooks:

1. ✅ Manual curl test returns `{"success":true}`
2. ✅ Render logs show incoming POST to `/api/retell/chat-analyzed`
3. ✅ Database shows new entries with recent timestamps
4. ✅ Analytics page displays new chats
5. ✅ Agent breakdown updates with new counts

## Summary

**The refactoring did NOT break chat analytics storage.** The code is correct and identical to the original.

The issue is that **Retell AI is not sending webhook events** to your production server. This is a **configuration issue in the Retell AI dashboard**, not a code issue.

**Fix:** Configure the webhook URL in Retell AI dashboard to point to your production endpoint.

---

## Additional Resources

- Retell AI Webhook Documentation: https://docs.retellai.com/api-references/webhooks
- Retell Dashboard: https://dashboard.retell.ai
- Your Production URL: https://embellics-app.onrender.com
- Webhook Endpoint: `/api/retell/chat-analyzed`

## Need Help?

If webhook is configured correctly but still not working:

1. Check Retell AI dashboard for webhook delivery logs/errors
2. Verify agent ID in widget config matches agent in Retell dashboard
3. Check if test mode vs production mode is causing issues
4. Contact Retell AI support about webhook delivery
