# Retell AI Custom Function Configuration

## Function: create-embellics-client

### Basic Configuration

**Name**: `create-embellics-client`

**Description**:

```
Creates a new client record in the Embellics customer management system.
Call this function when a customer provides their contact information during a booking conversation.
```

**API Endpoint**:

```
POST https://embellics-app.onrender.com/api/platform/tenants/{{tenantId}}/clients
```

**Timeout**: `120000` milliseconds (2 minutes)

---

### Headers

Add these headers:

| Key             | Value                        |
| --------------- | ---------------------------- |
| `Authorization` | `Bearer YOUR_API_TOKEN_HERE` |
| `Content-Type`  | `application/json`           |

⚠️ **Important**: Replace `YOUR_API_TOKEN_HERE` with an actual API token that has permission to create clients.

---

### JSON Schema (Parameters)

Use this schema to define what parameters the LLM should collect:

```json
{
  "type": "object",
  "properties": {
    "firstName": {
      "type": "string",
      "description": "Customer's first name"
    },
    "lastName": {
      "type": "string",
      "description": "Customer's last name"
    },
    "phone": {
      "type": "string",
      "description": "Customer's phone number in E.164 format (e.g., +353871234567)"
    },
    "email": {
      "type": "string",
      "description": "Customer's email address (optional)"
    },
    "firstInteractionSource": {
      "type": "string",
      "enum": ["voice", "web", "whatsapp"],
      "description": "Source of the booking - use 'voice' for phone calls"
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive"],
      "default": "active",
      "description": "Customer status"
    }
  },
  "required": ["firstName", "lastName", "phone", "firstInteractionSource"]
}
```

**⚡ Auto-populated fields:**

- `firstInteractionDate` is automatically set to the current timestamp when the client is created
- `firstBookingDate` is automatically set when the client makes their first booking via the booking completion endpoint

**Do NOT include these date fields in your request body.**

---

### How tenantId Gets Replaced

The `{{tenantId}}` in your URL needs to be dynamically replaced. This depends on your Retell AI setup:

**Option 1: Use Retell's dynamic variables**

- If Retell AI supports template variables, configure `tenantId` as a context variable
- Set it when the call is initiated

**Option 2: Hardcode for single tenant**

```
https://embellics-app.onrender.com/api/platform/tenants/eb40f9f0-e696-4f46-bf00-4c7cf96338cc/clients
```

**Option 3: Use a proxy endpoint** (Recommended for multi-tenant)

- Create a new endpoint in your backend: `/api/retell/create-client`
- This endpoint internally determines the tenantId and calls the Embellics endpoint
- Simpler for Retell AI configuration

---

## Alternative: Use Interaction Tracking Endpoint

Instead of creating clients directly, you might want to use the **interaction tracking endpoint** which is more appropriate for call handling:

### Function: track-embellics-interaction

**API Endpoint**:

```
POST https://embellics-app.onrender.com/api/platform/interactions/track
```

**JSON Schema**:

```json
{
  "type": "object",
  "properties": {
    "tenantId": {
      "type": "string",
      "description": "The tenant ID for this business"
    },
    "phone": {
      "type": "string",
      "description": "Customer's phone number"
    },
    "email": {
      "type": "string",
      "description": "Customer's email address (optional)"
    },
    "firstName": {
      "type": "string",
      "description": "Customer's first name"
    },
    "lastName": {
      "type": "string",
      "description": "Customer's last name"
    },
    "source": {
      "type": "string",
      "enum": ["voice"],
      "default": "voice",
      "description": "Always 'voice' for phone calls"
    },
    "sourceDetails": {
      "type": "object",
      "properties": {
        "callId": {
          "type": "string",
          "description": "Retell call ID"
        },
        "agentId": {
          "type": "string",
          "description": "Retell agent ID"
        }
      }
    },
    "interactionType": {
      "type": "string",
      "enum": ["inquiry", "reservation", "callback_request"],
      "description": "Type of customer interaction"
    },
    "notes": {
      "type": "string",
      "description": "Notes about the interaction"
    }
  },
  "required": ["tenantId", "phone", "source"]
}
```

**Benefits**:

- No need for URL template variables (tenantId in request body)
- Tracks interaction intent (inquiry/reservation/callback)
- Optionally creates lead record for follow-up
- Does NOT create booking in Phorest yet (only when deposit paid)

---

## Testing Your Configuration

### Test with cURL:

```bash
curl -X POST 'https://embellics-app.onrender.com/api/platform/tenants/YOUR_TENANT_ID/clients' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Test",
    "lastName": "Customer",
    "phone": "+353871234567",
    "email": "test@example.com",
    "firstInteractionSource": "voice",
    "status": "active"
  }'
```

**Expected Response (201 Created)**:

```json
{
  "id": "uuid-here",
  "tenantId": "your-tenant-id",
  "firstName": "Test",
  "lastName": "Customer",
  "phone": "+353871234567",
  "email": "test@example.com",
  "firstInteractionSource": "voice",
  "firstInteractionDate": "2025-12-26T13:00:00Z",
  "firstBookingDate": null,
  "status": "active",
  "createdAt": "2025-12-26T13:00:00Z"
}
```

**Expected Response (409 Conflict)** if customer exists:

```json
{
  "error": "Client with this phone number already exists",
  "existingClient": {
    "id": "existing-uuid",
    "phone": "+353871234567"
  }
}
```

---

## Troubleshooting

### Issue: 401 Unauthorized

**Solution**: Check your Authorization header has a valid Bearer token

### Issue: 403 Forbidden

**Solution**: The API token doesn't have permission for this tenant

### Issue: 404 Not Found

**Solution**: Check the tenant ID in the URL is correct

### Issue: 409 Conflict

**Solution**: Customer already exists - this is expected behavior, handle in your flow

### Issue: 500 Internal Server Error

**Solution**: Check server logs, possibly a database connection issue

---

## Recommended Flow for Voice Bookings

1. **Call Starts**: Customer calls in
2. **Collect Info**: AI agent collects customer details
3. **Track Interaction**: Call `POST /api/platform/interactions/track`
   - Creates/updates client record
   - Creates lead record with status "interested"
   - No external service call yet
4. **Customer Confirms**: Customer agrees to booking and payment details
5. **Complete Booking**: Call `POST /api/platform/bookings/complete`
   - Creates booking record with status "pending" or "confirmed"
   - **REQUIRED**: Use `externalBusinessId` (NOT businessId)
   - **REQUIRED**: Use `externalBranchId` (NOT branchId)
   - **NEW**: Add `serviceProviderBookingId` for external system sync
   - **NEW**: Set `createPaymentLink: true` to auto-generate Stripe payment URL
   - Creates appointment in external service
   - Updates client's last booking date
   - **Sets client's firstBookingDate if it's their first booking**
6. **Payment (if needed)**:
   - If `createPaymentLink: true`, response includes Stripe checkout URL
   - Send payment URL to customer via SMS/email
   - When payment completes, booking status automatically updates to "confirmed"
7. **Call Ends**: Booking is complete

**Example Payload:**

```json
{
  "tenantId": "tenant_123",
  "externalServiceName": "external_service_api",
  "externalServiceClientId": "external_client_456",
  "externalBusinessId": "K2e7saP77YvkzIa0N-XNW",
  "externalBranchId": "62e7saP77YvkzIa0N-XNW",
  "serviceName": "Bleach Cheeks",
  "amount": 100,
  "currency": "EUR",
  "bookingDateTime": "2025-12-27T11:00:00.000Z",
  "staffMemberId": "ZAUE5vJhCt89hGBAdUA",
  "bookingSource": "voice",
  "serviceProviderBookingId": "external_booking_789",
  "createPaymentLink": true
}
```

This two-step approach matches the booking lifecycle you just implemented!
