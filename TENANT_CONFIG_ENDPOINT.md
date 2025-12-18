# Tenant Config Endpoint for N8N

## Endpoint

```
GET /api/proxy/:tenantId/config
```

## Authentication

- **Header**: `Authorization: Bearer <N8N_WEBHOOK_SECRET>`
- Same authentication as other proxy endpoints

## Usage

### Get specific fields

```bash
GET /api/proxy/tenant123/config?fields=whatsappAgentId
→ { "tenantId": "tenant123", "whatsappAgentId": "agent_9g85d5e7349ceg02d836bb0045" }

GET /api/proxy/tenant123/config?fields=agentId,whatsappAgentId,phoneNumberId
→ {
    "tenantId": "tenant123",
    "agentId": "agent_8f74c4d6238bdf91c725aa0034",
    "whatsappAgentId": "agent_9g85d5e7349ceg02d836bb0045",
    "phoneNumberId": "915998021588678"
  }
```

### Get all available fields

```bash
GET /api/proxy/tenant123/config
→ { /* all fields */ }
```

## Available Fields

| Field               | Source                              | Description                       |
| ------------------- | ----------------------------------- | --------------------------------- |
| `agentId`           | widget_configs.retellAgentId        | Web chat agent ID                 |
| `whatsappAgentId`   | widget_configs.whatsappAgentId      | WhatsApp agent ID                 |
| `greeting`          | widget_configs.greeting             | Widget greeting message           |
| `primaryColor`      | widget_configs.primaryColor         | Widget primary color              |
| `widgetPosition`    | widget_configs.position             | Widget position on page           |
| `whatsappEnabled`   | tenant_integrations.whatsappEnabled | WhatsApp integration status       |
| `whatsappPhone`     | tenant_integrations.whatsappConfig  | WhatsApp display phone number     |
| `phoneNumberId`     | tenant_integrations.whatsappConfig  | Meta WhatsApp phone number ID     |
| `businessAccountId` | tenant_integrations.whatsappConfig  | Meta WhatsApp business account ID |
| `tenantName`        | tenants.name                        | Tenant company name               |

## N8N Usage Example

### In "Create-New-Chat" workflow:

1. **Add HTTP Request node before Create Chat**

   ```
   Method: GET
   URL: https://embellics-app.onrender.com/api/proxy/{{$json.tenantId}}/config?fields=whatsappAgentId
   Authentication: Generic Credential Type
   Generic Auth Type: Header Auth
   Name: Authorization
   Value: Bearer {{$env.N8N_WEBHOOK_SECRET}}
   ```

2. **Extract agent_id in Create Chat node**
   ```json
   {
     "agent_id": "{{ $('Get Tenant Config').item.json.whatsappAgentId }}",
     "metadata": {
       "whatsapp_user": "{{ $json.whatsapp_user }}"
     }
   }
   ```

## Adding New Fields

To add a new field in the future:

1. Add field mapping in `proxy.routes.ts` config endpoint
2. Use in N8N: `?fields=newField`
3. **No code deployment needed** - just restart server

## Security

- ✅ Protected by N8N_WEBHOOK_SECRET
- ✅ No sensitive data exposed (API keys, access tokens excluded)
- ✅ Only configuration data (agent IDs, phone numbers, styling)
