# WhatsApp Chat Analytics Setup Guide

## Overview

This guide explains how WhatsApp messages sent through Retell AI automatically track analytics in your dashboard, **without requiring manual configuration**.

## How It Works

### Automatic Tenant Detection

The system now **automatically determines which tenant** owns a chat by looking up the Retell AI agent ID. This means:

✅ **WhatsApp messages work out of the box** - no extra configuration needed
✅ **No need to add tenant_id to metadata** - the system finds it automatically
✅ **SMS, voice, and web chat** - all work the same way

### The Flow

```
WhatsApp User → Retell AI → Chat Processing → Webhook Event
                                                    ↓
                                          Your Server (running)
                                                    ↓
                                    Lookup: Agent ID → Tenant ID
                                                    ↓
                                          Store in Database
                                                    ↓
                                          Show in Dashboard
```

## Requirements

### 1. Your Server Must Be Running

**Local Development:**

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Expose it with LocalTunnel
lt --port 5000

# Use the LocalTunnel URL in Retell webhook config
# Example: https://your-url.loca.lt/api/retell/chat-analyzed
```

**Production:**

```bash
# Your deployed server URL
https://yourdomain.com/api/retell/chat-analyzed
```

### 2. Configure Retell AI Webhook

1. Go to [Retell AI Dashboard](https://app.retellai.com)
2. Navigate to **Settings** → **Webhooks**
3. Add webhook URL: `https://yourdomain.com/api/retell/chat-analyzed`
4. Subscribe to event: **`chat_analyzed`**
5. Save configuration

### 3. Agent Must Be Configured in Platform

Your Retell AI agent ID must be configured in the Platform Admin:

1. Log in as platform admin
2. Go to **Platform Admin** → **Tenants** tab
3. Click "Edit API Key" for your tenant
4. Enter your **Retell Agent ID** (e.g., `agent_xxxxx`)
5. Save

**Why this is important:** The webhook looks up the agent ID to find which tenant it belongs to.

## Testing Your Setup

### Step 1: Verify Agent Configuration

Check that your agent is configured:

```bash
# Query the database
psql $DATABASE_URL -c "SELECT tenant_id, retell_agent_id FROM widget_configs;"
```

You should see your tenant ID and agent ID listed.

### Step 2: Send a Test WhatsApp Message

1. Send a WhatsApp message to your Retell AI number
2. Have a brief conversation
3. End the chat

### Step 3: Check Server Logs

Watch your server logs for webhook activity:

```
[Retell Webhook] No tenant_id in metadata, looking up by agent ID: agent_xxxxx
[Retell Webhook] Found tenant from agent ID: tenant_abc123
[Retell Webhook] Processing chat analytics for tenant tenant_abc123, chat chat_def456
[Retell Webhook] Stored chat analytics for chat chat_def456
```

### Step 4: View in Dashboard

1. Navigate to **Platform Admin** → **Analytics** tab
2. Select your tenant
3. You should see the chat appear in the dashboard!

## Troubleshooting

### Issue: "Could not determine tenant_id"

**Error message:**

```
[Retell Webhook] Could not determine tenant_id from payload or agent configuration
```

**Solution:**

1. Verify agent ID is configured in Platform Admin
2. Check that the agent ID matches exactly (case-sensitive)
3. Look at server logs to see what agent ID was received

**Debug commands:**

```bash
# Check widget configs
psql $DATABASE_URL -c "SELECT * FROM widget_configs WHERE retell_agent_id = 'agent_YOUR_ID';"

# Check recent webhook logs
tail -f logs/server.log | grep "Retell Webhook"
```

### Issue: No analytics appearing in dashboard

**Checklist:**

- [ ] Server is running and accessible
- [ ] Webhook configured in Retell AI dashboard
- [ ] Webhook subscribed to `chat_analyzed` event
- [ ] Agent ID configured in Platform Admin
- [ ] Chat actually completed (not just started)

**Check webhook delivery:**

1. In Retell AI dashboard, go to **Webhooks** → **Logs**
2. Look for recent `chat_analyzed` events
3. Check HTTP status code:
   - `200 OK` = Success ✅
   - `400 Bad Request` = Configuration issue ❌
   - `500 Internal Error` = Server error ❌

### Issue: Webhook not being called

**Possible causes:**

1. **Server not accessible**
   - Test: `curl https://yourdomain.com/api/retell/chat-analyzed`
   - Should return 400 (missing data) not connection error

2. **Wrong webhook URL**
   - Check Retell dashboard for typos
   - Ensure it ends with `/api/retell/chat-analyzed`

3. **LocalTunnel expired** (local dev)
   - Restart LocalTunnel: `lt --port 5000`
   - Update webhook URL in Retell dashboard

4. **Chat not completed**
   - Retell only sends webhook when chat ends
   - Make sure conversation fully completes

### Issue: Analytics showing wrong tenant

**Cause:** Multiple tenants using the same agent ID

**Solution:** Each tenant should have a unique Retell AI agent configured.

**Check for duplicates:**

```sql
SELECT retell_agent_id, COUNT(*)
FROM widget_configs
WHERE retell_agent_id IS NOT NULL
GROUP BY retell_agent_id
HAVING COUNT(*) > 1;
```

## Advanced: Manual Metadata Override

If you want to explicitly specify the tenant (overrides agent lookup):

```javascript
// When creating a chat via Retell API
{
  "agent_id": "agent_xxxxx",
  "metadata": {
    "tenant_id": "your-tenant-uuid",  // Explicitly set tenant
    "whatsapp_user": "+1234567890"    // Optional: track user
  }
}
```

The webhook will use `metadata.tenant_id` if present, otherwise fall back to agent lookup.

## Webhook Payload Example

Here's what Retell sends when a WhatsApp chat completes:

```json
{
  "event": "chat_analyzed",
  "chat_id": "chat_abc123",
  "agent_id": "agent_xxxxx",
  "agent_name": "Support Bot",
  "chat_type": "whatsapp",
  "chat_status": "completed",
  "start_timestamp": 1701234567000,
  "end_timestamp": 1701234627000,
  "duration": 60,
  "transcript": "User: Hello\nAgent: Hi there! How can I help?\nUser: I have a question\nAgent: Sure, go ahead!",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": 1701234567000
    },
    {
      "role": "assistant",
      "content": "Hi there! How can I help?",
      "timestamp": 1701234568000
    }
  ],
  "chat_analysis": {
    "user_sentiment": "positive",
    "chat_summary": "User asked a question and received assistance.",
    "chat_successful": true
  },
  "combined_cost": 0.05,
  "product_costs": {
    "llm": 0.03,
    "whatsapp": 0.02
  },
  "metadata": {
    "whatsapp_user": "+1234567890"
    // Note: tenant_id NOT required - auto-detected from agent_id
  }
}
```

## Analytics Dashboard Features

Once webhooks are working, you'll see:

### Overview Tab

- Total WhatsApp chats
- Success rate
- Average duration
- Total costs
- Sentiment distribution

### Chat Sessions Tab

- List of all WhatsApp conversations
- Timestamp, duration, message count
- Sentiment badges
- Cost per chat

### Sentiment Analysis Tab

- Breakdown of positive/neutral/negative
- Percentage visualizations
- Correlation with success rate

### Cost Tracking Tab

- Daily cost breakdown
- Total and average costs
- WhatsApp-specific charges

## Best Practices

### 1. Monitor Webhook Health

Set up alerts for webhook failures:

```bash
# Check for recent errors
psql $DATABASE_URL -c "
  SELECT created_at, metadata
  FROM chat_analytics
  WHERE created_at > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC;
"
```

### 2. Separate Agents Per Tenant

- Don't share agent IDs between tenants
- Each tenant should have their own Retell agent
- This ensures proper analytics isolation

### 3. Use Descriptive Agent Names

Set clear agent names in Retell dashboard:

- ✅ "Acme Corp Support Bot"
- ❌ "Agent 1"

This makes analytics more readable.

### 4. Review Analytics Regularly

Check the dashboard:

- Daily: Overall metrics and recent chats
- Weekly: Sentiment trends
- Monthly: Cost analysis

### 5. Backup Webhook Logs

Retell keeps webhook logs for 30 days. For longer retention:

```bash
# Export to CSV monthly
psql $DATABASE_URL -c "
  COPY (
    SELECT * FROM chat_analytics
    WHERE created_at >= '2025-11-01'
    AND created_at < '2025-12-01'
  ) TO '/path/to/backup/november-2025.csv' CSV HEADER;
"
```

## Production Deployment Checklist

Before going live:

- [ ] Server deployed and accessible from internet
- [ ] Webhook URL configured in Retell AI dashboard
- [ ] Webhook subscribed to `chat_analyzed` event
- [ ] All agents configured in Platform Admin
- [ ] Database migration run (`npm run db:push`)
- [ ] SSL certificate valid (https required)
- [ ] Monitoring set up for webhook failures
- [ ] Test with real WhatsApp message
- [ ] Verify analytics appear in dashboard
- [ ] Document any custom configuration

## Support

If you encounter issues:

1. **Check server logs** for detailed error messages
2. **Review Retell webhook logs** in their dashboard
3. **Test the webhook endpoint** manually with cURL
4. **Verify database configuration** (tables exist, agent configured)
5. **Contact support** with specific error messages

## Version History

- **v2.0** (Current) - Auto-detection of tenant from agent ID
  - WhatsApp analytics work automatically
  - No metadata configuration required
  - Backwards compatible with explicit tenant_id

- **v1.0** - Manual configuration
  - Required tenant_id in metadata
  - Manual setup for each chat type
