# The Two Directions of Integration

## ❌ What You're Trying to Do (Wrong)

```
┌─────────────────────────────────────────────────────────┐
│                  N8N WORKFLOW                            │
│                                                          │
│  "I want to call Retell API from N8N"                  │
│                                                          │
│  Node: HTTP Request                                     │
│  URL: https://api.retellai.com/create-chat             │
│  Auth: Bearer key_93f64256e7e3591f07e71d3cbb9b  ❌     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Direct call with hardcoded key
                        ▼
              ┌──────────────────┐
              │   Retell AI API  │
              └──────────────────┘

Problem: Credentials exposed in N8N!
```

## ✅ How Your System Actually Works (Correct)

### Direction 1: INCOMING (Use Webhook UI - Screenshot 2)

```
External Service (WhatsApp, Retell, Custom)
  │
  │ Sends event/webhook
  ▼
┌──────────────────────────────────────────────┐
│        YOUR PLATFORM                         │
│  POST /api/whatsapp/webhook                  │
│  POST /api/retell/chat-analyzed              │
│  POST /api/custom-event                      │
│                                              │
│  1. Receives event                           │
│  2. Identifies tenant                        │
│  3. Queries database for webhooks            │
│                                              │
│  ┌────────────────────────────┐             │
│  │ Database: n8n_webhooks     │             │
│  │                            │             │
│  │ tenant_id: SWC-Bhukkha    │             │
│  │ event_type: whatsapp_msg  │             │
│  │ webhook_url: https://...  │ ← Created via UI!
│  └────────────────────────────┘             │
│                                              │
│  4. Forwards to N8N webhook URL             │
└──────────────────┬───────────────────────────┘
                   │
                   │ POST with enriched payload
                   ▼
         ┌──────────────────┐
         │  N8N WORKFLOW    │
         │  (Receives data) │
         └──────────────────┘
```

**You configure this in the UI (Screenshot 2)!**

- No code changes needed
- Add as many webhooks as you want
- Platform automatically routes to them

### Direction 2: OUTGOING (Use Proxy APIs)

```
         ┌──────────────────┐
         │  N8N WORKFLOW    │
         │                  │
         │ "Now I need to   │
         │  call WhatsApp   │
         │  or Retell API"  │
         └────────┬─────────┘
                  │
                  │ POST with N8N_WEBHOOK_SECRET
                  ▼
┌──────────────────────────────────────────────┐
│        YOUR PLATFORM (PROXY)                 │
│  POST /api/proxy/:tenantId/whatsapp/send    │
│  POST /api/proxy/:tenantId/retell/create    │
│                                              │
│  1. Validates N8N_WEBHOOK_SECRET            │
│  2. Extracts tenantId from URL              │
│  3. Fetches encrypted credentials           │
│  4. Decrypts credentials                    │
│  5. Calls external API                      │
└──────────────────┬───────────────────────────┘
                   │
                   │ With decrypted credentials
                   ▼
    ┌──────────────────────────────┐
    │  External API                │
    │  - WhatsApp                  │
    │  - Retell AI                 │
    │  - Any other service         │
    └──────────────────────────────┘
```

**These are already built:**

- WhatsApp proxy: ✅
- Retell AI proxy: ✅
- Just use them from N8N!

## Complete Flow Example

### Scenario: WhatsApp message triggers Retell AI chat

```
1. WhatsApp sends message
   │
   ▼
   POST /api/whatsapp/webhook (Meta → Your Platform)
   │
   ▼
2. Your platform processes
   │
   ├─ Identifies tenant by phone number ID
   ├─ Finds N8N webhook (event_type: 'whatsapp_message')
   ├─ Webhook configured in UI:
   │    Workflow Name: whatsapp_handler
   │    Webhook URL: https://n8n.../webhook/whatsapp  ← FROM UI!
   │
   ▼
3. Platform forwards to N8N
   │
   ▼
   POST https://n8n.../webhook/whatsapp (Platform → N8N)
   Payload: {
     tenantId: "SWC-Bhukkha",
     from: "+1234567890",
     message: "Hello!",
     agentId: "agent_abc"
   }
   │
   ▼
4. N8N workflow receives and processes
   │
   ├─ Node 1: Webhook (trigger)
   │
   ├─ Node 2: Create Retell Chat
   │    URL: https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/retell/create-chat
   │    Auth: Bearer {{$env.N8N_WEBHOOK_SECRET}}
   │    │
   │    ▼
   │    POST /api/proxy/SWC-Bhukkha/retell/create-chat (N8N → Platform)
   │    │
   │    ▼
   │    Platform fetches Retell API key for SWC-Bhukkha
   │    Platform decrypts key
   │    │
   │    ▼
   │    POST https://api.retellai.com/create-chat (Platform → Retell)
   │    Auth: Bearer {decrypted_key}
   │    │
   │    ▼
   │    Returns: { chat_id: "chat_xyz" }
   │
   ├─ Node 3: Send WhatsApp Reply
   │    URL: https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/whatsapp/send
   │    Auth: Bearer {{$env.N8N_WEBHOOK_SECRET}}
   │    │
   │    ▼
   │    POST /api/proxy/SWC-Bhukkha/whatsapp/send (N8N → Platform)
   │    │
   │    ▼
   │    Platform fetches WhatsApp token for SWC-Bhukkha
   │    Platform decrypts token
   │    │
   │    ▼
   │    POST https://graph.facebook.com/.../messages (Platform → WhatsApp)
   │    Auth: Bearer {decrypted_token}
   │    │
   │    ▼
   │    Message sent!
   │
   ▼
5. Done!
```

## What Screenshot 2 UI Does

```
┌──────────────────────────────────────────────┐
│  Integration Management → N8N Webhooks       │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Add Webhook                           │ │
│  │                                        │ │
│  │  Workflow Name: whatsapp_handler      │ │  ← You enter this
│  │  Webhook URL: https://n8n.../webhook  │ │  ← Your N8N URL
│  │  Type: Event Listener                 │ │  ← Choose type
│  │  Event Type: whatsapp_message         │ │  ← What triggers it
│  │  Active: ✅                           │ │  ← Enable/disable
│  │                                        │ │
│  │  [Save]                                │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Saved to database: n8n_webhooks table      │
└──────────────────────────────────────────────┘
                   │
                   │ Platform uses this to route events
                   ▼
         When 'whatsapp_message' event occurs,
         platform automatically calls:
         POST https://n8n.../webhook
```

## How to Add New Integrations (Self-Service)

### Example: Process Contact Form

**Step 1: Configure in UI (Screenshot 2)**

```
Workflow Name: contact_form_processor
Webhook URL: https://n8n.srv1144822.hstgr.cloud/webhook/contact
Webhook Type: Event Listener (Async)
Event Type: contact_form_submitted
Active: ✅
```

**Step 2: Trigger from Your Platform Code**

```typescript
// In your contact form handler
await forwardToN8NWebhooks(tenantId, 'contact_form_submitted', {
  name: req.body.name,
  email: req.body.email,
  message: req.body.message,
});
```

**Step 3: Build N8N Workflow**

```
Webhook (receives contact form data)
  ↓
Send to CRM (using proxy if needed)
  ↓
Send Email Notification
```

**That's it! No code changes to platform needed!**

## Summary

### Use UI (Screenshot 2) For:

- ✅ Configuring webhooks that receive events
- ✅ Event Listeners (async notifications)
- ✅ Function Calls (sync data requests)
- ✅ Routing external events to N8N

### Use Proxy APIs For:

- ✅ N8N calling external APIs (WhatsApp, Retell)
- ✅ Keeping credentials out of N8N
- ✅ Multi-tenant credential management

### DON'T Do:

- ❌ Call external APIs directly from N8N with hardcoded keys (Screenshot 1)
- ❌ Think you need a new proxy for every endpoint

### Your System is Complete!

You have **everything you need:**

1. ✅ Webhook UI for configuring event routing
2. ✅ Proxy APIs for secure external API calls
3. ✅ Multi-tenant credential management
4. ✅ End-to-end security

**Just use them correctly!** 🎉
