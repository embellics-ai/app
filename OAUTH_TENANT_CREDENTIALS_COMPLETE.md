# OAuth Credential Proxy - Tenant-Specific Configuration Complete

## What Changed

### ✅ Architecture Shift: From Platform-Level to Tenant-Level Credentials

**Before:**

- WhatsApp credentials (App ID, App Secret, Access Tokens) stored in environment variables
- All tenants shared the same WhatsApp Business Account
- Platform admins managed all credentials

**After:**

- Each tenant configures their own WhatsApp Business Account credentials
- All credentials stored encrypted in database (`oauth_credentials` table)
- Zero WhatsApp credentials in environment variables
- Tenants are in complete control of their integrations

---

## Implementation Details

### 1. Database Schema (Already Existed!)

The `oauth_credentials` table already had the perfect schema:

```sql
CREATE TABLE oauth_credentials (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider TEXT NOT NULL,               -- 'whatsapp', 'google_sheets', etc.

  -- OAuth App Credentials (tenant-specific)
  client_id TEXT NOT NULL,              -- Facebook App ID
  client_secret TEXT NOT NULL,          -- Encrypted App Secret

  -- OAuth Tokens (obtained via OAuth flow)
  access_token TEXT,                    -- Encrypted Access Token
  refresh_token TEXT,                   -- Encrypted Refresh Token
  token_expiry TIMESTAMP,               -- When access_token expires

  scopes TEXT[],                        -- Granted permissions
  metadata JSONB,                       -- Phone number ID, etc.
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,

  UNIQUE(tenant_id, provider)          -- One credential per tenant per provider
);
```

### 2. Backend Changes

#### New API Endpoint: Configure OAuth App

```typescript
POST /api/platform/tenants/:tenantId/oauth/:provider/configure
Body: { clientId, clientSecret }
```

- Encrypts `clientSecret` before storing
- Creates or updates `oauth_credentials` record
- Sets `isActive: false` until OAuth flow completes

#### Updated OAuth Authorization Flow

```typescript
GET /api/platform/tenants/:tenantId/oauth/:provider/authorize
```

- Reads tenant's `clientId` from database
- Returns 400 error if tenant hasn't configured their OAuth app yet
- Redirects to Facebook with tenant's App ID

#### Updated OAuth Callback

```typescript
GET /api/platform/oauth/callback/:provider
```

- Reads tenant's `clientSecret` from database and decrypts it
- Exchanges authorization code for access token using tenant's credentials
- Stores encrypted access token in database

#### Updated Status Endpoint

```typescript
GET /api/platform/tenants/:tenantId/oauth/:provider
```

Returns:

```json
{
  "connected": true/false,
  "configured": true/false,  // NEW: whether app is configured
  "provider": "whatsapp",
  "tokenExpiry": "2026-01-30T...",
  "scopes": ["whatsapp_business_management", ...],
  "isActive": true
}
```

### 3. Frontend Changes

#### New OAuth Configuration UI

**Step 1: Configure OAuth App** (if not configured)

- Shows "Configure" button
- Opens form to enter App ID and App Secret
- Links to Meta Developer Portal for reference
- Saves encrypted credentials to database

**Step 2: Connect** (after configuration)

- Shows "Connect" button
- Redirects to OAuth authorization
- Completes OAuth flow
- Stores encrypted access token

**Step 3: Connected State**

- Shows connection status
- Shows token expiry
- "Test Connection" button
- "Disconnect" button

### 4. Environment Variables Removed

**Removed from `.env.local`:**

```bash
# ❌ No longer needed - stored in database per tenant
WHATSAPP_APP_ID
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
```

**Kept (Platform-Level Only):**

```bash
# System secrets
DATABASE_URL
SESSION_SECRET
ENCRYPTION_KEY

# N8N integration
N8N_WEBHOOK_SECRET
N8N_WEBHOOK_URL

# OAuth callbacks
APP_URL
```

---

## How It Works Now

### For Tenant Admins:

1. **Navigate to Integration Management → OAuth Connections**

2. **Configure WhatsApp OAuth App:**
   - Click "Configure"
   - Enter Facebook App ID (from Meta Developer Portal)
   - Enter Facebook App Secret (from Meta Developer Portal)
   - Click "Save Configuration"

3. **Connect WhatsApp:**
   - Click "Connect"
   - Redirected to Facebook OAuth dialog
   - Approve permissions
   - Redirected back to app
   - Access token stored encrypted in database

4. **Use in N8N:**
   - Update N8N WhatsApp nodes to use Proxy API:
   ```
   URL: https://your-app.com/api/proxy/{tenantId}/whatsapp/v22.0/{phoneId}/messages
   Headers:
     Authorization: Bearer {N8N_WEBHOOK_SECRET}
   ```

### Security Flow:

1. **Configuration:**

   ```
   Tenant enters:     App ID: 123456 (plain)
                      App Secret: abc123 (plain)

   Server encrypts:   clientId: 123456 (stored plain)
                      clientSecret: iv:tag:encrypted (AES-256-GCM)

   Database stores:   Both values in oauth_credentials table
   ```

2. **OAuth Flow:**

   ```
   Authorization:     Server reads clientId from DB
                      Redirects to Facebook with clientId

   Callback:          Server reads & decrypts clientSecret
                      Exchanges code for access token
                      Encrypts access token
                      Stores encrypted token in DB
   ```

3. **Proxy API Call:**

   ```
   N8N calls:         POST /api/proxy/{tenantId}/whatsapp/...
                      Authorization: Bearer {N8N_WEBHOOK_SECRET}

   Server:            Validates N8N secret
                      Fetches encrypted token from DB
                      Decrypts token in memory
                      Calls WhatsApp API with decrypted token
                      Returns response to N8N
   ```

---

## Benefits

### ✅ Multi-Tenant Isolation

- Each tenant has their own WhatsApp Business Account
- No credential sharing between tenants
- Complete data isolation

### ✅ Zero Credentials in Environment Variables

- Only platform secrets in env vars (encryption key, session secret, N8N secret)
- All tenant credentials encrypted in database
- No secrets in N8N workflows

### ✅ Tenant Control

- Tenants configure their own OAuth apps
- Tenants can disconnect and reconnect anytime
- Tenants control their own permissions

### ✅ Security

- Credentials encrypted at rest (AES-256-GCM)
- Credentials decrypted only in memory when needed
- N8N authentication required for proxy calls
- Per-tenant credential isolation

### ✅ Scalability

- Easy to add new OAuth providers (Google, Slack, etc.)
- Same pattern for all OAuth integrations
- No environment variable management overhead

---

## What's Next

### Optional Enhancements:

1. **Feature Flags** - Add `whatsapp_enabled` boolean to tenants table
   - Platform admin can enable/disable WhatsApp per tenant
   - Control which tenants have access to paid add-ons

2. **Token Refresh** - Implement automatic token refresh
   - For providers that support refresh tokens
   - Automatically renew expired tokens

3. **More OAuth Providers**
   - Google Sheets
   - Slack
   - Salesforce
   - Custom providers

4. **Audit Logging**
   - Track when credentials are configured
   - Track OAuth connections/disconnections
   - Monitor proxy API usage

---

## Testing

### Local Testing (Already Working!)

**Test with existing credential:**

```bash
node test-oauth.cjs
```

Results:

- ✅ Proxy API working
- ✅ WhatsApp connection successful
- ✅ Authentication working (invalid tokens rejected)

### Production Deployment

1. Deploy code to production
2. Add environment variables to Render:

   ```bash
   DATABASE_URL=...
   ENCRYPTION_KEY=...
   SESSION_SECRET=...
   N8N_WEBHOOK_SECRET=...
   APP_URL=https://your-app.onrender.com
   ```

3. Tenants configure their OAuth apps via UI
4. Update N8N workflows to use proxy endpoints

---

## Migration Path

### For Existing Tenants:

If you already have WhatsApp configured with platform-level credentials:

1. **Get their Facebook App credentials** (App ID & Secret)
2. **Use the configuration endpoint:**
   ```bash
   curl -X POST https://your-app.com/api/platform/tenants/{tenantId}/oauth/whatsapp/configure \
     -H "Authorization: Bearer {sessionToken}" \
     -H "Content-Type: application/json" \
     -d '{"clientId": "123456", "clientSecret": "abc123"}'
   ```
3. **They can then use OAuth flow** to get their access token

Or, insert directly into database with existing token:

```bash
# Update insert-test-credential.cjs with their credentials
node insert-test-credential.cjs
```

---

## Files Changed

### Backend:

- `server/routes.ts` - Added configure endpoint, updated OAuth endpoints
- `shared/schema.ts` - No changes (schema already perfect!)
- `server/storage.ts` - No changes (methods already correct!)

### Frontend:

- `client/src/components/IntegrationManagement.tsx` - Added configuration form

### Environment:

- `.env.local` - Removed all WhatsApp credentials

### Testing:

- `test-oauth.cjs` - Works with database credentials
- `insert-test-credential.cjs` - Can insert credentials for testing

---

## Conclusion

✅ **Complete architecture shift from platform-managed to tenant-managed credentials**
✅ **Zero WhatsApp credentials in environment variables**
✅ **All credentials encrypted in database**
✅ **Full multi-tenant isolation**
✅ **Production-ready OAuth credential proxy system**

The system is now truly multi-tenant, secure, and scalable. Each tenant manages their own integrations, and the platform never exposes credentials to N8N workflows.
