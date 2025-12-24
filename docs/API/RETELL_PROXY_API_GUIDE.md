# Retell AI Proxy API Guide

## Overview

This guide explains how to use the Retell AI Proxy API to make Retell AI calls from N8N workflows **without hardcoding credentials**.

The platform acts as a secure proxy between N8N and Retell AI, automatically handling:

- ✅ API key retrieval from encrypted database
- ✅ Multi-tenant credential isolation
- ✅ Automatic decryption
- ✅ Secure API calls to Retell AI

## Architecture

```
N8N Workflow
  ↓ (calls proxy with N8N_WEBHOOK_SECRET)
Your Platform (/api/proxy/:tenantId/retell/*)
  ↓ (validates N8N secret)
  ↓ (fetches encrypted Retell API key from database)
  ↓ (decrypts API key)
  ↓ (calls Retell AI API)
Retell AI API
```

## Authentication

### N8N → Platform Authentication

All proxy API calls from N8N must include the `N8N_WEBHOOK_SECRET`:

```http
Authorization: Bearer NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=
```

This secret is configured in your `.env` file:

```bash
# N8N Webhook Authentication
N8N_WEBHOOK_SECRET='NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g='
```

### Platform → Retell AI Authentication

The platform automatically:

1. Fetches the Retell API key from `widget_configs` table for the specified `tenantId`
2. Decrypts the API key using `ENCRYPTION_KEY`
3. Includes it in the `Authorization: Bearer <api_key>` header when calling Retell AI

## API Endpoints

### 1. Create Chat Session

**Endpoint:** `POST /api/proxy/:tenantId/retell/create-chat`

**Purpose:** Create a new Retell AI chat session

**Headers:**

```http
Content-Type: application/json
Authorization: Bearer {{N8N_WEBHOOK_SECRET}}
```

**URL Parameters:**

- `tenantId` - The tenant ID (extracted from webhook payload)

**Request Body:**

```json
{
  "agent_id": "agent_123abc",
  "metadata": {
    "conversationId": "conv_456def",
    "userId": "user_789ghi"
  }
}
```

**Response:**

```json
{
  "chat_id": "chat_abc123def456",
  "agent_id": "agent_123abc",
  "session_token": "sess_xyz789",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

**Example N8N Configuration:**

```
Node: Create-New-Chat
Method: POST
URL: https://embellics-app.onrender.com/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
Authentication: None

Send Headers: ON
Header Parameters:
  Name: Authorization
  Value: Bearer {{$env.N8N_WEBHOOK_SECRET}}

Body (JSON):
{
  "agent_id": "{{ $json.agentId }}",
  "metadata": {
    "conversationId": "{{ $json.conversationId }}",
    "phoneNumber": "{{ $json.from }}"
  }
}
```

### 2. Generic Retell API Proxy

**Endpoint:** `POST /api/proxy/:tenantId/retell/:endpoint`

**Purpose:** Proxy any Retell AI API endpoint

**Headers:**

```http
Content-Type: application/json
Authorization: Bearer {{N8N_WEBHOOK_SECRET}}
```

**URL Parameters:**

- `tenantId` - The tenant ID
- `endpoint` - The Retell AI API endpoint (e.g., `chat/end`, `list-calls`, `get-call/:callId`)

**Examples:**

#### End Chat Session

```
URL: https://embellics-app.onrender.com/api/proxy/SWC-Bhukkha/retell/chat/end

Body:
{
  "chat_id": "chat_abc123def456"
}
```

#### List Calls

```
URL: https://embellics-app.onrender.com/api/proxy/SWC-Bhukkha/retell/list-calls

Body:
{
  "limit": 10,
  "sort_order": "descending"
}
```

## N8N Workflow Setup

### Before (❌ Hardcoded Credentials)

```
Node: Create-New-Chat
URL: https://api.retellai.com/create-chat
Authentication: None
Headers:
  Authorization: Bearer key_93f64256e7e3591f07e71d3cbb9b  ❌ HARDCODED!
```

### After (✅ Using Proxy)

```
Node: Create-New-Chat
URL: https://embellics-app.onrender.com/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
Authentication: None
Headers:
  Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}  ✅ Environment variable
```

## Environment Configuration

### Development (.env.local)

```bash
# N8N Webhook Authentication
N8N_WEBHOOK_SECRET='NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g='

# Application URL
APP_URL='http://localhost:5000'
```

Update N8N workflow URL to:

```
http://localhost:5000/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
```

### Production (.env)

```bash
# N8N Webhook Authentication
N8N_WEBHOOK_SECRET='NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g='

# Application URL
APP_URL='https://embellics-app.onrender.com'
```

Update N8N workflow URL to:

```
https://embellics-app.onrender.com/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
```

## N8N Environment Variable Setup

In your N8N instance, configure the environment variable:

1. **N8N Settings** → **Environment Variables**
2. Add variable:
   - **Name:** `N8N_WEBHOOK_SECRET`
   - **Value:** `NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=`

Then use it in workflows as:

```
{{ $env.N8N_WEBHOOK_SECRET }}
```

## Security Benefits

### ✅ No Hardcoded Credentials

- Retell API keys are **never** stored in N8N workflows
- All credentials are encrypted in your platform's database
- Only N8N secret is required in N8N (single shared secret)

### ✅ Multi-Tenant Isolation

- Each tenant has their own Retell API key
- API keys are automatically selected based on `tenantId`
- No possibility of cross-tenant data access

### ✅ Encrypted at Rest

- Retell API keys are encrypted using `ENCRYPTION_KEY`
- Decryption happens only at runtime
- Database breach doesn't expose plain-text keys

### ✅ Centralized Management

- Update Retell API keys in your platform UI
- No need to update N8N workflows
- Immediate propagation of credential changes

## Error Handling

### 401 Unauthorized - Invalid N8N Secret

```json
{
  "error": "Invalid authorization token"
}
```

**Fix:** Verify `Authorization: Bearer` header matches `N8N_WEBHOOK_SECRET`

### 404 Not Found - Tenant Has No Retell API Key

```json
{
  "error": "Retell API key not found or inactive"
}
```

**Fix:**

1. Login to your platform as platform admin
2. Go to Tenant Management
3. Assign Retell API key to the tenant

### 500 Internal Server Error - Retell API Call Failed

```json
{
  "error": "Retell API request failed",
  "details": {
    "message": "Invalid agent_id"
  }
}
```

**Fix:** Check the Retell API error details and fix the request body

## Testing

### Test with cURL

```bash
# Test create-chat endpoint
curl -X POST \
  https://embellics-app.onrender.com/api/proxy/SWC-Bhukkha/retell/create-chat \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=' \
  -d '{
    "agent_id": "agent_abc123",
    "metadata": {
      "conversationId": "test_conv_123"
    }
  }'
```

Expected response:

```json
{
  "chat_id": "chat_xyz789",
  "agent_id": "agent_abc123",
  "session_token": "sess_token_here",
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

## Migration Checklist

- [ ] Add Retell API key to tenant configuration (if not already done)
- [ ] Configure `N8N_WEBHOOK_SECRET` environment variable in N8N
- [ ] Update N8N workflow URLs from `api.retellai.com` to your platform proxy
- [ ] Replace hardcoded `Authorization: Bearer key_*` with `Bearer {{$env.N8N_WEBHOOK_SECRET}}`
- [ ] Test create-chat endpoint
- [ ] Remove hardcoded Retell API keys from N8N workflows
- [ ] Update documentation

## Complete N8N Workflow Example

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "webhook/whatsapp-incoming",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "https://embellics-app.onrender.com/api/proxy/={{ $('Webhook').item.json.body.tenantId }}/retell/create-chat",
        "authentication": "none",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{ $env.N8N_WEBHOOK_SECRET }}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "agent_id",
              "value": "={{ $json.agentId }}"
            },
            {
              "name": "metadata",
              "value": {
                "conversationId": "={{ $json.conversationId }}",
                "phoneNumber": "={{ $json.from }}"
              }
            }
          ]
        }
      },
      "name": "Create-Retell-Chat",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300]
    },
    {
      "parameters": {
        "url": "https://embellics-app.onrender.com/api/proxy/={{ $('Webhook').item.json.body.tenantId }}/whatsapp/send",
        "authentication": "none",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{ $env.N8N_WEBHOOK_SECRET }}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "to",
              "value": "={{ $('Webhook').item.json.body.from }}"
            },
            {
              "name": "type",
              "value": "text"
            },
            {
              "name": "text",
              "value": {
                "body": "Chat session created! Chat ID: {{ $('Create-Retell-Chat').item.json.chat_id }}"
              }
            }
          ]
        }
      },
      "name": "Send-WhatsApp-Reply",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300]
    }
  ]
}
```

## Support

If you encounter issues:

1. Check N8N execution logs for error details
2. Verify `N8N_WEBHOOK_SECRET` matches between N8N and your platform
3. Confirm tenant has a Retell API key configured
4. Test the proxy endpoint with cURL first
5. Check your platform's server logs

## Summary

**Before:**

- ❌ Hardcoded Retell API keys in N8N
- ❌ Security risk if N8N is compromised
- ❌ Manual update of all workflows when key changes
- ❌ No multi-tenant support

**After:**

- ✅ No credentials in N8N workflows
- ✅ All credentials encrypted in database
- ✅ Single `N8N_WEBHOOK_SECRET` to manage
- ✅ Automatic multi-tenant routing
- ✅ Centralized credential management
