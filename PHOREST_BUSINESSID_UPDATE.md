# Phorest API Update - Required Changes

## Summary

The Phorest client creation endpoint now requires `businessId` to be passed in the request payload instead of being automatically fetched from the database.

## Changes Needed

### 1. Update `server/routes/phorest.routes.ts`

**Schema Update:**

```typescript
const createClientSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  businessId: z.string().min(1, 'Business ID is required'), // ADD THIS LINE
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  mobile: z.string().min(1, 'Mobile number is required'),
  email: z.string().email('Invalid email format'),
});
```

**Request Handling Update:**

```typescript
const { tenantId, businessId, firstName, lastName, mobile, email } = validationResult.data; // ADD businessId

console.log('[Phorest API] Creating client:', {
  tenantId,
  businessId, // ADD THIS LINE
  firstName,
  lastName,
  email,
});

const client = await phorestService.createClient({
  tenantId,
  businessId, // ADD THIS LINE
  firstName,
  lastName,
  mobile,
  email,
});
```

### 2. Update `server/services/phorest/index.ts`

**Method Signature Update:**

```typescript
// CHANGE THIS:
async createClient(
  request: Omit<CreateClientRequest, 'tenantId' | 'businessId'> & { tenantId: string },
): Promise<CreateClientResponse>

// TO THIS:
async createClient(
  request: CreateClientRequest,
): Promise<CreateClientResponse>
```

**Remove Automatic BusinessId Fetching:**

```typescript
// DELETE THESE LINES (around line 139-151):
const sanitizedRequest = {
  tenantId: sanitizeInput(request.tenantId),
  // DELETE: businessId fetch
  firstName: sanitizeInput(request.firstName),
  // ...
};

// Step 1: Get tenant's business ID (automatic population)
const business = await this.getTenantBusiness(sanitizedRequest.tenantId);
const businessId = business.businessId;

logServiceActivity('info', 'Business ID retrieved', {
  businessId,
  businessName: business.businessName,
});
```

**Add businessId to Sanitization:**

```typescript
const sanitizedRequest = {
  tenantId: sanitizeInput(request.tenantId),
  businessId: sanitizeInput(request.businessId), // ADD THIS LINE
  firstName: sanitizeInput(request.firstName),
  lastName: sanitizeInput(request.lastName),
  mobile: sanitizeInput(request.mobile),
  email: sanitizeInput(request.email),
};
```

**Update Logging:**

```typescript
logServiceActivity('info', 'Creating Phorest client', {
  tenantId: sanitizedRequest.tenantId,
  businessId: sanitizedRequest.businessId, // ADD THIS LINE
  firstName: sanitizedRequest.firstName,
  lastName: sanitizedRequest.lastName,
  email: sanitizedRequest.email,
});
```

**Update API URL Building:**

```typescript
// CHANGE THIS:
const apiUrl = buildPhorestApiUrl(config.baseUrl, sanitizedRequest.tenantId, businessId);

// TO THIS:
const apiUrl = buildPhorestApiUrl(
  config.baseUrl,
  sanitizedRequest.tenantId,
  sanitizedRequest.businessId,
);
```

## Retell AI Configuration

### JSON Schema for `create-phorest-client` Tool

```json
{
  "type": "object",
  "properties": {
    "tenantId": {
      "type": "string",
      "description": "The tenant ID from get-tenant-details response"
    },
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
  "required": ["tenantId", "businessId", "firstName", "lastName", "mobile", "email"]
}
```

### Example Values for SWC

```json
{
  "tenantId": "your-tenant-id-here",
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
  "tenantId": "your-tenant-id-here",
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

## Documentation Updated

✅ `/docs/API/PHOREST_API_DOCUMENTATION.md` - Updated to show businessId as required
✅ `/docs/API/RETELL_TENANT_LOOKUP_INTEGRATION.md` - Updated JSON schema with businessId

## Files to Manually Update

⏳ `server/routes/phorest.routes.ts` - Add businessId to schema and request handling
⏳ `server/services/phorest/index.ts` - Remove auto-fetch, accept businessId in request
