# Credential Management: Before vs After

## ❌ BEFORE: Hardcoded Credentials (Security Risk)

```
┌─────────────────────────────────────────────────────────────┐
│                     N8N WORKFLOW                             │
│                                                              │
│  Node: Create-New-Chat                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │ URL: https://api.retellai.com/create-chat          │    │
│  │                                                     │    │
│  │ Headers:                                           │    │
│  │   Authorization: Bearer key_93f64256e7e3591f...   │◄───┼─── HARDCODED!
│  │                         ▲                          │    │     Exposed if N8N
│  │                         │                          │    │     is compromised
│  │                         │                          │    │
│  │                    SECURITY RISK                   │    │
│  │                    - Visible in UI                 │    │
│  │                    - Stored in workflow            │    │
│  │                    - Not encrypted                 │    │
│  │                    - Same for all tenants          │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │  Retell AI API │
                  └────────────────┘
```

**Problems:**

- ❌ API key visible in N8N workflow configuration
- ❌ Anyone with N8N access sees the key
- ❌ Database breach of N8N exposes all keys
- ❌ Manual updates needed in all workflows
- ❌ No multi-tenant support
- ❌ No encryption
- ❌ No audit trail

## ✅ AFTER: Proxy Pattern (Secure)

```
┌─────────────────────────────────────────────────────────────┐
│                     N8N WORKFLOW                             │
│                                                              │
│  Node: Create-New-Chat                                      │
│  ┌────────────────────────────────────────────────────┐    │
│  │ URL: https://your-platform.com/api/proxy/          │    │
│  │      {{ tenantId }}/retell/create-chat             │    │
│  │                                                     │    │
│  │ Headers:                                           │    │
│  │   Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}│◄───┼─── Environment Variable
│  │                                ▲                   │    │     (Single shared secret)
│  │                                │                   │    │
│  │                         SECURE (env var)           │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           │ POST with N8N secret
                           ▼
        ┌──────────────────────────────────────────┐
        │        YOUR PLATFORM (PROXY)             │
        │                                          │
        │  1. Validate N8N_WEBHOOK_SECRET         │
        │  2. Extract tenantId from URL           │
        │  3. Query database for tenant's         │
        │     Retell API key                      │
        │  4. Decrypt API key                     │
        │  5. Call Retell AI with decrypted key   │
        │                                          │
        │  ┌────────────────────────────────┐    │
        │  │      DATABASE                  │    │
        │  │  ┌──────────────────────────┐  │    │
        │  │  │ widget_configs           │  │    │
        │  │  │                          │  │    │
        │  │  │ tenant_id: SWC-Bhukkha  │  │    │
        │  │  │ retell_api_key:         │  │    │
        │  │  │   "ENCRYPTED_KEY_DATA"  │◄─┼────┼── Encrypted at rest
        │  │  │                          │  │    │    AES-256-GCM
        │  │  └──────────────────────────┘  │    │
        │  └────────────────────────────────┘    │
        └──────────────────┼───────────────────────┘
                           │
                           │ POST with decrypted API key
                           ▼
                  ┌────────────────┐
                  │  Retell AI API │
                  └────────────────┘
```

**Benefits:**

- ✅ No API keys in N8N workflow
- ✅ Only shared N8N secret needed
- ✅ API keys encrypted in database
- ✅ Multi-tenant support (automatic routing)
- ✅ Centralized credential management
- ✅ Audit trail of all API calls
- ✅ Update keys without touching N8N

## Comparison Table

| Aspect                    | Before (Hardcoded)   | After (Proxy)           |
| ------------------------- | -------------------- | ----------------------- |
| **Credential Location**   | N8N Workflow         | Encrypted Database      |
| **Encryption**            | None                 | AES-256-GCM             |
| **N8N Access Level**      | Sees actual API keys | Sees only N8N secret    |
| **Security Risk**         | High (plaintext)     | Low (encrypted)         |
| **Multi-Tenant**          | No (single key)      | Yes (per tenant)        |
| **Key Rotation**          | Update all workflows | Update in database only |
| **Audit Trail**           | None                 | All calls logged        |
| **Breach Impact**         | All keys exposed     | Only N8N secret exposed |
| **Credential Management** | Manual in N8N        | UI-based in platform    |

## Multi-Tenant Comparison

### Before (Single Shared Key)

```
N8N Workflow → Retell AI (key_93f64256...)
                  │
                  ├─ Used for Tenant A
                  ├─ Used for Tenant B
                  └─ Used for Tenant C

Problem: All tenants use the same Retell account!
```

### After (Tenant-Specific Keys)

```
N8N Workflow → Platform Proxy
                  │
                  ├─ Tenant A → key_aaaa1111 (encrypted)
                  ├─ Tenant B → key_bbbb2222 (encrypted)
                  └─ Tenant C → key_cccc3333 (encrypted)

Solution: Each tenant has their own Retell account!
```

## Authentication Flow Comparison

### Before: Direct API Call

```
┌─────┐                                    ┌──────────┐
│ N8N │───────────────────────────────────▶│ Retell   │
└─────┘                                    │ AI API   │
        Authorization: Bearer key_93f...   └──────────┘
                   ▲
                   │
              EXPOSED IN N8N
              - Visible in UI
              - Stored in workflow JSON
              - No encryption
```

### After: Proxy Authentication

```
┌─────┐              ┌──────────┐              ┌──────────┐
│ N8N │─────────────▶│ Platform │─────────────▶│ Retell   │
└─────┘              │  Proxy   │              │ AI API   │
        Bearer        └──────────┘              └──────────┘
        {{$env.       ▲          │               Bearer
        N8N_          │          │               key_93f...
        WEBHOOK_      │          ▼               (decrypted)
        SECRET}}      │     ┌─────────┐
                      │     │Database │
        SECURE        │     │Encrypted│
        - Env var     │     └─────────┘
        - Not in      │
          workflow    │
                      └─── Fetch & Decrypt
```

## What's Stored Where

### Before

| Location              | What's Stored                      | Security Level |
| --------------------- | ---------------------------------- | -------------- |
| N8N Workflow          | `key_93f64256e7e3591f07e71d3cbb9b` | ❌ Plaintext   |
| Database              | Nothing                            | N/A            |
| Environment Variables | Nothing                            | N/A            |

### After

| Location             | What's Stored                | Security Level                |
| -------------------- | ---------------------------- | ----------------------------- |
| N8N Workflow         | Nothing                      | ✅ No credentials             |
| N8N Environment      | `N8N_WEBHOOK_SECRET`         | ⚠️ Shared secret (acceptable) |
| Database             | `retell_api_key` (encrypted) | ✅ AES-256-GCM encrypted      |
| Platform Environment | `ENCRYPTION_KEY`             | ✅ Secure (for decryption)    |
| Platform Environment | `N8N_WEBHOOK_SECRET`         | ✅ Secure (for validation)    |

## Migration Path

```
CURRENT STATE (Insecure)
  │
  │ 1. Add Retell API keys to platform database (encrypted)
  ▼
PLATFORM HAS KEYS
  │
  │ 2. Deploy proxy endpoints to platform
  ▼
PROXY AVAILABLE
  │
  │ 3. Configure N8N_WEBHOOK_SECRET in N8N
  ▼
N8N CONFIGURED
  │
  │ 4. Update N8N workflow to use proxy
  ▼
USING PROXY (both work)
  │
  │ 5. Test proxy endpoints
  ▼
PROXY TESTED
  │
  │ 6. Remove hardcoded keys from N8N
  ▼
SECURE (proxy only)
```

## Real-World Example

### Tenant: SWC-Bhukkha

#### Before

```javascript
// N8N Workflow Configuration (VISIBLE TO EVERYONE)
{
  "name": "Create-New-Chat",
  "type": "httpRequest",
  "parameters": {
    "url": "https://api.retellai.com/create-chat",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "httpHeaderAuth": {
      "name": "Authorization",
      "value": "Bearer key_93f64256e7e3591f07e71d3cbb9b"  ⚠️ EXPOSED!
    }
  }
}
```

#### After

```javascript
// N8N Workflow Configuration (NO CREDENTIALS)
{
  "name": "Create-New-Chat",
  "type": "httpRequest",
  "parameters": {
    "url": "https://embellics-app.onrender.com/api/proxy/{{$('Webhook').item.json.body.tenantId}}/retell/create-chat",
    "authentication": "none",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{$env.N8N_WEBHOOK_SECRET}}"  ✅ SECURE!
        }
      ]
    }
  }
}
```

```sql
-- Platform Database (ENCRYPTED)
-- Table: widget_configs
┌────────────┬──────────────┬──────────────────────────────────────┐
│ tenant_id  │ retell_api_  │ retell_agent_id                      │
│            │ key          │                                      │
├────────────┼──────────────┼──────────────────────────────────────┤
│ SWC-       │ 5a7f8e9d...  │ agent_abc123                         │
│ Bhukkha    │ (encrypted)  │                                      │
└────────────┴──────────────┴──────────────────────────────────────┘
                ▲
                │
           Encrypted using AES-256-GCM
           Decrypted only at runtime
           Never sent to N8N
```

## Summary

### What You Lose

- ❌ Direct access to API keys (was a security risk anyway)
- ❌ Ability to call Retell API directly from N8N (use proxy instead)

### What You Gain

- ✅ **Security:** Encrypted credentials, no exposure in N8N
- ✅ **Multi-tenancy:** Each tenant gets their own API key
- ✅ **Maintainability:** Update keys without touching N8N
- ✅ **Audit trail:** All API calls logged
- ✅ **Compliance:** Credentials never leave your infrastructure
- ✅ **Scalability:** Add new tenants without N8N changes
- ✅ **Consistency:** Same pattern for WhatsApp and Retell

### Net Result

**Your credentials are now enterprise-grade secure!** 🔒
