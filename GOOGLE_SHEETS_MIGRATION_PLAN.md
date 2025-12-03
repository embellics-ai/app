# Google Sheets OAuth Migration Plan

**Date:** December 3, 2025  
**Goal:** Remove Google Sheets OAuth credentials from N8N and use External APIs proxy system  
**Status:** 📋 Planning

---

## Current Problem

**What you have now:**

- Google Sheets OAuth2 credentials stored in N8N
- Client ID: `494767672859-mo592md5s3id2hhlhpfun1fpqors653u.apps.googleusercontent.com`
- Client Secret: Stored in N8N (hidden with dots)
- OAuth Redirect URL: `https://n8n.srv1144822.hstgr.cloud/rest/oauth2-credential/callback`

**Why this is a problem:**

1. ❌ Credentials exposed in N8N UI
2. ❌ Multiple team members can see/access credentials
3. ❌ No audit trail of who uses the API
4. ❌ Hard to rotate credentials
5. ❌ N8N has full access to your Google account
6. ❌ Can't track usage/costs per tenant

---

## Solution: Use External APIs Proxy

**Architecture:**

```
N8N Workflow (No Credentials)
    ↓
    HTTP Request to Proxy
    Authorization: Bearer N8N_WEBHOOK_SECRET
    ↓
Your Platform's External API Proxy
    ↓
    Fetches encrypted OAuth token from database
    Decrypts in memory
    ↓
Google Sheets API
    (with tenant's OAuth token)
```

**Benefits:**

- ✅ OAuth tokens encrypted in database
- ✅ Credentials never visible in N8N
- ✅ Per-tenant token isolation
- ✅ Audit trail of all API calls
- ✅ Easy credential rotation
- ✅ Usage tracking and cost monitoring
- ✅ Auto token refresh (when implemented)

---

## Migration Steps

### Step 1: Configure Google Sheets in External APIs (Platform Admin)

**Already implemented!** The External APIs tab supports OAuth2 authentication.

1. Log in as platform admin
2. Go to **Integration Management → External APIs**
3. Click **"Add New API"**
4. Fill in:
   - **Service Name:** `google_sheets` (used in URL)
   - **Display Name:** `Google Sheets API`
   - **Base URL:** `https://sheets.googleapis.com/v4`
   - **Auth Type:** `oauth2`
   - **Description:** `Google Sheets API for reading/writing spreadsheet data`

5. OAuth2 Credentials:
   - **Access Token:** Paste your Google OAuth access token
   - (In future: we'll add OAuth flow to get this automatically)

6. Click **Save**

**Result:** You'll get two proxy URLs:

**Static URL (single tenant):**

```
https://embellics-app.onrender.com/api/proxy/YOUR_TENANT_ID/http/google_sheets/spreadsheets/SPREADSHEET_ID/values/Sheet1
```

**Dynamic URL (multi-tenant):**

```
https://embellics-app.onrender.com/api/proxy/{{ tenantId }}/http/google_sheets/{{ endpoint }}
```

---

### Step 2: Update N8N Workflows

**Before (Direct Google Sheets node):**

```
┌─────────────────────────────┐
│ Google Sheets Node          │
│ - Uses OAuth2 credential    │
│ - Action: Read rows         │
│ - Spreadsheet ID: xxx       │
│ - Range: Sheet1!A1:Z100     │
└─────────────────────────────┘
```

**After (HTTP Request via Proxy):**

```
┌─────────────────────────────┐
│ HTTP Request Node           │
│ - Method: GET               │
│ - URL: Proxy endpoint       │
│ - Auth: Bearer N8N secret   │
│ - No OAuth needed!          │
└─────────────────────────────┘
```

**Example N8N HTTP Request Configuration:**

**Read Spreadsheet Values:**

```javascript
Method: GET
URL: https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/http/google_sheets/spreadsheets/{{ $json.spreadsheetId }}/values/{{ $json.range }}

Headers:
  Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET

// Response will be the same as Google Sheets API
```

**Write Spreadsheet Values:**

```javascript
Method: PUT
URL: https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/http/google_sheets/spreadsheets/{{ $json.spreadsheetId }}/values/{{ $json.range }}?valueInputOption=RAW

Headers:
  Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
  Content-Type: application/json

Body:
{
  "values": [
    ["Name", "Email", "Phone"],
    ["John Doe", "john@example.com", "555-1234"]
  ]
}
```

**Create Spreadsheet:**

```javascript
Method: POST
URL: https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/http/google_sheets/spreadsheets

Headers:
  Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET
  Content-Type: application/json

Body:
{
  "properties": {
    "title": "New Spreadsheet"
  }
}
```

---

### Step 3: Test the Proxy

**Using curl (for testing):**

```bash
# Test reading a spreadsheet
curl -X GET \
  'https://embellics-app.onrender.com/api/proxy/YOUR_TENANT_ID/http/google_sheets/spreadsheets/SPREADSHEET_ID/values/Sheet1!A1:Z10' \
  -H 'Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET'

# Expected response:
{
  "range": "Sheet1!A1:Z10",
  "majorDimension": "ROWS",
  "values": [
    ["Header1", "Header2", "Header3"],
    ["Value1", "Value2", "Value3"]
  ]
}
```

---

### Step 4: Remove Google Sheets OAuth from N8N

Once you've confirmed the proxy works:

1. In N8N, go to **Credentials**
2. Find **Google Sheets OAuth2 API**
3. Click **Delete**
4. Update all workflows to use HTTP Request nodes instead

---

## How to Get Google OAuth Access Token

**Option 1: Use Google OAuth Playground (Quick)**

1. Go to https://developers.google.com/oauthplayground/
2. Select **Google Sheets API v4**
3. Check required scopes:
   - `https://www.googleapis.com/auth/spreadsheets` (read/write)
   - `https://www.googleapis.com/auth/spreadsheets.readonly` (read only)
4. Click **Authorize APIs**
5. Sign in with Google
6. Click **Exchange authorization code for tokens**
7. Copy the `access_token`
8. Paste it into External APIs configuration

**Limitation:** Access tokens from OAuth Playground expire after 1 hour.

---

**Option 2: Create Google Cloud Service Account (Recommended)**

For long-term access without manual token refresh:

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable **Google Sheets API**
4. Go to **IAM & Admin → Service Accounts**
5. Click **Create Service Account**
6. Fill in details:
   - Name: `n8n-sheets-proxy`
   - Description: `Service account for N8N workflows via proxy`
7. Click **Create and Continue**
8. Grant role: **Editor** (or custom role)
9. Click **Done**
10. Click on the service account
11. Go to **Keys** tab
12. Click **Add Key → Create New Key**
13. Choose **JSON**
14. Download the key file

**Then, exchange service account for access token:**

```bash
# Install google-auth-library
npm install google-auth-library

# Node.js script to get access token
const { GoogleAuth } = require('google-auth-library');

async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: './path-to-service-account.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  console.log('Access Token:', accessToken.token);
}

getAccessToken();
```

**Benefits:**

- ✅ Tokens automatically refresh
- ✅ No manual intervention needed
- ✅ More secure (limited scope)

---

**Option 3: Implement OAuth Flow in Platform (Future Enhancement)**

**What we need to add:**

1. **OAuth Authorization Endpoint:**

   ```typescript
   app.get(
     '/api/platform/tenants/:tenantId/external-apis/:apiId/authorize',
     requireAuth,
     async (req, res) => {
       // Redirect to Google OAuth consent screen
       const authUrl =
         `https://accounts.google.com/o/oauth2/v2/auth?` +
         `client_id=${apiConfig.credentials.clientId}&` +
         `redirect_uri=${APP_URL}/api/external-apis/callback&` +
         `scope=https://www.googleapis.com/auth/spreadsheets&` +
         `response_type=code&` +
         `state=${tenantId}-${apiId}`;

       res.redirect(authUrl);
     },
   );
   ```

2. **OAuth Callback Endpoint:**

   ```typescript
   app.get('/api/external-apis/callback', async (req, res) => {
     const { code, state } = req.query;
     const [tenantId, apiId] = state.split('-');

     // Exchange code for access token
     const tokens = await exchangeCodeForTokens(code);

     // Update API config with encrypted tokens
     await storage.updateExternalApiConfig(apiId, {
       credentials: {
         ...existingCredentials,
         accessToken: encrypt(tokens.access_token),
         refreshToken: encrypt(tokens.refresh_token),
         expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
       },
     });

     res.redirect('/?oauth_success=google_sheets');
   });
   ```

3. **Auto Token Refresh:**

   ```typescript
   async function getExternalApiAccessToken(apiConfig) {
     // Check if token expired
     if (apiConfig.credentials.expiresAt < new Date()) {
       // Refresh token
       const newTokens = await refreshAccessToken(apiConfig.credentials.refreshToken);

       // Update in database
       await storage.updateExternalApiConfig(apiConfig.id, {
         credentials: {
           ...apiConfig.credentials,
           accessToken: encrypt(newTokens.access_token),
           expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
         },
       });

       return newTokens.access_token;
     }

     return decrypt(apiConfig.credentials.accessToken);
   }
   ```

**This would allow:**

- ✅ One-click "Connect Google Sheets" button in UI
- ✅ Automatic token refresh (tokens last ~1 hour, refresh tokens last forever)
- ✅ No manual token management

---

## Current External API Proxy Implementation

**Already working!** Here's what we have:

```typescript
// From server/routes.ts (lines ~6240-6340)
app.post(
  '/api/proxy/:tenantId/http/:serviceName/:endpoint(*)',
  validateN8NSecret,
  async (req: Request, res: Response) => {
    const { tenantId, serviceName, endpoint } = req.params;

    // Get API config from database
    const apiConfig = await storage.getExternalApiConfig(tenantId, serviceName);

    if (!apiConfig || !apiConfig.isActive) {
      return res.status(404).json({ error: 'API configuration not found' });
    }

    // Build full URL
    const fullUrl = `${apiConfig.baseUrl}/${endpoint}`;

    // Add authentication based on auth type
    const headers: any = { ...req.headers };
    delete headers.host;
    delete headers.authorization; // Remove N8N auth

    if (apiConfig.authType === 'oauth2') {
      // Decrypt and use OAuth2 access token
      const accessToken = decrypt(apiConfig.credentials.accessToken);
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    // ... other auth types

    // Proxy the request to external API
    const response = await fetch(fullUrl, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    // Return response to N8N
    const data = await response.json();
    res.status(response.status).json(data);
  },
);
```

**Supported Auth Types:**

- ✅ `bearer` - Bearer token
- ✅ `api_key` - API key in custom header
- ✅ `basic` - Basic auth (username:password)
- ✅ `oauth2` - OAuth2 access token ← **Use this for Google Sheets**
- ✅ `custom_header` - Any custom header
- ✅ `none` - No authentication

---

## Testing Checklist

- [ ] Configure Google Sheets in External APIs tab
- [ ] Get OAuth access token (using one of 3 methods above)
- [ ] Save encrypted token in platform
- [ ] Test proxy with curl
- [ ] Update one N8N workflow to use proxy
- [ ] Verify data is read/written correctly
- [ ] Monitor proxy logs for errors
- [ ] Update remaining workflows
- [ ] Delete Google Sheets OAuth from N8N
- [ ] Celebrate! 🎉

---

## N8N Workflow Examples

### Example 1: Read Contact from Google Sheets

**Before (Google Sheets node):**

```json
{
  "nodes": [
    {
      "name": "Get Contacts",
      "type": "n8n-nodes-base.googleSheets",
      "credentials": {
        "googleSheetsOAuth2Api": "Google Sheets OAuth2 API"
      },
      "parameters": {
        "operation": "read",
        "sheetId": "1ABC123...",
        "range": "Contacts!A2:D100"
      }
    }
  ]
}
```

**After (HTTP Request via proxy):**

```json
{
  "nodes": [
    {
      "name": "Get Contacts",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/http/google_sheets/spreadsheets/1ABC123.../values/Contacts!A2:D100",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "httpHeaderAuth": {
          "name": "Authorization",
          "value": "Bearer YOUR_N8N_WEBHOOK_SECRET"
        },
        "options": {
          "response": {
            "response": {
              "fullResponse": false
            }
          }
        }
      }
    },
    {
      "name": "Transform Data",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// Google Sheets API returns data in 'values' array\nconst rows = $input.item.json.values;\n\n// Convert to objects\nconst headers = rows[0];\nconst data = rows.slice(1).map(row => {\n  const obj = {};\n  headers.forEach((header, i) => {\n    obj[header] = row[i];\n  });\n  return obj;\n});\n\nreturn data;"
      }
    }
  ]
}
```

### Example 2: Write to Google Sheets

**After (HTTP Request via proxy):**

```json
{
  "nodes": [
    {
      "name": "Append to Sheet",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://embellics-app.onrender.com/api/proxy/{{ $json.tenantId }}/http/google_sheets/spreadsheets/1ABC123.../values/Leads!A1:append?valueInputOption=RAW",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "httpHeaderAuth": {
          "name": "Authorization",
          "value": "Bearer YOUR_N8N_WEBHOOK_SECRET"
        },
        "sendBody": true,
        "bodyContentType": "json",
        "body": {
          "values": [["{{ $json.name }}", "{{ $json.email }}", "{{ $json.phone }}", "{{ $now }}"]]
        }
      }
    }
  ]
}
```

---

## Future Enhancements

### Phase 1: Token Management (High Priority)

- [ ] Add OAuth flow UI in External APIs tab
- [ ] "Connect Google Sheets" button → OAuth consent → auto-store token
- [ ] Automatic token refresh before expiry
- [ ] Token expiry warnings in UI

### Phase 2: Multi-Tenant Google Sheets (Medium Priority)

- [ ] Allow each tenant to connect their own Google account
- [ ] Per-tenant Google Sheets configurations
- [ ] Tenant can revoke access anytime

### Phase 3: Usage Tracking (Low Priority)

- [ ] Track API calls per tenant
- [ ] Monitor rate limits
- [ ] Cost estimation (if applicable)
- [ ] Alert on quota limits

---

## Estimated Timeline

| Task                          | Time          | Complexity |
| ----------------------------- | ------------- | ---------- |
| Configure Google Sheets in UI | 10 min        | Easy       |
| Get OAuth access token        | 30 min        | Medium     |
| Test proxy with curl          | 15 min        | Easy       |
| Update 1 N8N workflow         | 30 min        | Medium     |
| Update all workflows          | 2-4 hours     | Medium     |
| Delete N8N credentials        | 5 min         | Easy       |
| **Total**                     | **3-5 hours** | **Medium** |

---

## Documentation Links

**Google Sheets API:**

- https://developers.google.com/sheets/api/reference/rest
- https://developers.google.com/sheets/api/guides/values

**OAuth 2.0:**

- https://developers.google.com/identity/protocols/oauth2
- https://developers.google.com/oauthplayground/

**Our Implementation:**

- External APIs tab: `client/src/components/IntegrationManagement.tsx`
- Proxy endpoint: `server/routes.ts` (line ~6240)
- Database schema: `shared/schema.ts` (externalApiConfigs table)

---

## Support

If you run into issues:

1. Check proxy logs in Render dashboard
2. Verify N8N_WEBHOOK_SECRET matches
3. Test with curl first before updating workflows
4. Check Google Sheets API quotas (10,000 requests per 100 seconds)

---

**Ready to migrate? Let's do it! 🚀**
