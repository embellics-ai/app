# WhatsApp Proxy API Guide

## Overview

The WhatsApp Proxy API provides secure endpoints for N8N workflows to interact with WhatsApp Business API without exposing OAuth credentials. All requests are authenticated using the `N8N_WEBHOOK_SECRET`.

## Architecture

```
N8N Workflow
    ↓ (Authorization: Bearer N8N_WEBHOOK_SECRET)
Proxy API (/api/proxy/:tenantId/whatsapp/...)
    ↓ (fetches & decrypts OAuth token)
WhatsApp Business API
    ↓
Response back to N8N
```

## Authentication

All proxy endpoints require the N8N webhook secret in the Authorization header:

```bash
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
```

The secret is stored in `.env.local` as `N8N_WEBHOOK_SECRET`.

## Endpoints

### 1. Send WhatsApp Message

**POST** `/api/proxy/:tenantId/whatsapp/send`

Send a WhatsApp message through the tenant's authenticated account.

**Parameters:**
- `tenantId` (path) - UUID of the tenant

**Headers:**
```
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
Content-Type: application/json
```

**Request Body (Text Message):**
```json
{
  "messaging_product": "whatsapp",
  "to": "1234567890",
  "type": "text",
  "text": {
    "body": "Hello from N8N!"
  }
}
```

**Request Body (Template Message):**
```json
{
  "messaging_product": "whatsapp",
  "to": "1234567890",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "en_US"
    }
  }
}
```

**Response:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "1234567890",
      "wa_id": "1234567890"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgNMTIzNDU2Nzg5MAA="
    }
  ]
}
```

**Error Response:**
```json
{
  "error": "Failed to send WhatsApp message",
  "message": "WhatsApp token expired. Please reconnect your WhatsApp account."
}
```

### 2. Get WhatsApp Templates

**GET** `/api/proxy/:tenantId/whatsapp/templates`

Fetch all message templates for the tenant's WhatsApp Business Account.

**Parameters:**
- `tenantId` (path) - UUID of the tenant

**Headers:**
```
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
```

**Response:**
```json
{
  "data": [
    {
      "name": "hello_world",
      "components": [...],
      "language": "en_US",
      "status": "APPROVED",
      "category": "MARKETING",
      "id": "1234567890"
    }
  ],
  "paging": {
    "cursors": {
      "before": "...",
      "after": "..."
    }
  }
}
```

### 3. Get WhatsApp Media

**GET** `/api/proxy/:tenantId/whatsapp/media/:mediaId`

Download media URL for incoming WhatsApp messages.

**Parameters:**
- `tenantId` (path) - UUID of the tenant
- `mediaId` (path) - Media ID from WhatsApp webhook

**Headers:**
```
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
```

**Response:**
```json
{
  "url": "https://lookaside.fbsbx.com/...",
  "mime_type": "image/jpeg",
  "sha256": "...",
  "file_size": 12345,
  "id": "1234567890"
}
```

### 4. Test WhatsApp Connection

**GET** `/api/proxy/:tenantId/whatsapp/test`

Test the WhatsApp connection and retrieve phone number information.

**Parameters:**
- `tenantId` (path) - UUID of the tenant

**Headers:**
```
Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
```

**Response:**
```json
{
  "connected": true,
  "phoneNumber": "+1 555-123-4567",
  "verifiedName": "Your Business Name",
  "quality": "GREEN"
}
```

**Error Response:**
```json
{
  "connected": false,
  "error": "Failed to test WhatsApp connection",
  "message": "WhatsApp credential not found or inactive"
}
```

## N8N Integration Examples

### Example 1: Send Text Message from N8N

**HTTP Request Node Configuration:**

- **Method:** POST
- **URL:** `https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/whatsapp/send`
- **Authentication:** None (use custom headers)
- **Headers:**
  ```json
  {
    "Authorization": "Bearer YOUR_N8N_WEBHOOK_SECRET",
    "Content-Type": "application/json"
  }
  ```
- **Body:**
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "{{$json.phoneNumber}}",
    "type": "text",
    "text": {
      "body": "{{$json.message}}"
    }
  }
  ```

### Example 2: Send Template Message

**HTTP Request Node Configuration:**

- **Method:** POST
- **URL:** `https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/whatsapp/send`
- **Headers:**
  ```json
  {
    "Authorization": "Bearer YOUR_N8N_WEBHOOK_SECRET",
    "Content-Type": "application/json"
  }
  ```
- **Body:**
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "{{$json.phoneNumber}}",
    "type": "template",
    "template": {
      "name": "appointment_reminder",
      "language": {
        "code": "en"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": "{{$json.customerName}}"
            },
            {
              "type": "text",
              "text": "{{$json.appointmentDate}}"
            }
          ]
        }
      ]
    }
  }
  ```

### Example 3: Get Templates Before Sending

**HTTP Request Node Configuration:**

- **Method:** GET
- **URL:** `https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/whatsapp/templates`
- **Headers:**
  ```json
  {
    "Authorization": "Bearer YOUR_N8N_WEBHOOK_SECRET"
  }
  ```

## Security Features

### 1. N8N Authentication
- All requests must include `N8N_WEBHOOK_SECRET` in Authorization header
- Invalid or missing secret returns 401 Unauthorized
- Secret is validated before any database queries

### 2. Tenant Isolation
- Each request is scoped to a specific tenant ID
- OAuth credentials are fetched per tenant
- No cross-tenant data leakage possible

### 3. Token Encryption
- Access tokens stored encrypted in database
- Decrypted only in memory during API calls
- Automatic token expiry checking

### 4. Audit Trail
- Last used timestamp updated on each request
- All requests logged with tenant ID
- Failed authentication attempts logged

## Token Management

### Token Expiry

The proxy automatically checks token expiry before each request:

```typescript
if (credential.tokenExpiry && new Date() >= new Date(credential.tokenExpiry)) {
  throw new Error('WhatsApp token expired. Please reconnect your WhatsApp account.');
}
```

**Handling Expired Tokens:**

1. User receives error in N8N workflow
2. Admin reconnects WhatsApp via OAuth flow
3. New token stored in database
4. Workflows resume automatically

### Token Refresh (Future Enhancement)

Currently, Meta's WhatsApp Business API uses long-lived tokens (60 days) without refresh tokens. Token refresh will be implemented when Meta supports it.

## Error Handling

### Common Errors

**401 Unauthorized**
```json
{
  "error": "Invalid authorization token"
}
```
- **Cause:** Wrong or missing N8N_WEBHOOK_SECRET
- **Solution:** Check Authorization header format and secret value

**500 Token Expired**
```json
{
  "error": "Failed to send WhatsApp message",
  "message": "WhatsApp token expired. Please reconnect your WhatsApp account."
}
```
- **Cause:** OAuth token expired (after 60 days)
- **Solution:** Reconnect WhatsApp via OAuth flow in UI

**500 Credential Not Found**
```json
{
  "error": "Failed to send WhatsApp message",
  "message": "WhatsApp credential not found or inactive"
}
```
- **Cause:** Tenant hasn't connected WhatsApp yet
- **Solution:** Complete OAuth connection in Integration Management

**500 Configuration Missing**
```json
{
  "error": "WhatsApp phone number ID not configured"
}
```
- **Cause:** Missing metadata in OAuth credential
- **Solution:** Ensure WHATSAPP_PHONE_NUMBER_ID is set or add to credential metadata

## Testing the Proxy API

### Step 1: Test Connection

```bash
curl -X GET \
  'http://localhost:3000/api/proxy/e3fe58df-4077-4fc2-a75a-f0fa8ac50028/whatsapp/test' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET'
```

Expected response:
```json
{
  "connected": true,
  "phoneNumber": "+1 555-123-4567",
  "verifiedName": "Test Business",
  "quality": "GREEN"
}
```

### Step 2: Test Template Fetch

```bash
curl -X GET \
  'http://localhost:3000/api/proxy/e3fe58df-4077-4fc2-a75a-f0fa8ac50028/whatsapp/templates' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET'
```

### Step 3: Test Send Message

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/e3fe58df-4077-4fc2-a75a-f0fa8ac50028/whatsapp/send' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "text",
    "text": {
      "body": "Test message from proxy API"
    }
  }'
```

## Updating N8N Workflows

### Before (Direct WhatsApp API Call - INSECURE)

```json
{
  "method": "POST",
  "url": "https://graph.facebook.com/v21.0/PHONE_NUMBER_ID/messages",
  "headers": {
    "Authorization": "Bearer EXPOSED_TOKEN",
    "Content-Type": "application/json"
  }
}
```

### After (Through Proxy - SECURE)

```json
{
  "method": "POST",
  "url": "https://embellics-app.onrender.com/api/proxy/TENANT_ID/whatsapp/send",
  "headers": {
    "Authorization": "Bearer N8N_WEBHOOK_SECRET",
    "Content-Type": "application/json"
  }
}
```

**Benefits:**
- ✅ No OAuth tokens exposed in N8N workflows
- ✅ Centralized token management
- ✅ Automatic token expiry handling
- ✅ Per-tenant isolation
- ✅ Audit trail of all API calls

## Production Deployment

### Environment Variables (Render)

Add these to your Render service:

```bash
N8N_WEBHOOK_SECRET=your_secret_from_env_local
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

### Update N8N Workflows

Replace all URLs in N8N workflows:
- From: `http://localhost:3000/api/proxy/...`
- To: `https://embellics-app.onrender.com/api/proxy/...`

### Test Production Endpoints

Use the same curl commands but with production URL:

```bash
curl -X GET \
  'https://embellics-app.onrender.com/api/proxy/TENANT_ID/whatsapp/test' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET'
```

## Troubleshooting

### Issue: "Invalid authorization token"

**Check:**
1. Authorization header format: `Bearer YOUR_SECRET`
2. Secret matches `.env.local` exactly
3. No extra whitespace in secret

### Issue: "WhatsApp credential not found"

**Check:**
1. Tenant has completed OAuth flow
2. Check database: `SELECT * FROM oauth_credentials WHERE tenant_id = 'TENANT_ID'`
3. Credential `is_active = true`

### Issue: "Token expired"

**Solution:**
1. Go to Integration Management in UI
2. Disconnect WhatsApp
3. Reconnect WhatsApp (new OAuth flow)
4. New token stored automatically

### Issue: "Phone number ID not configured"

**Solution:**
1. Add to credential metadata during OAuth callback, OR
2. Set `WHATSAPP_PHONE_NUMBER_ID` in environment variables

## Next Steps

After completing Phase 4:
1. **Phase 5:** Build UI for OAuth connection management
2. **Phase 6:** Test end-to-end OAuth flow
3. **Phase 7:** Update all N8N workflows to use proxy endpoints
4. **Phase 8:** Deploy to production and verify

## Support

For issues or questions:
1. Check logs: `[Proxy]` prefix in console
2. Verify database: `oauth_credentials` table
3. Test with curl commands above
4. Check WhatsApp Business API status: https://developers.facebook.com/status/
