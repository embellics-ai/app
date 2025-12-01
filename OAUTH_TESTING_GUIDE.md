# OAuth Credential Proxy - End-to-End Testing Guide

## Overview

This guide walks you through testing the complete OAuth credential proxy system from start to finish.

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1-5 Complete: OAuth Credential Proxy System         │
├─────────────────────────────────────────────────────────────┤
│  ✅ Database: oauth_credentials table                       │
│  ✅ Storage Layer: 7 CRUD methods                           │
│  ✅ OAuth Endpoints: Authorization & callback handlers      │
│  ✅ Proxy API: 4 WhatsApp endpoints                         │
│  ✅ UI: OAuth Connections tab in Integration Management     │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before testing, ensure you have:

- [ ] WhatsApp Business API credentials (App ID, App Secret)
- [ ] Environment variables configured in `.env.local`
- [ ] N8N instance running and accessible
- [ ] Test tenant account (Test Corp recommended)
- [ ] Dev server running locally (`npm run dev`)

## Phase 6: End-to-End Testing

### Test 1: UI Navigation ✅

**Objective:** Verify OAuth Connections tab is accessible

**Steps:**

1. Start dev server: `npm run dev`
2. Log in to dashboard
3. Navigate to Integration Management
4. Click "OAuth Connections" tab

**Expected Result:**

- Tab appears with "OAuth Connections" title
- WhatsApp Business API card visible
- "Connect" button displayed
- Description explains secure credential storage

**Screenshot Location:** Take screenshot of OAuth tab

---

### Test 2: OAuth Authorization Flow ✅

**Objective:** Complete WhatsApp OAuth connection

**Steps:**

1. In OAuth Connections tab, click "Connect" button on WhatsApp card
2. You should be redirected to Facebook Login
3. Log in with your Facebook account (if not already logged in)
4. Authorize the app to access WhatsApp Business API
5. You'll be redirected back to your app

**Expected Result:**

- Redirect to: `http://localhost:3000/?oauth_success=whatsapp`
- OAuth Connections tab shows:
  - Badge: "Connected" (green)
  - Token expiry date
  - "Test Connection" button
  - "Disconnect" button
- Database check:
  ```sql
  SELECT * FROM oauth_credentials
  WHERE tenant_id = 'YOUR_TENANT_ID'
  AND provider = 'whatsapp';
  ```
- Credentials should show:
  - Encrypted `access_token`
  - Encrypted `client_secret`
  - `is_active = true`
  - Recent `created_at` timestamp

**Troubleshooting:**

- If redirect fails, check `WHATSAPP_APP_ID` and `WHATSAPP_APP_SECRET` in `.env.local`
- If "Invalid redirect URI" error, verify OAuth redirect URI in Facebook App settings

---

### Test 3: Connection Status Display ✅

**Objective:** Verify UI shows correct connection status

**Steps:**

1. Refresh the OAuth Connections tab
2. Observe WhatsApp card details

**Expected Result:**

- Connection status badge shows "Connected"
- Token expiry shows "Expires in X days"
- Last used timestamp (if previously used)
- No error messages

**Test Disconnected State:**

1. Click "Disconnect" button
2. Confirm in dialog
3. Page should refresh
4. Badge changes to no badge (not connected)
5. "Connect" button reappears

**Database Verification:**

```sql
-- After disconnect, credential should be deleted
SELECT * FROM oauth_credentials WHERE tenant_id = 'YOUR_TENANT_ID';
-- Should return empty result
```

---

### Test 4: Test Connection Feature ✅

**Objective:** Verify "Test Connection" button works

**Steps:**

1. Ensure WhatsApp is connected (re-connect if needed)
2. Click "Test Connection" button
3. Wait for response

**Expected Result:**

- Button shows "Testing..." with spinner
- After 1-2 seconds, success toast appears:
  - Title: "Connection successful"
  - Description: Shows your WhatsApp phone number
- Console log shows: `[Proxy] WhatsApp connection test successful`

**If Test Fails:**

- Check browser console for errors
- Verify `N8N_WEBHOOK_SECRET` in environment
- Check if access token is valid (not expired)
- Look for server logs: `[Proxy] Error testing WhatsApp connection`

---

### Test 5: Proxy API - Send Message ✅

**Objective:** Test WhatsApp message sending via proxy

**Prerequisites:**

- WhatsApp connected via OAuth
- Know your `N8N_WEBHOOK_SECRET` from `.env.local`
- Have a test phone number (with country code, no + symbol)

**Steps:**

1. **Using curl:**

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "text",
    "text": {
      "body": "Test message from OAuth proxy API"
    }
  }'
```

**Expected Response:**

```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "1234567890", "wa_id": "1234567890" }],
  "messages": [{ "id": "wamid.HBgNMTIzNDU2Nzg5MAA=" }]
}
```

**Server Logs:**

```
[Proxy] WhatsApp send request for tenant: YOUR_TENANT_ID
[Proxy] WhatsApp message sent successfully: wamid.HBgNMTIzNDU2Nzg5MAA=
```

**Database Verification:**

```sql
-- last_used_at should be updated
SELECT last_used_at FROM oauth_credentials
WHERE tenant_id = 'YOUR_TENANT_ID'
AND provider = 'whatsapp';
-- Should show current timestamp
```

---

### Test 6: Proxy API - Get Templates ✅

**Objective:** Test fetching WhatsApp templates via proxy

**Steps:**

```bash
curl -X GET \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/templates' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET'
```

**Expected Response:**

```json
{
  "data": [
    {
      "name": "hello_world",
      "components": [...],
      "language": "en_US",
      "status": "APPROVED",
      "category": "UTILITY",
      "id": "1234567890"
    }
  ]
}
```

**Server Logs:**

```
[Proxy] WhatsApp templates request for tenant: YOUR_TENANT_ID
[Proxy] WhatsApp templates fetched successfully: 5 templates
```

---

### Test 7: Token Expiry Handling ✅

**Objective:** Verify system handles expired tokens gracefully

**Steps:**

1. **Manually expire token in database:**

```sql
UPDATE oauth_credentials
SET token_expiry = NOW() - INTERVAL '1 day'
WHERE tenant_id = 'YOUR_TENANT_ID'
AND provider = 'whatsapp';
```

2. **Refresh OAuth Connections tab**

**Expected Result:**

- Badge shows "Expired" (red)
- Alert message: "Your access token has expired. Please reconnect..."
- "Reconnect" button appears
- "Test Connection" button is disabled

3. **Try sending message:**

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"messaging_product":"whatsapp","to":"1234567890","type":"text","text":{"body":"Test"}}'
```

**Expected Response:**

```json
{
  "error": "Failed to send WhatsApp message",
  "message": "WhatsApp token expired. Please reconnect your WhatsApp account."
}
```

4. **Click "Reconnect" button**

- Should redirect to OAuth flow again
- After authorizing, token_expiry updates to 60 days from now
- Badge returns to "Connected"

---

### Test 8: N8N Authentication ✅

**Objective:** Verify proxy API requires valid N8N secret

**Steps:**

1. **Test with wrong secret:**

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send' \
  -H 'Authorization: Bearer WRONG_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"messaging_product":"whatsapp","to":"1234567890","type":"text","text":{"body":"Test"}}'
```

**Expected Response:**

```json
{
  "error": "Invalid authorization token"
}
```

**Status Code:** 401 Unauthorized

2. **Test with missing header:**

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send' \
  -H 'Content-Type: application/json' \
  -d '{"messaging_product":"whatsapp","to":"1234567890","type":"text","text":{"body":"Test"}}'
```

**Expected Response:**

```json
{
  "error": "Missing authorization header"
}
```

---

### Test 9: Tenant Isolation ✅

**Objective:** Verify credentials are tenant-specific

**Steps:**

1. **Connect WhatsApp for Tenant A**
2. **Try to access Tenant A's credentials as Tenant B:**

```bash
# Using Tenant B's ID but Tenant A's WhatsApp connection
curl -X POST \
  'http://localhost:3000/api/proxy/TENANT_B_ID/whatsapp/send' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{"messaging_product":"whatsapp","to":"1234567890","type":"text","text":{"body":"Test"}}'
```

**Expected Response:**

```json
{
  "error": "Failed to send WhatsApp message",
  "message": "WhatsApp credential not found or inactive"
}
```

**Database Verification:**

```sql
-- Should only see credentials for Tenant A
SELECT tenant_id, provider FROM oauth_credentials;
```

---

### Test 10: N8N Workflow Integration ✅

**Objective:** Test real N8N workflow using proxy API

**Prerequisites:**

- N8N instance running
- N8N_WEBHOOK_SECRET configured in both apps

**Steps:**

1. **Create N8N workflow:**
   - Add "HTTP Request" node
   - Method: POST
   - URL: `http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send`
   - Authentication: None (use custom headers)
   - Headers:
     ```json
     {
       "Authorization": "Bearer YOUR_N8N_WEBHOOK_SECRET",
       "Content-Type": "application/json"
     }
     ```
   - Body:
     ```json
     {
       "messaging_product": "whatsapp",
       "to": "1234567890",
       "type": "text",
       "text": {
         "body": "Message from N8N workflow via proxy"
       }
     }
     ```

2. **Execute workflow**

**Expected Result:**

- Workflow executes successfully
- WhatsApp message is sent
- No OAuth credentials visible in N8N logs
- Server shows: `[Proxy] WhatsApp send request for tenant`

---

### Test 11: Error Handling ✅

**Objective:** Verify graceful error handling

**Test Cases:**

1. **Invalid phone number:**

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "invalid",
    "type": "text",
    "text": {"body": "Test"}
  }'
```

**Expected:** Error from WhatsApp API with details

2. **Missing required fields:**

```bash
curl -X POST \
  'http://localhost:3000/api/proxy/YOUR_TENANT_ID/whatsapp/send' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "messaging_product": "whatsapp"
  }'
```

**Expected:** Error about missing fields

3. **Non-existent tenant:**

```bash
curl -X GET \
  'http://localhost:3000/api/proxy/00000000-0000-0000-0000-000000000000/whatsapp/templates' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET'
```

**Expected:**

```json
{
  "error": "Failed to fetch WhatsApp templates",
  "message": "WhatsApp credential not found or inactive"
}
```

---

## Testing Checklist

Use this checklist to track your testing progress:

### UI Tests

- [ ] OAuth Connections tab visible
- [ ] WhatsApp card displays correctly
- [ ] Connect button triggers OAuth flow
- [ ] OAuth callback redirects successfully
- [ ] Connection status updates in real-time
- [ ] Test Connection button works
- [ ] Disconnect button removes credentials
- [ ] Token expiry date shows correctly
- [ ] Expired token shows red badge
- [ ] Reconnect button appears when expired

### API Tests

- [ ] POST /api/proxy/:tenantId/whatsapp/send works
- [ ] GET /api/proxy/:tenantId/whatsapp/templates works
- [ ] GET /api/proxy/:tenantId/whatsapp/test works
- [ ] GET /api/proxy/:tenantId/whatsapp/media/:mediaId works
- [ ] Authentication with N8N_WEBHOOK_SECRET required
- [ ] Invalid secret returns 401
- [ ] Missing header returns 401
- [ ] Token expiry checked before requests
- [ ] Expired token returns clear error message
- [ ] last_used_at timestamp updates

### Database Tests

- [ ] Credentials stored with encryption
- [ ] access_token is encrypted (not readable)
- [ ] client_secret is encrypted
- [ ] Unique constraint on (tenant_id, provider)
- [ ] Disconnect deletes record
- [ ] Reconnect updates existing record

### Security Tests

- [ ] Tenant isolation enforced
- [ ] No credentials visible in N8N workflows
- [ ] No tokens in browser console
- [ ] API responses never expose raw tokens
- [ ] Status endpoint doesn't expose credentials
- [ ] Audit trail (last_used_at) working

### Integration Tests

- [ ] N8N workflow can send WhatsApp messages
- [ ] Multiple tenants can connect independently
- [ ] Proxy API accessible from N8N server
- [ ] Error messages clear and actionable

---

## Common Issues & Solutions

### Issue: "Invalid redirect URI"

**Solution:** Add callback URL to Facebook App settings:

- Go to Facebook App → WhatsApp → Configuration
- Add: `http://localhost:3000/api/platform/oauth/callback/whatsapp`

### Issue: "OAuth credential not found"

**Solution:** Complete OAuth flow in UI first before testing proxy API

### Issue: "Invalid authorization token"

**Solution:** Check `N8N_WEBHOOK_SECRET` matches in both environments

### Issue: "Token expired"

**Solution:** Click "Reconnect" in UI to get new token

### Issue: Test Connection fails

**Solution:**

1. Check `WHATSAPP_PHONE_NUMBER_ID` in `.env.local`
2. Verify access token is valid
3. Check WhatsApp Business API status

---

## Production Deployment Checklist

After all tests pass:

- [ ] Deploy to production (Render)
- [ ] Add environment variables in Render dashboard
- [ ] Update OAuth redirect URI to production URL
- [ ] Test OAuth flow on production
- [ ] Update N8N workflows to use production proxy URL
- [ ] Monitor logs for errors
- [ ] Set up alerts for failed authentications
- [ ] Document for team

---

## Success Metrics

Your OAuth Credential Proxy system is working correctly when:

✅ Users can connect WhatsApp via OAuth without technical knowledge  
✅ N8N workflows send messages without exposing credentials  
✅ Expired tokens are detected and users prompted to reconnect  
✅ All API calls are authenticated and logged  
✅ Multi-tenant isolation is enforced  
✅ Error messages are clear and actionable  
✅ System scales to multiple OAuth providers

Congratulations! You've built a secure, scalable OAuth credential proxy system! 🎉
