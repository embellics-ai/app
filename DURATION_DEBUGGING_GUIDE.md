# Duration = 0 Debugging Guide

## The Problem

Chats are showing `duration: 0` in the analytics, even though chats are happening.

## Root Cause Analysis

The duration issue is **NOT a code bug**. Here's why:

### How Chat Analytics Work

1. User has a chat via widget
2. Retell AI processes the chat in real-time
3. **AFTER the chat ends**, Retell AI sends a `chat_analyzed` webhook to your server
4. The webhook includes `start_timestamp`, `end_timestamp`, and `duration` fields
5. Your server calculates duration from these timestamps and stores in database

### Why Duration = 0

**The webhook is likely NOT being received at all**, or Retell AI is sending:

- `start_timestamp` = null
- `end_timestamp` = null
- `duration` = null or 0

This happens when:

- Retell AI doesn't track the chat session properly
- Chat ends too quickly (< 1 second)
- Webhook configuration issues

## Diagnostic Steps

### Step 1: Check if Webhooks are Being Received

**Option A: Check Production Logs (Render.com)**

1. Go to https://dashboard.render.com
2. Find your service: `embellics-app`
3. Click "Logs" tab
4. Search for: `[Retell Webhook]`
5. Look for lines like:
   ```
   [Retell Webhook] Timestamps: {
     start_timestamp: '2024-12-04T12:00:00Z',
     end_timestamp: '2024-12-04T12:05:30Z',
     duration_from_retell: 330
   }
   [Retell Webhook] Calculated duration: 330 seconds
   ```

**What to look for:**

- ✅ If you see these logs: Webhooks ARE being received
- ❌ If NO `[Retell Webhook]` logs: Webhooks NOT configured properly
- ⚠️ If timestamps are `null` or `undefined`: Retell AI not sending them

### Step 2: Verify Webhook Configuration in Retell AI

1. Log into Retell AI Dashboard: https://beta.retellai.com/
2. Go to **Settings → Webhooks**
3. Verify:
   - ✅ Event: `chat.analyzed` is enabled
   - ✅ URL: `https://embellics-app.onrender.com/api/retell/chat-analyzed`
   - ✅ Status: "Active" or "Connected"

### Step 3: Test with a Real Chat

1. Open your widget on a real website (or widget test page on production)
2. Have a conversation for at least 30 seconds
3. End the chat properly
4. Wait 10-15 seconds for webhook to arrive
5. Check production logs for `[Retell Webhook]` entries
6. Check database:
   ```sql
   SELECT
     chat_id,
     duration,
     start_time,
     end_time,
     created_at
   FROM chat_analytics
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## Possible Outcomes

### Outcome 1: No Webhook Logs at All

**Issue:** Retell AI not sending webhooks to your server

**Fix:**

1. Configure webhook in Retell AI dashboard (see `RETELL_WEBHOOK_CONFIG_URGENT.md`)
2. Make sure URL is exactly: `https://embellics-app.onrender.com/api/retell/chat-analyzed`
3. Enable `chat.analyzed` event

### Outcome 2: Webhook Received but Timestamps are Null

**Example Log:**

```
[Retell Webhook] Timestamps: {
  start_timestamp: null,
  end_timestamp: null,
  duration_from_retell: null
}
```

**Issue:** Retell AI not tracking chat session times

**Possible Causes:**

- Chat ended too quickly (< 1 second)
- Retell AI configuration issue
- Agent not configured to track analytics

**Fix:**

1. Check Retell AI agent configuration
2. Ensure agent has analytics enabled
3. Contact Retell AI support if problem persists

### Outcome 3: Webhook Received with Valid Timestamps but Duration Still 0

**Example Log:**

```
[Retell Webhook] Timestamps: {
  start_timestamp: '2024-12-04T12:00:00.000Z',
  end_timestamp: '2024-12-04T12:05:30.000Z',
  duration_from_retell: 330
}
[Retell Webhook] Calculated duration: 330 seconds
```

**Issue:** Code is working, but old chats have duration = 0

**Fix:** Run migration to recalculate durations for existing chats:

```bash
npm run db:migrate
# Migration 0007_calculate_chat_durations.sql should fix old records
```

### Outcome 4: Different Chat Sessions

**Issue:** You're testing on localhost but checking production database

**Important:**

- Localhost chats → Dev database
- Production chats → Production database
- Webhooks go to the URL configured in Retell AI (likely production)

**Solution:** Test on production or use ngrok/localtunnel to test locally

## Testing Locally (Advanced)

To test the duration fix on localhost, you need to expose localhost to the internet:

### Option 1: Using Localtunnel

1. Install localtunnel:

   ```bash
   npm install -g localtunnel
   ```

2. Start your dev server:

   ```bash
   npm run dev
   ```

3. In a new terminal, create tunnel:

   ```bash
   lt --port 3000 --subdomain embellics-dev
   ```

4. You'll get a URL like: `https://embellics-dev.loca.lt`

5. Update Retell AI webhook URL to: `https://embellics-dev.loca.lt/api/retell/chat-analyzed`

6. Test a chat, check localhost logs for `[Retell Webhook]` messages

### Option 2: Using ngrok

1. Install ngrok: https://ngrok.com/download

2. Start your dev server:

   ```bash
   npm run dev
   ```

3. In a new terminal:

   ```bash
   ngrok http 3000
   ```

4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

5. Update Retell AI webhook to: `https://abc123.ngrok.io/api/retell/chat-analyzed`

6. Test a chat, check localhost logs

## Quick Verification Script

Run this to check recent chats in your database:

```sql
-- Check recent chats with duration info
SELECT
  chat_id,
  tenant_id,
  duration,
  start_time,
  end_time,
  message_count,
  created_at,
  -- Calculate what duration SHOULD be
  CASE
    WHEN start_time IS NOT NULL AND end_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (end_time - start_time))
    ELSE NULL
  END as calculated_duration
FROM chat_analytics
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**What this shows:**

- `duration`: What's stored in database
- `calculated_duration`: What it SHOULD be based on timestamps
- If both are 0 or NULL: Retell AI didn't send timestamps
- If calculated > 0 but duration = 0: Migration needed for old records

## Summary

**The duration = 0 issue is most likely:**

1. ❌ Webhooks not configured in Retell AI dashboard
2. ❌ Webhooks going to wrong URL
3. ❌ Retell AI not sending timestamp data

**It is NOT:**

- ✅ A code bug (the calculation logic is correct)
- ✅ A database issue (the schema is correct)

**Next Steps:**

1. Check production logs on Render.com for `[Retell Webhook]` entries
2. If no logs: Configure webhook in Retell AI dashboard
3. If logs show null timestamps: Contact Retell AI support
4. If everything looks good: Run duration calculation migration

**Created:** 2025-12-04  
**Status:** Awaiting production log review
