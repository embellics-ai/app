# 🔍 Troubleshooting: Chat Analytics Not Showing

## Quick Diagnosis

You're sending WhatsApp messages but not seeing analytics? Here's how to fix it step by step.

## Step 1: Find Your Retell Chat Agent ID

### Method 1: From Retell AI Dashboard (Recommended)

1. **Go to** [https://app.retellai.com](https://app.retellai.com)
2. **Click on "Agents"** in the left sidebar
3. **Find your WhatsApp agent** (the one handling your messages)
4. **Click on the agent** to open its details
5. **Copy the Agent ID** - it looks like: `agent_abc123def456ghi789`

The agent ID always starts with **`agent_`** followed by random characters.

### Method 2: From API Response

If you've created an agent via API, you got the agent ID in the response:

```json
{
  "agent_id": "agent_abc123def456ghi789",
  "agent_name": "My WhatsApp Agent",
  ...
}
```

### Method 3: From Retell WhatsApp Settings

1. Go to Retell dashboard → **WhatsApp** section
2. Check which agent is assigned to your WhatsApp number
3. Copy the agent ID shown there

## Step 2: Configure Agent ID in Platform Admin

Now you need to tell YOUR system which Retell agent to track.

### Using the Web Interface:

1. **Open your app** in browser (e.g., http://localhost:3000)

2. **Log in as platform admin**
   - Email: `admin@embellics.com` (or your admin email)
   - Password: Your admin password

3. **Go to Platform Admin page**
   - Look for "Platform Admin" in the navigation menu
   - Or go directly to: `http://localhost:3000/platform-admin`

4. **Click on "Tenants" tab**

5. **Find your tenant** in the list (probably only one tenant if you just started)

6. **Click "Edit API Key" button** for your tenant
   - You'll see a dialog/form open

7. **Enter your Retell configuration:**
   - **Retell API Key**: Your Retell API key (starts with `key_`)
   - **Retell Agent ID**: The agent ID you copied (starts with `agent_`)

8. **Click "Save"**

### Screenshot Guide:

```
┌─────────────────────────────────────────────┐
│  Platform Admin > Tenants Tab              │
├─────────────────────────────────────────────┤
│                                             │
│  Tenant: Embellics Demo                    │
│  [Edit API Key] button ← Click this        │
│                                             │
│  ┌───────────────────────────────────────┐ │
│  │ Edit Retell API Key                   │ │
│  ├───────────────────────────────────────┤ │
│  │                                        │ │
│  │ Retell API Key (optional):            │ │
│  │ [key_xxxxxxxxxxxx]                    │ │
│  │                                        │ │
│  │ Retell Agent ID (required):           │ │
│  │ [agent_abc123def456]  ← Paste here    │ │
│  │                                        │ │
│  │ [Cancel]  [Save] ← Click Save         │ │
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Step 3: Configure Retell Webhook

Retell needs to send chat data to YOUR server when chats complete.

### For Local Development (Testing):

1. **Start your server:**

   ```bash
   npm run dev
   ```

2. **In a new terminal, start LocalTunnel:**

   ```bash
   lt --port 5000
   ```

3. **Copy the LocalTunnel URL** from the output:

   ```
   your url is: https://your-url.loca.lt
   ```

4. **Go to Retell AI Dashboard** → [Webhooks Settings](https://app.retellai.com/dashboard/webhooks)

5. **Click "Add Webhook"** or edit existing one

6. **Enter webhook URL:**

   ```
   https://your-url.loca.lt/api/retell/chat-analyzed
   ```

7. **Subscribe to event:** `chat_analyzed`

8. **Save webhook**

### For Production:

Same steps but use your actual domain:

```
https://yourdomain.com/api/retell/chat-analyzed
```

## Step 4: Test the Setup

### Send a WhatsApp Message:

1. **Send a message** to your WhatsApp business number
2. **Have a conversation** with the bot
3. **End the conversation** (important - webhook fires when chat ends)

### Check Server Logs:

Watch your terminal where the server is running. You should see:

```
[Retell Webhook] No tenant_id in metadata, looking up by agent ID: agent_abc123def456
[Retell Webhook] Found tenant from agent ID: c607afcf-e20b-462d-8e2c-3561c9e6bbb3
[Retell Webhook] Processing chat analytics for tenant c607afcf-e20b-462d-8e2c-3561c9e6bbb3, chat chat_xyz789
[Retell Webhook] Stored chat analytics for chat chat_xyz789
```

✅ **Good signs:**

- "Found tenant from agent ID" - Agent is configured correctly
- "Stored chat analytics" - Data saved successfully

❌ **Bad signs:**

- "Could not determine tenant_id" - Agent not configured
- No webhook logs at all - Webhook not configured or not firing

### Check Analytics Dashboard:

1. **Open Platform Admin** → **Analytics tab**
2. **Select your tenant** from dropdown
3. **You should see:**
   - Total chats count increased
   - Your recent WhatsApp conversation in the list
   - Sentiment analysis
   - Cost data

## Common Issues & Solutions

### Issue 1: "Could not determine tenant_id"

**Problem:** Agent ID not configured in your system

**Solution:**

1. Follow Step 2 above to configure agent ID
2. Make sure the agent ID matches EXACTLY (case-sensitive)
3. It should start with `agent_`

### Issue 2: No webhook logs appearing

**Problem:** Retell not sending webhooks to your server

**Possible causes:**

**A) Webhook not configured in Retell**

- Go to Retell dashboard → Webhooks
- Verify webhook URL is correct
- Verify `chat_analyzed` event is subscribed

**B) Server not accessible**

- For local: Is LocalTunnel running?
- For production: Is server deployed and accessible?
- Test: `curl https://your-url/api/retell/chat-analyzed`
  - Should return 400 (not 404 or connection error)

**C) Chat not completed**

- Retell sends webhook ONLY when chat ends
- Make sure to end the conversation
- Try saying "goodbye" or wait for timeout

### Issue 3: Wrong tenant's analytics showing

**Problem:** Multiple tenants with same agent

**Solution:**

- Each tenant should have their own unique Retell agent
- Don't share agent IDs between tenants
- Create separate agents in Retell dashboard for each tenant

### Issue 4: Analytics show 0 chats

**Problem:** Data not being saved

**Check:**

1. **Database connection working?**

   ```bash
   npm run db:push
   ```

   Should connect without errors

2. **Tables exist?**
   Check that `chat_analytics` table was created

3. **Server errors?**
   Look for error messages in server logs

## Verification Checklist

Before sending a message, verify:

- [ ] Retell Agent ID configured in Platform Admin → Tenants → Edit API Key
- [ ] Agent ID starts with `agent_` (not `call_` or other)
- [ ] Server is running (`npm run dev`)
- [ ] Webhook configured in Retell dashboard
- [ ] Webhook URL is correct and accessible
- [ ] Event `chat_analyzed` is subscribed
- [ ] For local: LocalTunnel is running and URL is current

After sending a message:

- [ ] Chat conversation completed (ended)
- [ ] Server logs show webhook received
- [ ] Server logs show "Found tenant from agent ID"
- [ ] Server logs show "Stored chat analytics"
- [ ] Analytics dashboard shows increased chat count

## Quick Test Script

Run this to verify your configuration:

```bash
# Check if agent is configured
curl -X GET http://localhost:5000/api/platform/tenants \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

Look for `hasRetellAgentId: true` in the response.

## Still Not Working?

### Enable Debug Mode:

Add to your `.env.local`:

```bash
DEBUG=retell:*
LOG_LEVEL=debug
```

Restart server and check logs.

### Manual Webhook Test:

Send a test webhook manually:

```bash
curl -X POST http://localhost:5000/api/retell/chat-analyzed \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "test_chat_123",
    "agent_id": "agent_YOUR_AGENT_ID_HERE",
    "start_timestamp": 1701234567000,
    "end_timestamp": 1701234627000,
    "duration": 60,
    "transcript": "Test conversation",
    "chat_analysis": {
      "user_sentiment": "positive",
      "chat_summary": "Test",
      "chat_successful": true
    },
    "combined_cost": 0.01
  }'
```

Replace `agent_YOUR_AGENT_ID_HERE` with your actual agent ID.

If this works, the problem is with Retell's webhook configuration.
If this fails, the problem is with your server configuration.

## Getting Help

If you're still stuck, gather this information:

1. **Agent ID:** agent_xxxxx
2. **Tenant ID:** (from Platform Admin)
3. **Server logs:** Copy the last 50 lines
4. **Webhook logs:** From Retell dashboard → Webhooks → Logs
5. **Error messages:** Any errors you see

Then check the detailed guides:

- `CHAT_ANALYTICS_GUIDE.md` - Complete analytics documentation
- `WHATSAPP_ANALYTICS_GUIDE.md` - WhatsApp-specific setup
- `CHAT_ANALYTICS_IMPLEMENTATION.md` - Technical implementation details
