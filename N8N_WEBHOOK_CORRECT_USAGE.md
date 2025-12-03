# N8N Webhook System - Correct Usage Guide

## The Misunderstanding

You're trying to call external APIs (Retell AI) directly from N8N and want a "generic proxy."

**But your N8N webhook system works the OTHER way around:**

- ✅ **External systems** (Retell AI, WhatsApp) call **your platform**
- ✅ **Your platform** routes to **N8N webhooks** you configured in the UI
- ✅ **N8N processes** the data and optionally calls back to your platform using proxy APIs

## How Your System Actually Works

### Current Architecture (Already Implemented)

```
External Service (Retell AI, WhatsApp, etc.)
  │
  ▼
Your Platform (receives webhook/event)
  │
  ├─ Identifies tenant
  ├─ Looks up N8N webhooks for tenant + event type
  │
  ▼
N8N Workflow (configured in UI - Screenshot 2)
  │
  ├─ Processes data
  ├─ Calls back to platform proxy APIs if needed
  │
  ▼
Your Platform Proxy APIs
  │
  ▼
External Services (WhatsApp, Retell AI)
```

## Screenshot 1 - What You're Doing Wrong

```
❌ INCORRECT APPROACH:

N8N Node: "Whatsapp-Chat-Completion"
URL: https://api.retellai.com/create-chat-completion
Authorization: Bearer key_93f64256e7e3591f07e71d3cbb9b

This is:
- Calling Retell AI directly from N8N
- Hardcoding credentials
- NOT using the webhook system
```

## Screenshot 2 - What You Should Be Using

```
✅ CORRECT APPROACH:

1. Configure N8N Webhook in UI:
   - Workflow Name: contact_form
   - Webhook URL: https://n8n.example.com/webhook/your-tenant/workflow-name
   - Webhook Type: Event Listener (Async)
   - Event Type: Chat Analyzed (or custom event)
   - Auth Token: (optional)

2. Your platform automatically routes events to this webhook
3. N8N receives the event and processes it
4. If N8N needs to call external APIs, use proxy endpoints
```

## The Two Webhook Types Explained

### Type 1: Event Listener (Async) ← What Screenshot 2 shows

**Purpose:** Receive notifications when something happens

**Flow:**

```
Retell AI → Your Platform → N8N Webhook (configured in UI)
```

**Example Use Cases:**

- Chat session ended → Send data to CRM
- Call analyzed → Generate report
- WhatsApp message received → Process with AI

**Configuration (Screenshot 2):**

- **Workflow Name:** `contact_form`
- **Webhook Type:** Event Listener (Async)
- **Event Type:** `Chat Analyzed` (or custom: `contact_form_submitted`)
- **Webhook URL:** `https://n8n.srv1144822.hstgr.cloud/webhook/contact_form`

**What Happens:**

1. Retell AI sends `chat_analyzed` event to your platform
2. Platform finds all webhooks with `event_type = 'Chat Analyzed'` for your tenant
3. Platform forwards enriched payload to your N8N webhook
4. N8N processes it (save to CRM, send email, etc.)

### Type 2: Function Call (Sync) ← For real-time data during conversations

**Purpose:** Get data during a conversation

**Flow:**

```
Retell AI → Your Platform → N8N Webhook → Your Platform → Retell AI
(needs booking info)    (routes)      (fetches from CRM)
```

**Example Use Cases:**

- Get booking details during call
- Check user account status
- Fetch appointment availability

**Configuration:**

- **Workflow Name:** `get_booking_details`
- **Webhook Type:** Function Call (Sync)
- **Function Name:** `get_booking_details` (must match Retell function name)
- **Webhook URL:** `https://n8n.srv1144822.hstgr.cloud/webhook/get-booking`
- **Response Timeout:** 5000ms

**What Happens:**

1. During conversation, Retell AI calls custom function
2. Your platform receives: `POST /api/functions/get_booking_details`
3. Platform finds webhook with `function_name = 'get_booking_details'`
4. Platform forwards to N8N and **waits** for response
5. N8N fetches data from CRM and returns it
6. Platform sends response back to Retell AI
7. Retell AI uses data in conversation

## How to Fix Your Current Workflow

### ❌ What You Have (Screenshot 1)

```
Node: Whatsapp-Chat-Completion
Method: POST
URL: https://api.retellai.com/create-chat-completion
Authorization: Bearer key_93f64256e7e3591f07e71d3cbb9b  ← WRONG!
```

### ✅ What You Should Have

**Step 1: Create N8N Webhook in Your Platform UI**

Go to Integration Management → N8N Webhooks → Add Webhook:

- **Workflow Name:** `whatsapp_chat_completion`
- **Webhook Type:** Event Listener (Async)
- **Event Type:** `whatsapp_message` (or create custom event)
- **Webhook URL:** `https://n8n.srv1144822.hstgr.cloud/webhook/whatsapp-handler`
- **Description:** Process WhatsApp messages and create Retell chat

**Step 2: Update Your N8N Workflow**

```
Webhook Trigger (receives from your platform)
  ├─ Extracts: tenantId, phoneNumber, message
  │
  ▼
Create Retell Chat (using PROXY)
  ├─ URL: https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/retell/create-chat
  ├─ Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}
  ├─ Body: { agent_id, metadata }
  │
  ▼
Send WhatsApp Reply (using PROXY)
  ├─ URL: https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/whatsapp/send
  ├─ Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}
  └─ Body: { to, type, text }
```

**Step 3: Trigger from Your Platform**

When WhatsApp message arrives:

```
POST /api/whatsapp/webhook (from Meta)
  ↓
Your platform processes
  ↓
Forwards to N8N webhook: https://n8n.srv1144822.hstgr.cloud/webhook/whatsapp-handler
  ↓
N8N executes workflow
  ↓
Calls back to proxy APIs
```

## Why You Don't Need Individual Proxies

You're thinking: "I need a proxy for every API endpoint I call."

**But you already have:**

1. **WhatsApp Proxy:**
   - `POST /api/proxy/:tenantId/whatsapp/send`
   - `GET /api/proxy/:tenantId/whatsapp/templates`
   - `GET /api/proxy/:tenantId/whatsapp/media/:mediaId`

2. **Retell AI Proxy:**
   - `POST /api/proxy/:tenantId/retell/create-chat`
   - `POST /api/proxy/:tenantId/retell/:endpoint` (generic!)

3. **N8N Webhook System:**
   - Configure ANY number of webhooks in UI
   - Platform routes events to them automatically
   - No code changes needed!

## Creating New Integration Workflows (Self-Service)

### Example: Contact Form Submission

**Step 1: Create Event Type**

First, decide what event triggers this:

- Option A: Use existing event (`chat_analyzed`, `call_ended`)
- Option B: Create custom event in your platform

**Step 2: Configure N8N Webhook in UI**

```
Workflow Name: contact_form
Webhook URL: https://n8n.srv1144822.hstgr.cloud/webhook/contact-form
Webhook Type: Event Listener
Event Type: contact_form_submitted (custom)
Description: Process contact form and send to CRM
Active: ✅
```

**Step 3: Trigger the Event from Your Platform**

Add code to emit the event:

```typescript
// In your contact form handler
await webhookService.forwardToN8NWebhooks(
  tenantId,
  'contact_form_submitted', // event type
  {
    name: formData.name,
    email: formData.email,
    message: formData.message,
    timestamp: new Date(),
  },
);
```

**Step 4: Build N8N Workflow**

```
Webhook Trigger
  ↓
Extract Data
  ↓
Send to CRM (HTTP Request)
  ↓
Send Confirmation Email
```

**That's it!** No proxy endpoints needed, no code changes!

## When to Use Proxy Endpoints vs N8N Webhooks

### Use Proxy Endpoints When:

- ✅ N8N needs to call external APIs with tenant-specific credentials
- ✅ Example: Send WhatsApp message, create Retell chat

### Use N8N Webhooks When:

- ✅ External system sends event to your platform
- ✅ You want to route that event to N8N for processing
- ✅ Example: Chat ended, message received, form submitted

### Don't Use Direct API Calls When:

- ❌ Calling external APIs from N8N with hardcoded credentials
- ❌ This is a security risk!

## Complete Example: WhatsApp → Retell Chat

### Architecture

```
WhatsApp (Meta)
  ↓ POST /api/whatsapp/webhook
Your Platform
  ↓ Identifies tenant
  ↓ Finds N8N webhook (event_type = 'whatsapp_message')
  ↓ POST https://n8n.../webhook/whatsapp-handler
N8N Workflow
  ↓ POST /api/proxy/{tenantId}/retell/create-chat
Your Platform (Proxy)
  ↓ Fetches encrypted Retell API key
  ↓ POST https://api.retellai.com/create-chat
Retell AI
  ↓ Returns chat_id
Your Platform (Proxy)
  ↓ Returns to N8N
N8N Workflow
  ↓ POST /api/proxy/{tenantId}/whatsapp/send
Your Platform (Proxy)
  ↓ Fetches encrypted WhatsApp token
  ↓ POST https://graph.facebook.com/.../messages
WhatsApp (Meta)
```

### Configuration in UI (Screenshot 2)

```
Workflow Name: whatsapp_incoming_messages
Webhook URL: https://n8n.srv1144822.hstgr.cloud/webhook/whatsapp-handler
Webhook Type: Event Listener (Async)
Event Type: whatsapp_message
Active: ✅
```

### N8N Workflow

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "webhook/whatsapp-handler"
      }
    },
    {
      "name": "Create-Retell-Chat",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://embellics-app.onrender.com/api/proxy/={{ $('Webhook').item.json.tenantId }}/retell/create-chat",
        "authentication": "none",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{$env.N8N_WEBHOOK_SECRET}}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "agent_id": "={{ $('Webhook').item.json.agentId }}",
          "metadata": {
            "conversationId": "={{ $('Webhook').item.json.conversationId }}"
          }
        }
      }
    },
    {
      "name": "Send-WhatsApp-Reply",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://embellics-app.onrender.com/api/proxy/={{ $('Webhook').item.json.tenantId }}/whatsapp/send",
        "authentication": "none",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{$env.N8N_WEBHOOK_SECRET}}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "to": "={{ $('Webhook').item.json.from }}",
          "type": "text",
          "text": {
            "body": "Chat created! Chat ID: {{ $('Create-Retell-Chat').item.json.chat_id }}"
          }
        }
      }
    }
  ]
}
```

## Summary

### What You Have (Already Built)

- ✅ N8N Webhook Management UI (screenshot 2)
- ✅ Event routing system (`event_listener` type)
- ✅ Function call system (`function_call` type)
- ✅ WhatsApp proxy API
- ✅ Retell AI proxy API
- ✅ Multi-tenant credential management

### What You're Doing Wrong

- ❌ Calling external APIs directly from N8N (screenshot 1)
- ❌ Hardcoding credentials in N8N
- ❌ Not using the webhook system you built

### What You Should Do

1. ✅ Configure webhooks in UI (screenshot 2)
2. ✅ Let your platform route events to N8N
3. ✅ Use proxy APIs when N8N needs to call external services
4. ✅ No hardcoded credentials anywhere!

### The Key Insight

**You don't need a "proxy for every endpoint."**

You need to understand the **direction of the flow:**

- **Incoming:** External → Platform → N8N (use webhook UI)
- **Outgoing:** N8N → Platform Proxy → External (use proxy APIs)

Your UI (screenshot 2) handles the **incoming** direction!
Your proxy APIs handle the **outgoing** direction!

**Together, they form a complete secure integration system!** 🎉
