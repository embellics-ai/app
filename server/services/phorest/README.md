# Phorest Service

A comprehensive service layer for integrating with the Phorest API, following best practices for error handling, validation, and maintainability.

## 📁 File Structure

```
server/services/phorest/
├── index.ts        # Main PhorestService class
├── types.ts        # TypeScript interfaces and types
├── errors.ts       # Custom error classes
├── utils.ts        # Helper functions
└── README.md       # This file
```

## 🚀 Features

- **Automatic Credential Retrieval**: Automatically fetches and decrypts Phorest credentials from database
- **Automatic Business ID Population**: Retrieves tenant's business ID automatically
- **Comprehensive Error Handling**: Custom error classes for different failure scenarios
- **Input Validation**: Validates and sanitizes all input data
- **Phone Number Formatting**: Automatically formats phone numbers to Phorest's expected format (+353XXXXXXXXX)
- **Detailed Logging**: Structured logging for debugging and monitoring
- **Type Safety**: Full TypeScript support with proper interfaces and validation

## 📦 Installation

The service is already integrated into the project. No additional installation required.

## 🔧 Usage

### Basic Usage

The service is called via the universal API endpoint `/api/phorest/clients`:

```typescript
import { phorestService } from '../services/phorest';

// Create a client (tenantId, businessId are populated automatically)
const result = await phorestService.createClient({
  tenantId: 'tenant_123',
  firstName: 'John',
  lastName: 'Doe',
  mobile: '+353891234567',
  email: 'john.doe@example.com',
});

console.log('Client created:', result.clientId);
```

### Advanced Usage

```typescript
import { PhorestService } from '../services/phorest';
import { PhorestClientExistsError, PhorestServiceError } from '../services/phorest/errors';

const service = new PhorestService();

try {
  const client = await service.createClient({
    tenantId: 'tenant_123',
    firstName: 'Jane',
    lastName: 'Smith',
    mobile: '0871234567', // Various formats supported
    email: 'jane.smith@example.com',
  });

  console.log('Created client:', client);
} catch (error) {
  if (error instanceof PhorestClientExistsError) {
    console.log('Client already exists');
  } else if (error instanceof PhorestServiceError) {
    console.error('Service error:', error.toJSON());
  }
}
```

## 📋 Prerequisites

Before using the service, ensure the following are configured in the database:

### 1. External API Configuration

The `external_api_configs` table must have a Phorest configuration:

```sql
INSERT INTO external_api_configs (
  tenant_id,
  service_name,
  display_name,
  base_url,
  auth_type,
  encrypted_credentials,
  is_active
) VALUES (
  'your_tenant_id',
  'phorest_api',
  'Phorest API',
  'https://api.phorest.com', -- Your Phorest base URL
  'basic',
  'encrypted_credentials_here',
  true
);
```

**Credentials Format** (before encryption):

```json
{
  "username": "global/your-username",
  "password": "your-api-password"
}
```

### 2. Tenant Business Configuration

The `tenant_businesses` table must have the business ID:

```sql
INSERT INTO tenant_businesses (
  tenant_id,
  service_name,
  business_id,
  business_name
) VALUES (
  'your_tenant_id',
  'phorest_api',
  'your_phorest_business_id',
  'Your Business Name'
);
```

## 🔍 API Reference

### `createClient(request)`

Creates a new client in Phorest.

**Parameters:**

- `request.tenantId` (string, required): Tenant ID
- `request.firstName` (string, required): Client's first name (1-100 chars)
- `request.lastName` (string, required): Client's last name (1-100 chars)
- `request.mobile` (string, required): Mobile phone number (supports multiple formats)
- `request.email` (string, required): Valid email address

**Phone Number Formats Supported:**

- `+353891234567` (International format)
- `353891234567` (Without +)
- `0891234567` (Irish local format)
- `891234567` (9 digits only)

**Returns:**

```typescript
{
  clientId: string;        // Phorest client ID
  firstName: string;
  lastName: string;
  mobile: string;          // Formatted as +353XXXXXXXXX
  email: string;
  createdAt?: string;      // ISO timestamp
}
```

**Throws:**

- `PhorestValidationError` - Invalid input data
- `PhorestConfigError` - Missing or invalid configuration
- `PhorestAuthError` - Authentication failed (401/403)
- `PhorestClientExistsError` - Client already exists (409)
- `PhorestApiError` - Phorest API error
- `PhorestNetworkError` - Network/timeout error
- `PhorestServiceError` - General service error

## ⚠️ Error Handling

All errors extend `PhorestServiceError` and include:

```typescript
{
  name: string;           // Error class name
  message: string;        // Human-readable message
  statusCode: number;     // HTTP status code
  details?: any;          // Additional error details
}
```

### Error Examples

```typescript
// Configuration error
{
  name: 'PhorestConfigError',
  message: 'Phorest API configuration not found for tenant',
  statusCode: 500,
  details: { tenantId: 'tenant_123' }
}

// Validation error
{
  name: 'PhorestValidationError',
  message: 'Invalid phone number format: 123',
  statusCode: 400
}

// Client exists error
{
  name: 'PhorestClientExistsError',
  message: 'Client already exists in Phorest',
  statusCode: 409,
  details: { status: 409, statusText: 'Conflict', data: {...} }
}
```

## 🔐 Security

- **Encrypted Credentials**: All Phorest credentials are stored encrypted (AES-256)
- **Input Sanitization**: All user inputs are sanitized before processing
- **Validation**: Zod schemas validate all data before API calls
- **No Credential Logging**: Passwords are never logged

## 📊 Logging

The service provides structured logging:

```
[2025-12-24T10:30:00.000Z] [Phorest Service] [INFO] Creating Phorest client
{
  "tenantId": "tenant_123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com"
}
```

## 🧪 Testing

To test the service:

1. Ensure database configuration is complete
2. Make a POST request to `/api/phorest/clients` endpoint
3. Check server logs for Phorest client creation
4. Verify client appears in Phorest dashboard

## 🛠️ Troubleshooting

### "Phorest API configuration not found"

- Check `external_api_configs` table has entry for tenant with `service_name='phorest_api'`
- Verify `is_active=true`

### "Phorest business not configured for tenant"

- Check `tenant_businesses` table has entry for tenant with `service_name='phorest_api'`

### "Phorest API authentication failed"

- Verify credentials in `external_api_configs.encrypted_credentials`
- Ensure username format is `global/username`
- Check password is API password (not login password)

### "Client already exists in Phorest"

- This is expected for returning customers
- The error returns HTTP 409 status code
- Calling application can handle gracefully (client already registered)

### "Invalid phone number format"

- Ensure phone number is Irish format
- Service accepts: +353XXXXXXXXX, 0XXXXXXXXX, or XXXXXXXXX (9 digits)

## 🔄 Integration Points

### Universal API Endpoint (`server/routes/phorest.routes.ts`)

The service is exposed via a universal REST API endpoint:

**Endpoint:** `POST /api/phorest/clients`

**Used by:**

- Widget chat (for contact form submissions)
- Voice calls (Retell webhooks)
- WhatsApp integration (n8n workflows)
- Any other communication channel

### Flow Diagram

```
Any Channel (Widget/Voice/WhatsApp)
      ↓
POST /api/phorest/clients
      ↓
{
  tenantId, firstName, lastName,
  mobile, email
}
      ↓
phorest.routes.ts → Validate Input
      ↓
phorestService.createClient()
      ↓
  Retrieve Config → Retrieve Business → Decrypt Credentials
      ↓
  Validate & Format Data → Call Phorest API
      ↓
Return { success: true, client: {...} }
      ↓
Channel receives clientId and continues flow
```

## 📝 Future Enhancements

Potential additions for future iterations:

- [ ] Update existing client details
- [ ] Search for clients by email/phone
- [ ] Create bookings for clients
- [ ] Retrieve client booking history
- [ ] Cancel/reschedule bookings
- [ ] Add payment recording
- [ ] Webhook support for Phorest events

## 🤝 Contributing

When extending this service:

1. Add new methods to `PhorestService` class
2. Define types in `types.ts`
3. Add custom errors in `errors.ts` if needed
4. Create helper functions in `utils.ts`
5. Update this README with new features
6. Add comprehensive logging
7. Handle all error cases

## 📚 Resources

- [Phorest API Documentation](https://developer.phorest.com/)
- [Phorest API Support](mailto:support@phorest.com)

---

**Last Updated:** 24 December 2025
**Version:** 1.0.0
**Maintainer:** Embellics AI Development Team
