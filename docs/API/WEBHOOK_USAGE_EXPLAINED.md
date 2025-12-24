# Where Your N8N Webhook "whatsapp-incoming-messages" Is Used

## Your Webhook Configuration

From the screenshot:

```
Workflow Name: whatsapp-incoming-messages
Type: Event: whatsapp_message
URL: https://n8n.srv1144822.hstgr.cl...
Status: Active
Stats: 28 calls (28 success)
```

## Exact Location in Code

**File:** `server/routes.ts`  
**Line:** ~6877  
**Endpoint:** `POST /api/whatsapp/webhook`

### The Complete Flow

```typescript
// 1. WhatsApp (Meta) sends message to your platform
app.post('/api/whatsapp/webhook', async (req: Request, res: Response) => {
  // 2. Platform immediately responds to Meta
  res.status(200).send('EVENT_RECEIVED');

  // 3. Extract phone number ID from webhook
  const phoneNumberId = metadata.phone_number_id;

  // 4. Find which tenant owns this phone number
  const tenants = await storage.getAllTenants();
  for (const tenant of tenants) {
    const integration = await storage.getTenantIntegration(tenant.id);
    const config = integration.whatsappConfig;
    if (config.phoneNumberId === phoneNumberId) {
      targetTenant = tenant; // Found tenant: SWC-Bhukkha
      break;
    }
  }

  // 5. ⭐ THIS IS WHERE YOUR WEBHOOK IS FETCHED ⭐
  const webhooks = await storage.getWebhooksByEvent(
    targetTenant.id, // "SWC-Bhukkha"
    'whatsapp_message', // Your event type!
  );
  // Returns: [{
  //   workflowName: "whatsapp-incoming-messages",
  //   webhookUrl: "https://n8n.srv1144822.hstgr.cl...",
  //   isActive: true,
  //   eventType: "whatsapp_message"
  // }]

  // 6. Forward to each matching N8N webhook
  for (const webhook of webhooks) {
    if (!webhook.isActive) continue; // Skip if disabled

    // 7. ⭐ THIS IS THE ACTUAL CALL TO YOUR N8N ⭐
    const n8nResponse = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: targetTenant.id, // "SWC-Bhukkha"
        tenantName: targetTenant.name, // "SWC-Bhukkha"
        phoneNumberId, // WhatsApp phone ID
        displayPhoneNumber, // Display number
        messages: value.messages, // Message content
        contacts: value.contacts, // Sender info
        metadata: value.metadata, // Meta metadata
        statuses: value.statuses, // Message statuses
        originalPayload: req.body, // Full webhook from Meta
      }),
    });

    // 8. Track success/failure
    if (n8nResponse.ok) {
      await storage.incrementWebhookStats(webhook.id, true);
      // This increments the "28 calls (28 success)" counter!
    } else {
      await storage.incrementWebhookStats(webhook.id, false);
    }
  }
});
```

## The Trigger Chain

```
1. Someone sends WhatsApp message
   │
   ▼
2. WhatsApp (Meta) → POST /api/whatsapp/webhook
   │ Body: {
   │   entry: [{
   │     changes: [{
   │       value: {
   │         metadata: { phone_number_id: "123..." },
   │         messages: [{ from: "+1234...", text: { body: "Hello" } }]
   │       }
   │     }]
   │   }]
   │ }
   │
   ▼
3. Your Platform receives webhook
   │
   ├─ Responds immediately: 200 OK
   ├─ Extracts phone_number_id: "123..."
   ├─ Finds tenant with this phone number: "SWC-Bhukkha"
   │
   ▼
4. Platform queries database
   │
   │ SELECT * FROM n8n_webhooks
   │ WHERE tenant_id = 'SWC-Bhukkha'
   │   AND event_type = 'whatsapp_message'
   │   AND is_active = true;
   │
   │ Returns: Your webhook "whatsapp-incoming-messages"
   │
   ▼
5. Platform forwards to your N8N
   │
   │ POST https://n8n.srv1144822.hstgr.cloud/webhook/...
   │ Body: {
   │   tenantId: "SWC-Bhukkha",
   │   tenantName: "SWC-Bhukkha",
   │   phoneNumberId: "123...",
   │   messages: [{ from: "+1234...", text: { body: "Hello" } }],
   │   contacts: [{ profile: { name: "John" } }],
   │   ...
   │ }
   │
   ▼
6. Your N8N workflow processes the message
   │
   └─ (Whatever you configured in N8N happens here)
```

## Other Places N8N Webhooks Are Used

### 1. Chat Analyzed Events

**File:** `server/routes.ts` (line ~2408)  
**Endpoint:** `POST /api/retell/chat-analyzed`

```typescript
// When Retell AI finishes analyzing a chat
const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'chat_analyzed');

// Forwards this payload to matching webhooks:
{
  event: 'chat_analyzed',
  tenant: { id: tenantId, name: "SWC-Bhukkha" },
  chat: { chatId, agentId, transcript, sentiment, ... },
  analytics: { id, chatId, agentId },
  timestamp: "2024-01-15T10:30:00.000Z",
  originalPayload: { /* Full Retell payload */ }
}
```

**If you configure:**

```
Workflow Name: chat_analytics_processor
Type: Event Listener
Event Type: Chat Analyzed
```

→ This webhook will receive all chat analytics from Retell AI!

### 2. Call Analyzed Events

**File:** `server/routes.ts` (line ~2595)  
**Endpoint:** `POST /api/retell/call-ended`

```typescript
// When Retell AI finishes analyzing a voice call
const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'call_analyzed');

// Forwards this payload to matching webhooks:
{
  event: 'call_analyzed',
  tenant: { id: tenantId, name: "SWC-Bhukkha" },
  call: { callId, agentId, duration, transcript, ... },
  analytics: { id, callId, agentId },
  timestamp: "2024-01-15T10:30:00.000Z",
  originalPayload: { /* Full Retell payload */ }
}
```

## Summary: How Your Webhook System Works

### Configuration (What You Do in UI)

```
┌────────────────────────────────────────┐
│  Integration Management                │
│  → N8N Webhooks                        │
│  → Add Webhook                         │
│                                        │
│  Workflow Name: whatsapp-incoming-msgs│
│  Event Type: whatsapp_message         │ ← THIS is the key!
│  Webhook URL: https://n8n.srv...      │
│  Active: ✅                            │
│                                        │
│  [Save] → Stored in database          │
└────────────────────────────────────────┘
                 │
                 ▼
         Database table: n8n_webhooks
```

### Runtime (What Happens Automatically)

```
1. External event occurs (WhatsApp message, chat analyzed, etc.)
   ↓
2. Platform receives webhook at specific endpoint:
   - POST /api/whatsapp/webhook      → event_type: 'whatsapp_message'
   - POST /api/retell/chat-analyzed  → event_type: 'chat_analyzed'
   - POST /api/retell/call-ended     → event_type: 'call_analyzed'
   ↓
3. Platform identifies tenant (by phone number, agent ID, etc.)
   ↓
4. Platform queries: storage.getWebhooksByEvent(tenantId, event_type)
   ↓
5. Platform finds YOUR webhook configuration
   ↓
6. Platform calls YOUR N8N webhook URL
   ↓
7. YOUR N8N workflow runs
   ↓
8. Platform tracks success/failure (the "28 calls (28 success)" stat)
```

## Available Event Types

Currently implemented:

- ✅ `whatsapp_message` - When WhatsApp message received
- ✅ `chat_analyzed` - When Retell AI analyzes a chat
- ✅ `call_analyzed` - When Retell AI analyzes a voice call

You can add more by:

1. Choosing event type in UI dropdown
2. Platform will automatically route when that event occurs

## Why You See "28 calls (28 success)"

Every time:

1. Someone sends a WhatsApp message to your number
2. Platform receives it from Meta
3. Platform identifies it belongs to tenant "SWC-Bhukkha"
4. Platform finds your webhook (event_type = 'whatsapp_message')
5. Platform calls your N8N webhook URL
6. **Counter increments:** `total_calls++`, `successful_calls++`

That's where the "28 calls (28 success)" comes from!

## What Your N8N Workflow Receives

When your N8N webhook is called, it receives this JSON:

```json
{
  "tenantId": "SWC-Bhukkha",
  "tenantName": "SWC-Bhukkha",
  "phoneNumberId": "1234567890",
  "displayPhoneNumber": "+1234567890",
  "messages": [
    {
      "from": "+9876543210",
      "id": "wamid.xxx",
      "timestamp": "1234567890",
      "type": "text",
      "text": {
        "body": "Hello, I need help with my booking"
      }
    }
  ],
  "contacts": [
    {
      "profile": {
        "name": "John Doe"
      },
      "wa_id": "9876543210"
    }
  ],
  "metadata": {
    "display_phone_number": "+1234567890",
    "phone_number_id": "1234567890"
  },
  "originalPayload": {
    // Full webhook from Meta (for debugging)
  }
}
```

Then your N8N workflow can:

- Extract the message text: `{{ $json.messages[0].text.body }}`
- Get the sender: `{{ $json.messages[0].from }}`
- Use tenantId for proxy calls: `{{ $json.tenantId }}`
- And so on...

## Key Insight

**Your webhook "whatsapp-incoming-messages" is NOT something you call.**  
**It's something the PLATFORM calls when a WhatsApp message arrives!**

The flow is:

```
WhatsApp → Platform → YOUR N8N Webhook
```

NOT:

```
Your N8N → External API ← This would need proxy APIs
```

That's why you configure it in the UI - it's for INCOMING events, not OUTGOING calls!
