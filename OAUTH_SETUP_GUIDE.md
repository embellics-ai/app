# OAuth Credential Proxy Setup Guide

## Overview

This guide walks you through setting up the OAuth credential proxy system for WhatsApp Business API. The system securely stores OAuth credentials in your database (encrypted) and provides proxy endpoints that N8N can call without exposing sensitive tokens.

## Architecture

```
N8N Workflow
    ↓ (authenticated with N8N_WEBHOOK_SECRET)
Your Proxy API (/api/proxy/:tenantId/whatsapp/send)
    ↓ (fetches encrypted credentials from DB)
Decrypt Access Token
    ↓ (uses decrypted token)
WhatsApp Business API
```

## Phase 3: OAuth Authorization Endpoints (COMPLETED ✅)

### Endpoints Created

1. **GET /api/platform/tenants/:tenantId/oauth/whatsapp/authorize**
   - Initiates WhatsApp OAuth flow
   - Redirects to Meta's OAuth authorization page
   - Protected with `requireAuth` middleware

2. **GET /api/platform/oauth/callback/whatsapp**
   - Handles OAuth callback from Meta
   - Exchanges authorization code for access token
   - Stores encrypted credentials in database

3. **GET /api/platform/tenants/:tenantId/oauth/:provider**
   - Returns OAuth connection status
   - Shows token expiry, scopes, last used time
   - Does NOT expose actual credentials

4. **DELETE /api/platform/tenants/:tenantId/oauth/:provider**
   - Disconnects OAuth credential
   - Removes from database
   - Protected with `requireAuth` middleware

## Setup Instructions

### Step 1: Create Facebook App for WhatsApp

1. Go to https://developers.facebook.com/apps/
2. Click "Create App"
3. Select "Business" as app type
4. Fill in app details:
   - App Name: "Your Company WhatsApp Integration"
   - App Contact Email: your@email.com
5. Click "Create App"

### Step 2: Configure WhatsApp Product

1. In your new app dashboard, click "Add Product"
2. Find "WhatsApp" and click "Set Up"
3. Follow the setup wizard to:
   - Link your WhatsApp Business Account
   - Get your Phone Number ID
   - Generate a temporary access token

### Step 3: Set Up OAuth Credentials

1. In the Facebook App dashboard, go to "Settings" → "Basic"
2. Copy your **App ID** and **App Secret**
3. Add to `.env.local`:

```bash
# WhatsApp OAuth Configuration
WHATSAPP_APP_ID='your_app_id_here'
WHATSAPP_APP_SECRET='your_app_secret_here'
APP_URL='http://localhost:3000'  # For local dev
# APP_URL='https://embellics-app.onrender.com'  # For production
```

### Step 4: Configure OAuth Redirect URI

1. In Facebook App dashboard, go to "WhatsApp" → "Configuration"
2. Under "Webhook", add your callback URL:
   - Local: `http://localhost:3000/api/platform/oauth/callback/whatsapp`
   - Production: `https://embellics-app.onrender.com/api/platform/oauth/callback/whatsapp`

### Step 5: Test OAuth Flow

1. **Start your development server:**

   ```bash
   npm run dev
   ```

2. **Log in as a tenant admin:**
   - Go to http://localhost:3000
   - Log in with Test Corp credentials

3. **Initiate OAuth flow:**

   ```bash
   # Replace with your actual tenant ID
   curl http://localhost:3000/api/platform/tenants/e3fe58df-4077-4fc2-a75a-f0fa8ac50028/oauth/whatsapp/authorize \
     -H "Cookie: your-session-cookie"
   ```

   Or simply visit the URL in your browser while logged in.

4. **Complete authorization:**
   - You'll be redirected to Facebook Login
   - Authorize the app
   - You'll be redirected back to your app with success

5. **Check credential status:**

   ```bash
   curl http://localhost:3000/api/platform/tenants/e3fe58df-4077-4fc2-a75a-f0fa8ac50028/oauth/whatsapp \
     -H "Cookie: your-session-cookie"
   ```

   Expected response:

   ```json
   {
     "connected": true,
     "provider": "whatsapp",
     "isActive": true,
     "tokenExpiry": "2025-01-30T...",
     "scopes": ["whatsapp_business_management", "whatsapp_business_messaging"],
     "lastUsedAt": null,
     "createdAt": "2025-12-01T..."
   }
   ```

## Database Schema

The OAuth credentials are stored in the `oauth_credentials` table:

```sql
CREATE TABLE oauth_credentials (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,  -- ENCRYPTED
  access_token TEXT NOT NULL,   -- ENCRYPTED
  refresh_token TEXT,           -- ENCRYPTED (if available)
  token_expiry TIMESTAMP,
  scopes TEXT[],
  metadata JSONB,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);
```

## Security Features

1. **Encrypted Storage**: All tokens encrypted with `ENCRYPTION_KEY`
2. **Per-Tenant Isolation**: Each tenant has separate credentials
3. **Authentication Required**: All endpoints require valid session
4. **No Token Exposure**: Status endpoint never returns actual tokens
5. **Audit Trail**: Tracks last usage time for each credential

## Next Steps (Phase 4)

After confirming OAuth flow works, we'll implement:

1. **WhatsApp Proxy API Endpoints:**
   - `POST /api/proxy/:tenantId/whatsapp/send` - Send messages
   - `GET /api/proxy/:tenantId/whatsapp/templates` - List templates
2. **Token Refresh Logic:**
   - Auto-refresh expired tokens
   - Update database with new tokens
3. **N8N Authentication:**
   - Validate `N8N_WEBHOOK_SECRET` header
   - Only allow requests from your N8N instance

## Troubleshooting

### Issue: OAuth redirect not working

**Solution:** Check that your `APP_URL` in `.env.local` matches your actual URL and is registered in Facebook App settings.

### Issue: Token exchange fails

**Solution:** Verify `WHATSAPP_APP_ID` and `WHATSAPP_APP_SECRET` are correct in `.env.local`.

### Issue: "Access denied to this tenant"

**Solution:** Make sure you're logged in as a user with access to the tenant ID in the URL.

### Issue: Database error when storing credential

**Solution:** Run `npm run db:push` to ensure the `oauth_credentials` table exists.

## Testing Checklist

- [ ] Facebook App created and configured
- [ ] WhatsApp product added to app
- [ ] App ID and Secret added to `.env.local`
- [ ] OAuth redirect URI configured in Facebook App
- [ ] Initiated OAuth flow and completed authorization
- [ ] Verified credential stored in database (check with status endpoint)
- [ ] Confirmed credentials are encrypted in database
- [ ] Tested disconnect/reconnect flow

## Production Deployment

When deploying to production (Render):

1. Add environment variables in Render dashboard:

   ```
   WHATSAPP_APP_ID=<your_app_id>
   WHATSAPP_APP_SECRET=<your_app_secret>
   APP_URL=https://embellics-app.onrender.com
   ```

2. Update OAuth redirect URI in Facebook App to production URL

3. Test OAuth flow on production environment

4. Update N8N workflows to use production proxy endpoints (Phase 4)
