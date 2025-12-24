# Retell AI - Tenant Lookup Integration Guide

## Overview

This guide shows you how to configure your Retell AI agent to look up tenant details dynamically during a call, then use that information to create clients in Phorest or other services.

---

## Step 1: Create the Tenant Lookup Tool in Retell AI

### Tool Configuration

In your Retell AI agent configuration, add a new custom tool:

**Tool Name:** `get-tenant-details`

**Description:**

```
Look up tenant details by business name. Use this when the customer mentions their business name and you need to identify which tenant they belong to.
```

**URL:**

```
https://your-domain.com/api/tenants/lookup
```

(Replace with your actual domain or ngrok URL)

**Method:** `GET`

**Parameters:**

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The business name to search for (e.g., 'SWC', 'Studio')"
    }
  },
  "required": ["name"]
}
```

**Example Configuration in Retell Dashboard:**

```json
{
  "name": "get-tenant-details",
  "description": "Look up tenant details by business name",
  "url": "https://your-domain.com/api/tenants/lookup",
  "method": "get",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Business name to search for"
      }
    },
    "required": ["name"]
  },
  "speak_on_send": false,
  "speak_during_execution": true,
  "execution_message_description": "Looking up business details..."
}
```

---

## Step 2: Create the Phorest Client Creation Tool

Once you have the tenant ID from the lookup, you can create a Phorest client.

**Tool Name:** `create-phorest-client`

**Description:**

```
Create a new client in the Phorest salon management system. Use this after collecting the customer's contact details.
```

**URL:**

```
https://your-domain.com/api/phorest/clients
```

**Method:** `POST`

**Parameters:**

```json
{
  "type": "object",
  "properties": {
    "tenantId": {
      "type": "string",
      "description": "The tenant ID obtained from get-tenant-details"
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
  "required": ["tenantId", "firstName", "lastName", "mobile", "email"]
}
```

---

## Step 3: Configure Agent Prompt

Update your agent's system prompt to guide the conversation flow:

```
You are a helpful assistant for salon booking and customer registration.

WORKFLOW:
1. Greet the customer warmly
2. Ask which salon/business they're calling about
3. Use the get-tenant-details tool to look up the business
4. If business not found, politely ask for clarification
5. Once business is identified, collect their contact details:
   - First name
   - Last name
   - Mobile phone number
   - Email address
6. Use the create-phorest-client tool to register them
7. Confirm registration was successful

IMPORTANT:
- Always use get-tenant-details first to identify the tenant
- Store the tenantId from the lookup response
- Pass the tenantId to create-phorest-client
- Be patient and friendly if customers need to spell their name or email

Example conversation:
Customer: "I'd like to book with SWC"
Agent: "Great! Let me look up SWC for you..." [calls get-tenant-details with name="SWC"]
Agent: "Perfect, I found SWC. May I have your first name please?"
...
Agent: "Thank you! Let me register you in our system..." [calls create-phorest-client with collected info]
```

---

## Step 4: Tool Call Flow Example

### Call Sequence

```
1. Customer says: "I want to book at SWC"

2. Agent calls: GET /api/tenants/lookup?name=SWC
   Response:
   {
     "success": true,
     "tenant": {
       "tenantId": "clx123abc456",
       "tenantName": "SWC",
       "tenantEmail": "contact@swc.ie",
       "businesses": [...]
     }
   }

3. Agent extracts tenantId: "clx123abc456"

4. Agent collects:
   - firstName: "John"
   - lastName: "Doe"
   - mobile: "0871234567"
   - email: "john@example.com"

5. Agent calls: POST /api/phorest/clients
   Body:
   {
     "tenantId": "clx123abc456",
     "firstName": "John",
     "lastName": "Doe",
     "mobile": "0871234567",
     "email": "john@example.com"
   }

   Response:
   {
     "success": true,
     "client": {
       "clientId": "12345",
       "firstName": "John",
       "lastName": "Doe",
       "mobile": "+353871234567",
       "email": "john@example.com"
     }
   }

6. Agent confirms: "Perfect! You're all registered John. Your client ID is 12345."
```

---

## Step 5: Testing with LocalTunnel (Local Development)

### Setup LocalTunnel

```bash
# Terminal 1: Start your server
npm run dev

# Terminal 2: Create tunnel
lt --port 3000

# Copy the tunnel URL (e.g., https://funny-cats-123.loca.lt)
```

### Test the Endpoint

```bash
# Test tenant lookup
curl "https://funny-cats-123.loca.lt/api/tenants/lookup?name=SWC"

# Should return:
{
  "success": true,
  "tenant": {
    "tenantId": "...",
    "tenantName": "SWC",
    ...
  }
}
```

### Update Retell Tool URL

In Retell dashboard, update your tool URL to:

```
https://funny-cats-123.loca.lt/api/tenants/lookup
```

---

## Step 6: Testing with ngrok (Alternative)

### Setup ngrok

```bash
# Start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

### Update Retell Tool URL

```
https://abc123.ngrok.io/api/tenants/lookup
```

---

## Common Issues & Solutions

### Issue: 401 "Not authenticated" Error

**Cause:** The `/lookup` route was being caught by the `/:tenantId` authenticated route

**Solution:** ✅ Fixed! The `/lookup` route is now defined BEFORE the `/:tenantId` route in the code.

### Issue: 404 "Tenant not found"

**Possible causes:**

1. Business name doesn't match exactly (try case-insensitive search)
2. Tenant doesn't exist in database
3. Wrong parameter name (use `name` not `businessName`)

**Debug:**

```bash
# List all tenants (requires platform admin auth)
curl "https://your-domain.com/api/platform/tenants" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Issue: Tool execution timeout

**Cause:** Server might be slow or unreachable

**Solutions:**

- Check server logs for errors
- Verify tunnel is still running (LocalTunnel/ngrok)
- Increase Retell tool timeout setting

---

## Response Handling in Retell

### Success Response

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
        "branches": [...]
      }
    ]
  }
}
```

**What to extract:** `tenant.tenantId` - This is what you pass to create-phorest-client

### Error Response

```json
{
  "success": false,
  "error": "Tenant not found",
  "message": "No tenant found with name: XYZ"
}
```

**What agent should say:** "I couldn't find a business with that name. Could you spell it for me?"

---

## Production Deployment

Once you deploy to production (Render, AWS, etc.):

1. Update tool URLs to production domain:

   ```
   https://your-production-domain.com/api/tenants/lookup
   ```

2. No authentication needed - endpoint is public

3. Monitor logs for usage:
   ```bash
   # Server logs will show:
   [Tenant Lookup] Request: { tenantName: 'SWC' }
   [Tenant Lookup] Tenant found: clx123abc456 SWC
   ```

---

## Security Considerations

### Is it safe to make this endpoint public?

✅ **Yes**, because:

- Only returns non-sensitive business information
- No API keys or credentials exposed
- Read-only operation
- No user data exposed

### What data is exposed?

✅ **Safe to expose:**

- Tenant ID (needed for operations)
- Business name
- Business email
- Branch information

❌ **NOT exposed:**

- API keys
- Passwords
- Payment information
- User passwords
- Internal configurations

---

## Complete Retell Configuration Example

```json
{
  "agent_name": "Salon Booking Assistant",
  "tools": [
    {
      "name": "get-tenant-details",
      "description": "Look up tenant details by business name",
      "url": "https://your-domain.com/api/tenants/lookup",
      "method": "get",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Business name to search for"
          }
        },
        "required": ["name"]
      }
    },
    {
      "name": "create-phorest-client",
      "description": "Create a new client in Phorest",
      "url": "https://your-domain.com/api/phorest/clients",
      "method": "post",
      "parameters": {
        "type": "object",
        "properties": {
          "tenantId": {
            "type": "string",
            "description": "Tenant ID from get-tenant-details"
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
            "description": "Customer's phone number"
          },
          "email": {
            "type": "string",
            "description": "Customer's email"
          }
        },
        "required": ["tenantId", "firstName", "lastName", "mobile", "email"]
      }
    }
  ]
}
```

---

## Related Documentation

- [Tenant Lookup API](./TENANT_LOOKUP_API.md)
- [Phorest API Documentation](./PHOREST_API_DOCUMENTATION.md)
- [Retell Proxy API Guide](./RETELL_PROXY_API_GUIDE.md)

---

**Last Updated:** December 24, 2025  
**Status:** ✅ Ready for use
