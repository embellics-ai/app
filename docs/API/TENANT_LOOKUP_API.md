# Tenant Lookup API

## Overview

The Tenant Lookup API provides a public endpoint for external integrations (Retell AI agents, voice systems, future services) to resolve tenant information dynamically without requiring authentication.

This endpoint is service-agnostic and can be used by any integration that needs to find a tenant's ID and associated business details.

---

## Endpoint

### GET `/api/tenants/lookup`

Look up tenant details by business name or email.

**Base URL:** `https://your-domain.com/api/tenants/lookup`

**Method:** `GET`

**Authentication:** None required (public endpoint)

**Query Parameters:**

| Parameter | Type   | Required | Description                             |
| --------- | ------ | -------- | --------------------------------------- |
| `name`    | string | No\*     | Tenant/business name (case-insensitive) |
| `email`   | string | No\*     | Tenant email address                    |

\*At least one parameter is required

---

## Examples

### Lookup by Name

```bash
GET /api/tenants/lookup?name=SWC
```

**Response (200 OK):**

```json
{
  "success": true,
  "tenant": {
    "tenantId": "clx123abc456",
    "tenantName": "SWC",
    "tenantEmail": "contact@swc.ie",
    "businesses": [
      {
        "serviceName": "phorest",
        "businessId": "12345",
        "businessName": "SWC Salon",
        "branches": [
          {
            "branchId": "branch_1",
            "branchName": "Main Location",
            "isPrimary": true,
            "isActive": true
          }
        ]
      }
    ]
  }
}
```

### Lookup by Email

```bash
GET /api/tenants/lookup?email=contact@swc.ie
```

**Response:** Same structure as above

---

## Error Responses

### 400 - Missing Parameter

```json
{
  "success": false,
  "error": "Missing required parameter",
  "message": "Provide either ?name=TenantName or ?email=tenant@example.com"
}
```

### 404 - Tenant Not Found

```json
{
  "success": false,
  "error": "Tenant not found",
  "message": "No tenant found with name: SWC"
}
```

### 500 - Server Error

```json
{
  "success": false,
  "error": "Failed to lookup tenant",
  "message": "Error details here"
}
```

---

## Use Cases

### 1. Retell AI Voice Agent

When a customer calls and mentions their business name, the voice agent can look up the tenant ID:

```javascript
// In Retell AI function configuration
{
  "name": "lookup_tenant",
  "url": "https://your-domain.com/api/tenants/lookup",
  "method": "GET",
  "parameters": {
    "name": "{{businessName}}" // From conversation
  }
}
```

Then use the returned `tenantId` for subsequent operations (e.g., creating Phorest clients).

### 2. JavaScript/Fetch

```javascript
const lookupTenant = async (businessName) => {
  const response = await fetch(
    `https://your-domain.com/api/tenants/lookup?name=${encodeURIComponent(businessName)}`,
  );

  const result = await response.json();

  if (result.success) {
    console.log('Tenant ID:', result.tenant.tenantId);
    console.log('Businesses:', result.tenant.businesses);
    return result.tenant;
  } else {
    console.error('Tenant not found:', result.message);
    throw new Error(result.message);
  }
};

// Usage
const tenant = await lookupTenant('SWC');
```

### 3. cURL

```bash
# By name
curl "https://your-domain.com/api/tenants/lookup?name=SWC"

# By email
curl "https://your-domain.com/api/tenants/lookup?email=contact@swc.ie"
```

---

## Response Fields

### Tenant Object

| Field         | Type   | Description                                       |
| ------------- | ------ | ------------------------------------------------- |
| `tenantId`    | string | Unique tenant identifier (use this for API calls) |
| `tenantName`  | string | Display name of the tenant                        |
| `tenantEmail` | string | Contact email for the tenant                      |
| `businesses`  | array  | List of businesses associated with this tenant    |

### Business Object

| Field          | Type   | Description                                    |
| -------------- | ------ | ---------------------------------------------- |
| `serviceName`  | string | Service type (e.g., "phorest", "fresha", etc.) |
| `businessId`   | string | Business identifier in the external service    |
| `businessName` | string | Display name of the business                   |
| `branches`     | array  | List of branches/locations for this business   |

### Branch Object

| Field        | Type    | Description                               |
| ------------ | ------- | ----------------------------------------- |
| `branchId`   | string  | Branch identifier                         |
| `branchName` | string  | Display name of the branch                |
| `isPrimary`  | boolean | Whether this is the main/primary location |
| `isActive`   | boolean | Whether this branch is currently active   |

---

## Integration Workflow

### Example: Voice Agent → Phorest Integration

**Step 1:** Customer says: "I'm calling from SWC Salon"

**Step 2:** Voice agent looks up tenant:

```
GET /api/tenants/lookup?name=SWC
→ Returns tenantId: "clx123abc456"
```

**Step 3:** Customer provides contact details

**Step 4:** Voice agent creates Phorest client:

```
POST /api/phorest/clients
Body: {
  "tenantId": "clx123abc456",
  "firstName": "John",
  "lastName": "Doe",
  "mobile": "0871234567",
  "email": "john@example.com"
}
```

---

## Security Considerations

### Why is this endpoint public?

1. **External Integrations**: Voice agents (Retell AI) and other external systems don't have user authentication
2. **Service-Agnostic**: Different integrations (Phorest, Fresha, future services) all need tenant lookup
3. **Limited Information**: Only returns non-sensitive business information
4. **Read-Only**: Cannot modify tenant data

### What data is NOT exposed?

- API keys and credentials
- Payment information
- Internal configuration details
- User passwords or tokens
- Sensitive business metrics

### Alternative: API Key Authentication (Future)

If you want to restrict access later, you can add an API key requirement:

```typescript
// Add API key middleware
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.INTEGRATION_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// Apply to route
router.get('/lookup', requireApiKey, async (req, res) => { ... });
```

---

## Comparison with Other Endpoints

| Endpoint                 | Purpose                     | Auth Required    | Use Case                 |
| ------------------------ | --------------------------- | ---------------- | ------------------------ |
| `/api/proxy/lookup`      | N8N-specific tenant lookup  | Yes (N8N secret) | n8n workflows only       |
| `/api/tenants/lookup`    | **Universal tenant lookup** | No               | Any external integration |
| `/api/tenants/:tenantId` | Get specific tenant details | Yes (JWT)        | Authenticated users      |

**Recommendation:** Use `/api/tenants/lookup` for all new integrations. The proxy endpoint will be deprecated when n8n is removed.

---

## Testing

### Local Testing with LocalTunnel

```bash
# Terminal 1: Start your server
npm run dev

# Terminal 2: Create tunnel
lt --port 3000

# Terminal 3: Test the endpoint
curl "https://your-tunnel-url.loca.lt/api/tenants/lookup?name=SWC"
```

### Production Testing

```bash
curl "https://your-production-domain.com/api/tenants/lookup?name=SWC"
```

---

## Related Documentation

- [Phorest API Integration](./PHOREST_API_DOCUMENTATION.md)
- [N8N Webhook Routing](./N8N_WEBHOOK_ROUTING_IMPLEMENTATION.md)
- [Retell Proxy API Guide](./RETELL_PROXY_API_GUIDE.md)

---

**Created:** December 24, 2025  
**Status:** ✅ Active  
**Location:** `/api/tenants/lookup`  
**Authentication:** Public (no auth required)
