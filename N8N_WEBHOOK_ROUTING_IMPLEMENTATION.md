# N8N Webhook Routing System - Implementation Complete

## Overview

This document describes the implementation of dynamic N8N webhook routing for multi-tenant support. The system acts as a secure proxy between Retell AI and N8N workflows, routing requests based on tenant configuration.

## Problem Statement

**Before:**

- Single hardcoded N8N webhook URL (`process.env.N8N_WEBHOOK_URL`)
- Not scalable for multiple clients/tenants
- N8N webhooks exposed directly to Retell AI
- No way to route different events to different workflows
- Credentials stored in N8N workflows (security concern)

**After:**

- Each tenant can configure multiple N8N webhooks
- Two webhook types: Event Listeners (async) and Function Calls (sync)
- Platform acts as secure proxy, hiding N8N URLs from Retell
- Dynamic routing based on tenant, event type, or function name
- All configuration stored securely in database with encryption

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Retell AI  │────────▶│   Platform       │────────▶│  N8N        │
│             │         │   (Proxy)        │         │  Workflows  │
└─────────────┘         └──────────────────┘         └─────────────┘
                                │
                                ▼
                        ┌──────────────┐
                        │  Database    │
                        │  (Webhooks)  │
                        └──────────────┘
```

### Request Flow

1. **Event Listeners (Async)**
   - Retell sends webhook (chat_analyzed, call_analyzed, etc.)
   - Platform stores analytics in database
   - Platform looks up webhooks for tenant + event type
   - Platform forwards enriched payload to all matching N8N webhooks
   - Response sent to Retell immediately (fire and forget)

2. **Function Calls (Sync)**
   - Retell calls function during conversation (GET /api/functions/:functionName)
   - Platform looks up tenant from agent_id
   - Platform finds webhook for tenant + function name
   - Platform forwards to N8N and waits for response
   - N8N response returned to Retell for use in conversation

## Database Schema

### n8n_webhooks Table

```sql
CREATE TABLE n8n_webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workflow_name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_type TEXT NOT NULL DEFAULT 'event_listener', -- 'event_listener' | 'function_call'
  event_type TEXT,           -- For event_listener: 'chat_analyzed', 'call_analyzed', '*', etc.
  function_name TEXT,        -- For function_call: 'get_booking_details', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  auth_token TEXT,           -- Optional Bearer token
  response_timeout INTEGER DEFAULT 10000,  -- For function_call (ms)
  retry_on_failure BOOLEAN DEFAULT false,  -- For function_call
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  last_called_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX unique_tenant_function_idx
  ON n8n_webhooks(tenant_id, function_name)
  WHERE webhook_type = 'function_call' AND function_name IS NOT NULL;

CREATE INDEX idx_n8n_webhooks_tenant_event
  ON n8n_webhooks(tenant_id, event_type)
  WHERE webhook_type = 'event_listener';
```

## API Endpoints

### 1. Function Proxy Endpoint

**Endpoint:** `POST /api/functions/:functionName`

**Purpose:** Routes Retell custom function calls to tenant-specific N8N webhooks

**Request from Retell:**

```json
{
  "agent_id": "agent_1234567890abcdef",
  "call_id": "call_9876543210fedcba",
  "args": {
    "booking_id": "12345",
    "user_phone": "+1234567890"
  }
}
```

**Forwarded to N8N:**

```json
{
  "function": "get_booking_details",
  "tenant": {
    "id": "tenant_abc123",
    "name": "SWC"
  },
  "call": {
    "id": "call_9876543210fedcba",
    "agent_id": "agent_1234567890abcdef"
  },
  "args": {
    "booking_id": "12345",
    "user_phone": "+1234567890"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "originalPayload": { ... }
}
```

**N8N Response (returned to Retell):**

```json
{
  "booking_id": "12345",
  "customer_name": "John Doe",
  "service": "Pool Cleaning",
  "scheduled_date": "2024-01-20",
  "status": "confirmed"
}
```

**Features:**

- Tenant identification from agent_id
- Webhook lookup by function name
- Timeout handling (configurable, default 10s)
- Error tracking and statistics
- Authorization header support

### 2. Event Webhook Handlers

**Endpoints:**

- `POST /api/retell/chat-analyzed` - Chat analytics events
- `POST /api/retell/call-ended` - Voice call analytics events

**Updates:**

- Removed hardcoded `process.env.N8N_WEBHOOK_URL`
- Added dynamic webhook lookup using `getWebhooksByEvent()`
- Forward to ALL matching webhooks for tenant + event type
- Parallel execution (non-blocking)
- Enriched payloads with tenant context

**Payload to N8N:**

```json
{
  "event": "chat_analyzed",
  "tenant": {
    "id": "tenant_abc123",
    "name": "SWC"
  },
  "chat": {
    "chatId": "chat_123",
    "agentId": "agent_456",
    // ... full chat data
  },
  "analytics": {
    "id": "analytics_789",
    "chatId": "chat_123",
    "agentId": "agent_456"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "originalPayload": { ... }
}
```

## Storage Layer Methods

### getWebhookByFunction(tenantId, functionName)

Finds webhook for function call routing.

```typescript
const webhook = await storage.getWebhookByFunction(tenantId, 'get_booking_details');
// Returns: webhook config with URL, auth, timeout, etc.
```

### getWebhooksByEvent(tenantId, eventType)

Finds all webhooks for event routing (supports wildcard '\*').

```typescript
const webhooks = await storage.getWebhooksByEvent(tenantId, 'chat_analyzed');
// Returns: array of webhook configs matching event or '*'
```

**Matching Logic:**

- Exact match: eventType = 'chat_analyzed' matches 'chat_analyzed'
- Wildcard: eventType = '\*' matches ALL events
- Returns all active webhooks matching either condition

### incrementWebhookStats(webhookId, success)

Updates webhook statistics after each call.

```typescript
await storage.incrementWebhookStats(webhook.id, true); // Success
await storage.incrementWebhookStats(webhook.id, false); // Failure
```

## Configuration Examples

### Event Listener Examples

1. **Chat Analytics to CRM**
   - Workflow Name: `crm_chat_sync`
   - Webhook Type: Event Listener
   - Event Type: `chat_analyzed`
   - Webhook URL: `https://n8n.hostinger.com/webhook/tenant-swc/crm-sync`
   - Purpose: Sync chat data to CRM after conversation

2. **Voice Call Analytics**
   - Workflow Name: `call_analytics_processor`
   - Webhook Type: Event Listener
   - Event Type: `call_analyzed`
   - Webhook URL: `https://n8n.hostinger.com/webhook/tenant-swc/call-analytics`
   - Purpose: Process call data for reporting

3. **All Events Logger**
   - Workflow Name: `event_logger`
   - Webhook Type: Event Listener
   - Event Type: `*` (all events)
   - Webhook URL: `https://n8n.hostinger.com/webhook/tenant-swc/event-log`
   - Purpose: Log all Retell events to database

### Function Call Examples

1. **Get Booking Details**
   - Workflow Name: `get_booking_details`
   - Webhook Type: Function Call
   - Function Name: `get_booking_details`
   - Response Timeout: 5000ms
   - Webhook URL: `https://n8n.hostinger.com/webhook/tenant-swc/booking-lookup`
   - Purpose: Look up booking info during conversation

2. **Create Appointment**
   - Workflow Name: `create_booking`
   - Webhook Type: Function Call
   - Function Name: `create_booking`
   - Response Timeout: 8000ms
   - Retry on Failure: true
   - Webhook URL: `https://n8n.hostinger.com/webhook/tenant-swc/create-appointment`
   - Purpose: Create new booking in real-time

3. **Check Availability**
   - Workflow Name: `check_availability`
   - Webhook Type: Function Call
   - Function Name: `check_availability`
   - Response Timeout: 3000ms
   - Webhook URL: `https://n8n.hostinger.com/webhook/tenant-swc/availability`
   - Purpose: Check tech availability during call

## UI Features (Integration Management)

### Webhook Creation Form

**Fields:**

1. **Workflow Name** (required, unique per tenant)
2. **Webhook Type** (dropdown)
   - Event Listener (Async)
   - Function Call (Sync)
3. **Event Type** (if Event Listener)
   - chat_analyzed
   - call_analyzed
   - chat_started
   - chat_ended
   - - (all events)
4. **Function Name** (if Function Call)
   - Text input (e.g., get_booking_details)
5. **Webhook URL** (required)
6. **Description** (optional)
7. **Auth Token** (optional)
8. **Response Timeout** (if Function Call, 1000-30000ms)
9. **Retry on Failure** (if Function Call, toggle)
10. **Active** (toggle)

### Webhooks List Table

**Columns:**

- Workflow Name
- Type (badge with icon)
  - 🔔 Event: event_type
  - ⚡ Function: function_name
- URL (truncated)
- Status (Active/Disabled)
- Stats (total calls, success rate)
- Actions (Edit, Delete)

## Security Features

1. **N8N URLs Hidden**
   - Retell only knows platform proxy URLs
   - Actual N8N webhook URLs stored in database
   - No exposure of N8N infrastructure

2. **Encryption at Rest**
   - Auth tokens encrypted in database
   - Uses ENCRYPTION_KEY from environment

3. **Tenant Isolation**
   - Each tenant's webhooks are isolated
   - No cross-tenant webhook access
   - Agent validation before routing

4. **Authorization Support**
   - Optional Bearer token per webhook
   - Sent as `Authorization: Bearer {token}` to N8N
   - N8N can validate incoming requests

## Migration Guide

### From Old System (Single Webhook)

**Step 1:** Identify current N8N workflows

- What events are they listening for?
- What functions are they implementing?

**Step 2:** Create Event Listener webhooks

- For each analytics workflow, create event_listener
- Set appropriate event type (chat_analyzed, call_analyzed)

**Step 3:** Create Function Call webhooks

- For each custom function in Retell, create function_call
- Match function names exactly with Retell configuration

**Step 4:** Update Retell Configuration

- Update custom function URLs to: `https://your-domain.com/api/functions/{functionName}`
- Keep webhook URLs the same (platform handles them)

**Step 5:** Test

- Test event forwarding (check N8N receives events)
- Test function calls (check Retell gets responses)
- Verify statistics are being tracked

**Step 6:** Remove Old Environment Variable

- Delete `N8N_WEBHOOK_URL` from .env files
- All routing is now database-driven

## Testing

### Test Event Listener

1. Trigger a chat conversation
2. Check platform logs for forwarding
3. Verify N8N workflow receives enriched payload
4. Check webhook statistics in UI

### Test Function Call

1. Configure function in Retell agent
2. During call, trigger function
3. Check platform proxy logs
4. Verify N8N response reaches Retell
5. Confirm function data used in conversation

### Test Error Handling

1. Set invalid N8N URL - should track failure
2. Set very low timeout - should timeout gracefully
3. Disable webhook - should not forward
4. Delete webhook - should return 404 to Retell

## Performance Considerations

1. **Event Listeners (Fire and Forget)**
   - Non-blocking parallel execution
   - 30s timeout per webhook
   - Failures logged but don't block response to Retell

2. **Function Calls (Synchronous)**
   - Blocks until N8N responds
   - Configurable timeout (default 10s, max 30s)
   - AbortController for clean timeout
   - Single webhook per function (fast lookup)

3. **Database Queries**
   - Indexed on tenant_id + function_name
   - Indexed on tenant_id + event_type
   - Fast lookups even with 100+ webhooks per tenant

## Monitoring & Analytics

### Webhook Statistics (Per Webhook)

- Total calls
- Successful calls
- Failed calls
- Last called timestamp
- Success rate percentage

### Platform Logs

```
[Function Proxy] === get_booking_details called ===
[Function Proxy] Resolved tenant: tenant_abc123
[Function Proxy] Routing to workflow: booking_lookup
[Function Proxy] Forwarding with 5000ms timeout
[Function Proxy] Response received in 234ms
[Function Proxy] ✓ Forwarded to booking_lookup
```

```
[Retell Webhook] Forwarding to 3 N8N webhook(s)
[Retell Webhook] ✓ Forwarded to crm_sync
[Retell Webhook] ✓ Forwarded to analytics_processor
[Retell Webhook] ✗ event_logger returned 500: Internal Server Error
```

## Files Changed

### Backend

- `shared/schema.ts` - Updated n8nWebhooks table schema
- `migrations/0009_add_webhook_types.sql` - Database migration
- `server/storage.ts` - Added getWebhookByFunction, getWebhooksByEvent
- `server/routes.ts` - Function proxy endpoint, updated event handlers

### Frontend

- `client/src/components/IntegrationManagement.tsx` - Webhook type UI

### Documentation

- `function-proxy-endpoint.ts` - Reference implementation
- `N8N_WEBHOOK_ROUTING_IMPLEMENTATION.md` - This document

## Git Commits

1. `3e3dee6` - feat: Add webhook types and function proxy support (schema, migration, storage)
2. `c17fb82` - feat: Implement dynamic N8N webhook routing (routes, proxy endpoint)
3. `7db4106` - feat: Add webhook type UI to Integration Management

## Next Steps

1. **Run Migration** ✅ DONE
   - `npm run db:push` to apply schema changes

2. **Update Existing Webhooks**
   - All existing webhooks default to event_listener with eventType='\*'
   - Review and update as needed

3. **Configure Retell Agents**
   - Update custom function URLs to use proxy endpoint
   - Test function calls end-to-end

4. **Monitor Production**
   - Watch webhook statistics
   - Check error rates
   - Optimize timeouts as needed

5. **Documentation for Clients**
   - How to create event listeners
   - How to create function calls
   - N8N workflow examples

## Support for SWC (Example)

### SWC Has 20+ Workflows:

**12 Chat Workflows:**

- Event listeners: chat_analyzed webhooks for different analytics
- Function calls: customer lookup, booking status, etc.

**8 Voice Workflows:**

- Event listeners: call_analyzed webhooks for call analytics
- Function calls: create booking, check availability, cancel appointment, etc.

**Configuration:**
All 20 webhooks can coexist in the platform:

- Each has unique workflow_name
- Event listeners can share event types (multiple webhooks for same event)
- Function calls have unique function_name (1:1 mapping)
- All isolated to SWC tenant_id
- WhatsApp credentials stay in N8N workflows (secure)

## Conclusion

The dynamic N8N webhook routing system is now fully implemented and ready for production use. The system provides:

✅ Multi-tenant support with isolated configurations
✅ Two webhook types (async events + sync functions)
✅ Secure proxy pattern hiding N8N infrastructure
✅ Dynamic routing based on tenant and event/function
✅ Comprehensive UI for webhook management
✅ Statistics tracking and monitoring
✅ Error handling and timeout management
✅ Scalable architecture supporting 100+ workflows per tenant

The platform is now ready to handle complex multi-workflow scenarios for clients like SWC with 20+ N8N workflows.
