# Phorest API Integration - Universal Endpoint

## Overview

The Phorest integration provides a **universal API endpoint** for creating clients in Phorest salon management system. This endpoint can be called from **any channel** (Widget, Voice, WhatsApp, n8n workflows) to ensure consistent client creation across all communication channels.

## API Endpoint

### POST `/api/phorest/clients`

Creates a new client in Phorest salon management system.

**Base URL:** `https://your-domain.com/api/phorest/clients`

**Method:** `POST`

**Content-Type:** `application/json`

### Request Body

```json
{
  "businessId": "string (required)",
  "firstName": "string (required, max 100 chars)",
  "lastName": "string (required, max 100 chars)",
  "mobile": "string (required, will be formatted to +353XXXXXXXXX)",
  "email": "string (required, valid email)"
}
```

**Field Details:**

- **`businessId`**: Phorest business ID for the salon (tenant ID is automatically resolved from this)
- **`firstName`**: Client's first name (1-100 characters)
- **`lastName`**: Client's last name (1-100 characters)
- **`mobile`**: Phone number (will be formatted to Irish format: +353XXXXXXXXX)
- **`email`**: Valid email address

### Success Response (201 Created)

```json
{
  "success": true,
  "client": {
    "clientId": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "mobile": "+353871234567",
    "email": "john.doe@example.com",
    "createdAt": "2024-12-24T10:30:00Z"
  }
}
```

### Error Responses

#### 400 - Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

#### 404 - Tenant Not Found

```json
{
  "success": false,
  "error": "PhorestConfigError",
  "message": "Phorest configuration not found for tenant"
}
```

#### 409 - Client Already Exists

```json
{
  "success": false,
  "error": "Client already exists",
  "message": "Client with this email already exists in Phorest",
  "details": {
    "email": "john.doe@example.com"
  }
}
```

#### 500 - Server Error

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error details here"
}
```

---

### GET `/api/phorest/clients`

Retrieves an existing client from Phorest salon management system by phone number.

**Base URL:** `https://your-domain.com/api/phorest/clients`

**Method:** `GET`

### Query Parameters

| Parameter  | Type   | Required | Description                                           |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| businessId | string | Yes      | Phorest business ID for the salon                     |
| phone      | string | Yes      | Client's phone number (353871234567 or +353871234567) |

**Example URL:**

```
GET /api/phorest/clients?businessId=YOUR_BUSINESS_ID&phone=353871234567
```

### Success Response (200 OK)

```json
{
  "success": true,
  "client": {
    "clientId": "12345",
    "firstName": "John",
    "lastName": "Doe",
    "mobile": "+353871234567",
    "email": "john.doe@example.com",
    "createdAt": "2024-12-24T10:30:00Z"
  }
}
```

### Error Responses

#### 404 - Client Not Found

```json
{
  "success": false,
  "error": "Client not found",
  "message": "No client found with the provided phone number"
}
```

#### 400 - Validation Error

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "phone",
      "message": "Phone number is required"
    }
  ]
}
```

#### 404 - Configuration Not Found

```json
{
  "success": false,
  "error": "PhorestConfigError",
  "message": "Business ID not found in system"
}
```

#### 500 - Server Error

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error details here"
}
```

---

## Usage Examples

### From Widget (JavaScript)

```javascript
// In widget chat handler
const contactData = {
  businessId: 'your-phorest-business-id',
  firstName: 'John',
  lastName: 'Doe',
  mobile: '0871234567', // Will be formatted to +353871234567
  email: 'john.doe@example.com',
};

try {
  const response = await fetch('https://your-domain.com/api/phorest/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactData),
  });

  const result = await response.json();

  if (result.success) {
    console.log('Client created:', result.client.clientId);
  } else {
    console.error('Error:', result.error);
  }
} catch (error) {
  console.error('Failed to create client:', error);
}
```

### From n8n Workflow

```json
{
  "method": "POST",
  "url": "https://your-domain.com/api/phorest/clients",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "businessId": "{{$json.businessId}}",
    "firstName": "{{$json.first_name}}",
    "lastName": "{{$json.last_name}}",
    "mobile": "{{$json.phone}}",
    "email": "{{$json.email}}"
  }
}
```

### From Voice Channel (Retell Webhook)

```javascript
// In Retell webhook handler
const transcript = extractContactDetails(call.transcript);

if (transcript.hasContactDetails) {
  const response = await axios.post('http://localhost:3000/api/phorest/clients', {
    businessId: call.businessId, // From tenant lookup response
    firstName: transcript.firstName,
    lastName: transcript.lastName,
    mobile: transcript.phone,
    email: transcript.email,
  });

  console.log('Phorest client ID:', response.data.client.clientId);
}
```

### From WhatsApp (n8n Workflow)

```javascript
// HTTP Request node in n8n
POST https://your-domain.com/api/phorest/clients

Body:
{
  "businessId": "{{ $json.businessId }}",
  "firstName": "{{ $json.contact.firstName }}",
  "lastName": "{{ $json.contact.lastName }}",
  "mobile": "{{ $json.contact.phone }}",
  "email": "{{ $json.contact.email }}"
}
```

## Multi-Channel Integration

This universal endpoint enables consistent client creation across all channels:

```
┌─────────────────────────────────────────────────────┐
│              COMMUNICATION CHANNELS                  │
├─────────────────────────────────────────────────────┤
│  Widget Chat  │  Voice Calls  │  WhatsApp Messages  │
└────────┬──────┴───────┬───────┴──────────┬──────────┘
         │              │                  │
         └──────────────┼──────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  POST /api/phorest/clients   │
         │   (Universal Endpoint)       │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │      PhorestService          │
         │      .createClient()         │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │    Phorest API (External)    │
         │  POST /api/v1/clients        │
         └──────────────────────────────┘
```

## Phone Number Formatting

The endpoint automatically formats phone numbers to Phorest's required format:

**Supported Input Formats:**

- `0871234567` → `+353871234567`
- `871234567` → `+353871234567`
- `+353 87 123 4567` → `+353871234567`
- `+353871234567` → `+353871234567` (already correct)

## Error Handling

The endpoint provides detailed error responses for different scenarios:

| Status | Error Type          | Description                                                         |
| ------ | ------------------- | ------------------------------------------------------------------- |
| 400    | Validation Error    | Invalid input fields (missing required fields, invalid email, etc.) |
| 404    | Configuration Error | Phorest credentials not found for tenant                            |
| 409    | Client Exists       | Client with this email already exists in Phorest                    |
| 500    | Server Error        | Unexpected error (network issues, Phorest API down, etc.)           |

## Health Check

Check if the Phorest service is operational:

### GET `/api/phorest/health`

```bash
curl https://your-domain.com/api/phorest/health
```

**Response:**

```json
{
  "success": true,
  "service": "phorest",
  "status": "operational",
  "timestamp": "2024-12-24T10:30:00Z"
}
```

## Security

- Phorest credentials are **encrypted** in the database using AES-256
- Credentials are decrypted only at runtime for API calls
- No credentials are exposed in API responses
- All communication with Phorest uses HTTPS

## Database Setup

Before using this endpoint, ensure:

1. **Migration applied:** `migrations/0015_add_phorest_api_support.sql`
2. **Credentials seeded:** Run seed script with tenant credentials
3. **Configuration exists:** Check `external_api_configs` and `tenant_businesses` tables

See `PHOREST_DATABASE_SETUP.md` for detailed setup instructions.

## Related Documentation

- **Service Implementation:** `server/services/phorest/README.md`
- **Database Setup:** `PHOREST_DATABASE_SETUP.md`
- **Multi-Channel Discussion:** `MULTI_CHANNEL_CLIENT_CREATION_DISCUSSION.md`
- **Quick Reference:** `PHOREST_SERVICE_QUICK_REFERENCE.md`

## Testing

Test the endpoint with curl:

```bash
curl -X POST https://your-domain.com/api/phorest/clients \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "your-tenant-id",
    "firstName": "John",
    "lastName": "Doe",
    "mobile": "0871234567",
    "email": "john.doe@example.com"
  }'
```

## Support

For issues or questions:

1. Check Phorest service logs: `[Phorest API]` prefix
2. Verify tenant configuration in database
3. Test connectivity to Phorest API
4. Review error response details
