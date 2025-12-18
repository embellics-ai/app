# Tenant Config Endpoint - Available Fields

## Endpoints

### Get Tenant Config

```
GET /api/proxy/:tenantId/config?fields=<field1>,<field2>,...
```

### Lookup Tenant ID (New!)

```
GET /api/proxy/lookup?name=TenantName
GET /api/proxy/lookup?email=tenant@example.com
```

## Available Fields

### 🤖 **Agent Configuration**

| Field             | Type           | Source                           | Description                             | Example Value                      |
| ----------------- | -------------- | -------------------------------- | --------------------------------------- | ---------------------------------- |
| `agentId`         | string \| null | `widget_configs.retellAgentId`   | Retell AI agent ID for web chat widget  | `"agent_abc123xyz456def789ghi012"` |
| `whatsappAgentId` | string \| null | `widget_configs.whatsappAgentId` | Retell AI agent ID for WhatsApp channel | `"agent_def456abc789ghi012jkl345"` |

### 💬 **WhatsApp Configuration**

| Field               | Type           | Source                                                 | Description                            | Example Value       |
| ------------------- | -------------- | ------------------------------------------------------ | -------------------------------------- | ------------------- |
| `whatsappEnabled`   | boolean        | `tenant_integrations.whatsappEnabled`                  | Whether WhatsApp is enabled for tenant | `true`              |
| `whatsappPhone`     | string \| null | `tenant_integrations.whatsappConfig.phoneNumber`       | Display phone number (decrypted)       | `"+1 555 123 4567"` |
| `phoneNumberId`     | string \| null | `tenant_integrations.whatsappConfig.phoneNumberId`     | Meta WhatsApp phone number ID          | `"123456789012345"` |
| `businessAccountId` | string \| null | `tenant_integrations.whatsappConfig.businessAccountId` | Meta WhatsApp business account ID      | `"987654321098765"` |

### 📱 **SMS/Twilio Configuration**

| Field                 | Type           | Source                                              | Description                             | Example Value                         |
| --------------------- | -------------- | --------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| `smsEnabled`          | boolean        | `tenant_integrations.smsEnabled`                    | Whether SMS is enabled for tenant       | `true`                                |
| `smsProvider`         | string \| null | `tenant_integrations.smsConfig.provider`            | SMS provider name                       | `"twilio"` / `"vonage"` / `"aws_sns"` |
| `smsPhoneNumber`      | string \| null | `tenant_integrations.smsConfig.phoneNumber`         | SMS sending phone number (decrypted)    | `"+1234567890"`                       |
| `messagingServiceSid` | string \| null | `tenant_integrations.smsConfig.messagingServiceSid` | Twilio Messaging Service SID (optional) | `"MG..."`                             |

### 🎨 **Widget Styling**

| Field            | Type           | Source                        | Description                | Example Value                     |
| ---------------- | -------------- | ----------------------------- | -------------------------- | --------------------------------- |
| `greeting`       | string \| null | `widget_configs.greeting`     | Widget greeting message    | `"Hi! How can I help you today?"` |
| `primaryColor`   | string \| null | `widget_configs.primaryColor` | Widget primary color (hex) | `"#9b7ddd"`                       |
| `widgetPosition` | string \| null | `widget_configs.position`     | Widget position on page    | `"bottom-right"`                  |

### 🏢 **Tenant Information**

| Field        | Type           | Source            | Description                   | Example Value        |
| ------------ | -------------- | ----------------- | ----------------------------- | -------------------- |
| `tenantId`   | string         | Request parameter | Tenant UUID (always included) | `"abc-123-uuid"`     |
| `tenantName` | string \| null | `tenants.name`    | Tenant company name           | `"Acme Corporation"` |

---

## Tenant Lookup (Get tenantId by Name/Email)

### Lookup by Company Name

```bash
GET /api/proxy/lookup?name=Acme Corporation
```

**Response:**

```json
{
  "tenantId": "abc-123-uuid",
  "tenantName": "Acme Corporation",
  "tenantEmail": "admin@acme.com"
}
```

### Lookup by Email

```bash
GET /api/proxy/lookup?email=admin@acme.com
```

**Response:**

```json
{
  "tenantId": "abc-123-uuid",
  "tenantName": "Acme Corporation",
  "tenantEmail": "admin@acme.com"
}
```

### Error Response (Tenant Not Found)

```json
{
  "error": "Tenant not found",
  "message": "No tenant found with name: XYZ Corp"
}
```

---

## Usage Examples

### Get All Fields

```bash
GET /api/proxy/abc-123-uuid/config
```

**Response:**

```json
{
  "tenantId": "abc-123-uuid",
  "agentId": "agent_abc123xyz456def789ghi012",
  "whatsappAgentId": "agent_def456abc789ghi012jkl345",
  "greeting": "Hi! How can I help you today?",
  "primaryColor": "#9b7ddd",
  "widgetPosition": "bottom-right",
  "whatsappEnabled": true,
  "whatsappPhone": "+1 555 123 4567",
  "phoneNumberId": "123456789012345",
  "businessAccountId": "987654321098765",
  "smsEnabled": true,
  "smsProvider": "twilio",
  "smsPhoneNumber": "+1234567890",
  "messagingServiceSid": "MG1234567890abcdef",
  "tenantName": "Acme Corporation"
}
```

### Get Specific Fields Only

```bash
GET /api/proxy/abc-123-uuid/config?fields=whatsappAgentId,phoneNumberId
```

**Response:**

```json
{
  "tenantId": "abc-123-uuid",
  "whatsappAgentId": "agent_def456abc789ghi012jkl345",
  "phoneNumberId": "123456789012345"
}
```

### Get Agent IDs Only

```bash
GET /api/proxy/abc-123-uuid/config?fields=agentId,whatsappAgentId
```

**Response:**

```json
{
  "tenantId": "abc-123-uuid",
  "agentId": "agent_abc123xyz456def789ghi012",
  "whatsappAgentId": "agent_def456abc789ghi012jkl345"
}
```

---

## Common Use Cases

### 1. **WhatsApp Workflow - Get Agent ID**

```
?fields=whatsappAgentId
```

Use when: Creating Retell chat for WhatsApp messages

### 2. **Web Widget - Get Agent ID & Styling**

```
?fields=agentId,greeting,primaryColor,widgetPosition
```

Use when: Initializing chat widget dynamically

### 3. **Voice Call - Get Agent & Tenant Info**

```
?fields=agentId,tenantName,whatsappPhone
```

Use when: Making outbound calls with context

### 4. **Integration Check - Get WhatsApp Status**

```
?fields=whatsappEnabled,phoneNumberId,businessAccountId
```

Use when: Validating WhatsApp integration before sending

### 5. **SMS/Twilio Workflow - Get SMS Config**

```
?fields=smsEnabled,smsProvider,smsPhoneNumber,messagingServiceSid
```

Use when: Sending SMS via Twilio or other providers

---

## N8N Examples

### Example 0: Lookup Tenant ID by Name (NEW!)

```javascript
// Step 1: HTTP Request Node - Lookup Tenant
URL: https://embellics-app.onrender.com/api/proxy/lookup?name=Acme Corporation
Method: GET
Authentication: Header Auth
  Name: Authorization
  Value: Bearer {{ $env.N8N_WEBHOOK_SECRET }}

// Response saves to $json:
{
  "tenantId": "abc-123-uuid",
  "tenantName": "Acme Corporation",
  "tenantEmail": "admin@acme.com"
}

// Step 2: Use in next node:
{{ $json.tenantId }}  // ✅ Dynamic tenant ID!
```

### Example 1: Get WhatsApp Agent ID

```javascript
// HTTP Request Node
URL: https://embellics-app.onrender.com/api/proxy/{{ $env.TENANT_ID }}/config?fields=whatsappAgentId
Method: GET
Authentication: Header Auth
  Name: Authorization
  Value: Bearer {{ $env.N8N_WEBHOOK_SECRET }}

// Response example:
{
  "tenantId": "abc-123-uuid",
  "whatsappAgentId": "agent_def456abc789ghi012jkl345"
}

// Use in next node:
{{ $json.whatsappAgentId }}
```

### Example 2: Get Multiple Config Values

```javascript
// HTTP Request Node
URL: https://embellics-app.onrender.com/api/proxy/{{ $env.TENANT_ID }}/config?fields=whatsappAgentId,phoneNumberId,tenantName

// Response example:
{
  "tenantId": "abc-123-uuid",
  "whatsappAgentId": "agent_def456abc789ghi012jkl345",
  "phoneNumberId": "123456789012345",
  "tenantName": "Acme Corporation"
}

// Use in next node:
{
  "agent_id": "{{ $json.whatsappAgentId }}",
  "metadata": {
    "tenant": "{{ $json.tenantName }}",
    "phone_number_id": "{{ $json.phoneNumberId }}"
  }
}
```

### Example 3: Get All Config (Debug Mode)

```javascript
// HTTP Request Node
URL: https://embellics-app.onrender.com/api/proxy/{{ $env.TENANT_ID }}/config

// Returns everything - useful for debugging
```

---

## Security Notes

✅ **Included (Safe):**

- Agent IDs
- Phone numbers (display only)
- Business account IDs
- Widget styling
- Tenant name

❌ **Excluded (Sensitive):**

- Retell API keys
- WhatsApp access tokens
- Encryption keys
- Database credentials

All sensitive credentials are handled by proxy endpoints automatically.

---

## Performance Tips

1. **Request only what you need**: `?fields=agentId` is faster than no fields
2. **Cache when possible**: Config rarely changes, cache for 5-10 minutes
3. **Reuse across workflow**: Call once, use `$json.field` in multiple nodes

---

## Adding New Fields

To add a new field in the future:

1. Update `proxy.routes.ts` config endpoint
2. Add to appropriate field group (`agentFields`, `integrationFields`, `tenantFields`)
3. Fetch from database and add to response
4. Update this documentation

**No N8N workflow changes needed** - just add field name to `?fields=` parameter!

---

## Complete N8N Workflow Examples

### Scenario 1: Google Sheets Trigger with Tenant Name

**Problem:** Your Google Sheet has company names, but you need tenantId for API calls.

**Solution:** Use lookup endpoint!

```
Node 1: Google Sheets Trigger
↓
Node 2: Lookup Tenant ID
  URL: /api/proxy/lookup?name={{ $json.companyName }}
  Returns: { tenantId, tenantName, tenantEmail }
↓
Node 3: Get Config
  URL: /api/proxy/{{ $('Lookup Tenant ID').item.json.tenantId }}/config?fields=whatsappAgentId
↓
Node 4: Create Retell Chat
  agent_id: {{ $('Get Config').item.json.whatsappAgentId }}
```

### Scenario 2: WhatsApp Inbound (Automatic tenantId)

**Problem:** Need agent ID for incoming WhatsApp messages.

**Solution:** Use tenantId from webhook payload!

```
Node 1: WhatsApp Webhook (Platform sends tenantId automatically)
  Receives: { tenantId: "abc-123", messages: [...] }
↓
Node 2: Get Config
  URL: /api/proxy/{{ $json.tenantId }}/config?fields=whatsappAgentId
↓
Node 3: Create Retell Chat
  agent_id: {{ $('Get Config').item.json.whatsappAgentId }}
```

### Scenario 3: Multi-Tenant with Environment Variable

**Problem:** One workflow per tenant, hardcoded in N8N settings.

**Solution:** Use N8N environment variable!

```
N8N Settings → Environment Variables:
  TENANT_ID = abc-123-uuid

Node 1: Trigger (any)
↓
Node 2: Get Config
  URL: /api/proxy/{{ $env.TENANT_ID }}/config?fields=whatsappAgentId,smsPhoneNumber
↓
Node 3: Use Config
  agent_id: {{ $('Get Config').item.json.whatsappAgentId }}
  from: {{ $('Get Config').item.json.smsPhoneNumber }}
```
