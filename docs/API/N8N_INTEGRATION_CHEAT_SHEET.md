# N8N Integration Cheat Sheet

## Quick Decision Tree

### "I need to..."

#### ❓ Receive an event/webhook from an external service

→ **Use the N8N Webhook UI (Screenshot 2)**

```
Steps:
1. Go to Integration Management → N8N Webhooks
2. Click "Add Webhook"
3. Fill in:
   - Workflow Name: descriptive_name
   - Webhook URL: your N8N webhook URL
   - Type: Event Listener (Async)
   - Event Type: name_of_event
4. Save

Platform will automatically forward matching events to your N8N webhook.
No code changes needed!
```

#### ❓ Call an external API from N8N (WhatsApp, Retell, etc.)

→ **Use Proxy APIs**

```
In your N8N HTTP Request node:
URL: https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/SERVICE/ENDPOINT
Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}

Available proxies:
- /api/proxy/:tenantId/whatsapp/send
- /api/proxy/:tenantId/whatsapp/templates
- /api/proxy/:tenantId/whatsapp/media/:mediaId
- /api/proxy/:tenantId/retell/create-chat
- /api/proxy/:tenantId/retell/:endpoint

Platform handles credentials automatically!
```

#### ❓ Create a new event type

→ **Add to platform code + Configure webhook in UI**

```
1. In your platform code, emit the event:
   await forwardToN8NWebhooks(tenantId, 'your_event_type', payload);

2. In UI, configure webhook:
   Event Type: your_event_type

Done!
```

#### ❓ Get data during a conversation (function call)

→ **Use Function Call webhook type**

```
1. In Retell AI, define custom function
2. In UI, create webhook:
   - Type: Function Call (Sync)
   - Function Name: exact_match_to_retell
   - Webhook URL: your N8N workflow
3. N8N workflow must return data within timeout
```

## Configuration Examples

### Example 1: WhatsApp Message Processing

**UI Configuration:**

```
Workflow Name: whatsapp_message_handler
Webhook URL: https://n8n.srv1144822.hstgr.cloud/webhook/whatsapp
Webhook Type: Event Listener (Async)
Event Type: whatsapp_message
Active: ✅
```

**N8N Workflow:**

```javascript
// Webhook Trigger
// Receives: { tenantId, from, message, agentId, ... }

// Node 1: Create Retell Chat
POST https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/retell/create-chat
Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}
Body: {
  "agent_id": "{{ $json.agentId }}",
  "metadata": { "phoneNumber": "{{ $json.from }}" }
}

// Node 2: Send WhatsApp Reply
POST https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/whatsapp/send
Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}
Body: {
  "to": "{{ $json.from }}",
  "type": "text",
  "text": { "body": "Chat created!" }
}
```

### Example 2: Chat Analytics Processing

**UI Configuration:**

```
Workflow Name: chat_analytics
Webhook URL: https://n8n.srv1144822.hstgr.cloud/webhook/analytics
Webhook Type: Event Listener (Async)
Event Type: Chat Analyzed
Active: ✅
```

**N8N Workflow:**

```javascript
// Webhook Trigger
// Receives: { tenantId, chat: {...}, analytics: {...} }

// Node 1: Format Data
// Transform analytics data

// Node 2: Send to CRM
POST https://your-crm.com/api/contacts
Authorization: Bearer {{$env.CRM_API_KEY}}
Body: { /* formatted data */ }

// Node 3: Log to Database
POST https://your-analytics-db.com/api/logs
Body: { /* analytics log */ }
```

### Example 3: Booking Lookup (Function Call)

**UI Configuration:**

```
Workflow Name: get_booking_details
Webhook URL: https://n8n.srv1144822.hstgr.cloud/webhook/booking-lookup
Webhook Type: Function Call (Sync)
Function Name: get_booking_details
Response Timeout: 5000ms
Retry on Failure: ✅
Active: ✅
```

**N8N Workflow:**

```javascript
// Webhook Trigger
// Receives: { function: 'get_booking_details', args: { booking_id: '123' } }

// Node 1: Query Database
POST https://your-booking-system.com/api/bookings/{{ $json.args.booking_id }}
Authorization: Bearer {{$env.BOOKING_API_KEY}}

// Node 2: Return Data (MUST respond within 5000ms)
// Webhook Response node
{
  "booking_id": "123",
  "customer_name": "John Doe",
  "service": "Pool Cleaning",
  "date": "2024-01-20",
  "status": "confirmed"
}
// This goes back to Retell AI for use in conversation
```

## Common Patterns

### Pattern 1: Receive → Process → Send

```
External Service
  ↓
Platform (receives)
  ↓
N8N Webhook (UI configured) ← EVENT LISTENER
  ├─ Process data
  ├─ Call proxy APIs
  └─ Send responses
```

**Use for:** WhatsApp messages, chat analytics, contact forms

### Pattern 2: Request → Fetch → Return

```
External Service (during conversation)
  ↓
Platform (routes)
  ↓
N8N Webhook (UI configured) ← FUNCTION CALL
  ├─ Fetch from database
  └─ Return data (MUST be fast!)
  ↓
Back to conversation
```

**Use for:** Real-time data lookup during AI conversations

### Pattern 3: Scheduled Tasks

```
N8N Cron Trigger
  ↓
Fetch data from platform
  ↓
Process
  ↓
Call proxy APIs to send results
```

**Use for:** Daily reports, batch processing

## Environment Variables Needed in N8N

```bash
# Required for all proxy API calls
N8N_WEBHOOK_SECRET=NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=

# Optional: Platform URL (for easy switching between dev/prod)
PLATFORM_URL=https://embellics-app.onrender.com

# Optional: Any other external API keys N8N needs
CRM_API_KEY=your_crm_key
BOOKING_API_KEY=your_booking_key
```

## Debugging Checklist

### Webhook not receiving data?

- [ ] Is webhook Active in UI?
- [ ] Does Event Type match the event being sent?
- [ ] Check platform logs for forwarding attempts
- [ ] Verify N8N webhook URL is correct
- [ ] Check N8N execution logs

### Proxy API call failing?

- [ ] Is N8N_WEBHOOK_SECRET correct?
- [ ] Is tenantId being passed correctly?
- [ ] Does tenant have credentials configured?
- [ ] Check platform logs for proxy errors
- [ ] Verify URL format: `/api/proxy/:tenantId/service/endpoint`

### Function call timeout?

- [ ] Is response returned within timeout period?
- [ ] Check N8N execution time
- [ ] Increase timeout in webhook config
- [ ] Optimize N8N workflow

## Security Checklist

- [x] Never hardcode API keys in N8N workflows
- [x] Always use {{$env.N8N_WEBHOOK_SECRET}} for proxy calls
- [x] All tenant credentials encrypted in database
- [x] N8N webhook URLs can have optional auth tokens
- [x] Proxy APIs validate N8N_WEBHOOK_SECRET
- [x] Each tenant isolated from others

## Key Differences

| Feature          | Event Listener                  | Function Call                   |
| ---------------- | ------------------------------- | ------------------------------- |
| **Timing**       | Async (fire & forget)           | Sync (waits for response)       |
| **Timeout**      | None                            | Configurable (default 10s)      |
| **Use Case**     | Notifications, logging          | Real-time data lookup           |
| **Return Value** | Not used                        | Sent back to caller             |
| **Examples**     | Chat analyzed, message received | Get booking, check availability |

## What You DON'T Need

- ❌ Individual proxy for every external API endpoint
- ❌ Hardcoded credentials in N8N
- ❌ Code changes for each new workflow
- ❌ Direct external API calls from N8N

## What You HAVE

- ✅ Self-service webhook configuration UI
- ✅ Proxy APIs for WhatsApp & Retell
- ✅ Multi-tenant credential management
- ✅ Event routing system
- ✅ Function call system
- ✅ Complete security

## Quick Reference URLs

### Platform Endpoints (Receive events)

```
POST /api/whatsapp/webhook        (WhatsApp → Platform)
POST /api/retell/chat-analyzed    (Retell → Platform)
POST /api/retell/call-ended       (Retell → Platform)
POST /api/functions/:functionName (Retell → Platform)
```

### Proxy Endpoints (N8N → Platform → External)

```
POST /api/proxy/:tenantId/whatsapp/send
GET  /api/proxy/:tenantId/whatsapp/templates
GET  /api/proxy/:tenantId/whatsapp/media/:mediaId
POST /api/proxy/:tenantId/retell/create-chat
POST /api/proxy/:tenantId/retell/:endpoint
```

All proxy calls require:

```
Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}
```

## Bottom Line

**Your system is complete and self-service!**

- Want to add a new integration? → Configure webhook in UI
- Need to call external API? → Use existing proxy endpoints
- Want to trigger custom events? → Add event emit in code, configure in UI

**No code changes needed for most integrations!** 🎉
