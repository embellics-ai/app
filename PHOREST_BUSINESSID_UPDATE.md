# Phorest API Update - businessId Only

## Summary

The Phorest client creation endpoint has been updated to only require `businessId` in the request payload. The `tenantId` is automatically resolved from the `businessId` by looking it up in the `tenant_businesses` table.

## Key Changes

### API Request Format

**OLD (with tenantId):**

```json
{
  "tenantId": "your-tenant-id",
  "businessId": "your-business-id",
  "firstName": "John",
  "lastName": "Doe",
  "mobile": "0871234567",
  "email": "john@example.com"
}
```

**NEW (businessId only):**

```json
{
  "businessId": "your-business-id",
  "firstName": "John",
  "lastName": "Doe",
  "mobile": "0871234567",
  "email": "john@example.com"
}
```

## Implementation Details

### 1. Route Schema (`server/routes/phorest.routes.ts`)

```typescript
const createClientSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  mobile: z.string().min(1, 'Mobile number is required'),
  email: z.string().email('Invalid email format'),
});
```

### 2. Type Definition (`server/services/phorest/types.ts`)

```typescript
export interface CreateClientRequest {
  businessId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
}
```

### 3. Service Implementation (`server/services/phorest/index.ts`)

**New Method - Lookup Tenant from Business ID:**

```typescript
private async getTenantIdFromBusinessId(businessId: string): Promise<string> {
  const businesses = await this.db
    .select()
    .from(tenantBusinesses)
    .where(
      and(
        eq(tenantBusinesses.businessId, businessId),
        eq(tenantBusinesses.serviceName, 'phorest_api'),
      ),
    );

  if (!businesses || businesses.length === 0) {
    throw new PhorestConfigError('Business ID not found in system', { businessId });
  }

  return businesses[0].tenantId;
}
```

**Updated createClient Method:**
tenantId: sanitizedRequest.tenantId,
businessId: sanitizedRequest.businessId, // ADD THIS LINE
firstName: sanitizedRequest.firstName,
lastName: sanitizedRequest.lastName,
email: sanitizedRequest.email,
});

````

**Update API URL Building:**

```typescript
// CHANGE THIS:
const apiUrl = buildPhorestApiUrl(config.baseUrl, sanitizedRequest.tenantId, businessId);

// TO THIS:
```typescript
async createClient(request: CreateClientRequest): Promise<CreateClientResponse> {
  // Step 1: Lookup tenant ID from business ID
  const tenantId = await this.getTenantIdFromBusinessId(sanitizedRequest.businessId);

  // Step 2: Get Phorest API configuration using the resolved tenantId
  const config = await this.getPhorestConfig(tenantId);

  // Step 3: Build API URL (still needs tenantId for URL structure)
  const apiUrl = buildPhorestApiUrl(config.baseUrl, tenantId, sanitizedRequest.businessId);

  // Rest of implementation...
}
````

## Retell AI Configuration

### JSON Schema for `create-phorest-client` Tool

```json
{
  "type": "object",
  "properties": {
    "businessId": {
      "type": "string",
      "description": "The Phorest business ID from tenant.businesses[0].businessId"
    },
    "firstName": {
      "type": "string",
      "description": "Customer's first name"
    },
    "lastName": {
      "type": "string",
      "description": "Customer's last name"
    },
    "mobile": {
      "type": "string",
      "description": "Customer's mobile phone number"
    },
    "email": {
      "type": "string",
      "description": "Customer's email address"
    }
  },
  "required": ["businessId", "firstName", "lastName", "mobile", "email"]
}
```

### Example Request

```json
{
  "businessId": "your-phorest-business-id",
  "firstName": "John",
  "lastName": "Doe",
  "mobile": "0851234567",
  "email": "john@example.com"
}
```

## Testing

After making these changes, test with Postman:

```bash
POST https://embellics-app.onrender.com/api/phorest/clients
Content-Type: application/json

{
  "businessId": "your-phorest-business-id",
  "firstName": "Test",
  "lastName": "User",
  "mobile": "0851234567",
  "email": "test@example.com"
}
```

Expected Response:

```json
{
  "success": true,
  "client": {
    "clientId": "...",
    "firstName": "Test",
    "lastName": "User",
    "mobile": "+353851234567",
    "email": "test@example.com",
    "createdAt": "2025-12-24T..."
  }
}
```

## Files Updated

✅ `server/routes/phorest.routes.ts` - Removed tenantId from schema
✅ `server/services/phorest/types.ts` - Removed tenantId from interface
✅ `server/services/phorest/index.ts` - Added tenant lookup from businessId
✅ `/docs/API/PHOREST_API_DOCUMENTATION.md` - Updated to show only businessId required
✅ `/docs/API/RETELL_TENANT_LOOKUP_INTEGRATION.md` - Updated JSON schema without tenantId
