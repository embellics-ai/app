# Quick Reference: Update Your N8N Workflow

## ❌ REMOVE THIS (Old Setup)

```
Node: Create-New-Chat
Method: POST
URL: https://api.retellai.com/create-chat

Send Headers: ON
Header Parameters:
  Name: Authorization
  Value: Bearer key_93f64256e7e3591f07e71d3cbb9b  ← HARDCODED! Remove this!
```

## ✅ REPLACE WITH THIS (New Proxy Setup)

```
Node: Create-New-Chat
Method: POST
URL: https://embellics-app.onrender.com/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat

Send Headers: ON
Header Parameters:
  Name: Authorization
  Value: Bearer {{$env.N8N_WEBHOOK_SECRET}}  ← Use environment variable!
```

## 🔧 Setup N8N Environment Variable (One-time)

1. Open N8N
2. Go to **Settings** → **Environment Variables**
3. Click **Add Variable**
4. Set:
   - **Name:** `N8N_WEBHOOK_SECRET`
   - **Value:** `NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=`
5. Save

## 📋 Full Example

### Webhook Node (Unchanged)

```
Name: Webhook
Type: Webhook
Path: webhook/whatsapp-incoming
Method: POST
```

### Create Chat Node (UPDATED)

```
Name: Create-New-Chat
Type: HTTP Request
Method: POST
URL: https://embellics-app.onrender.com/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat

Authentication: None

Send Query Parameters: OFF
Send Headers: ON

Specify Headers: Using Fields Below

Header Parameters:
┌──────────────┬────────────────────────────────────────────┐
│ Name         │ Value                                      │
├──────────────┼────────────────────────────────────────────┤
│ Authorization│ Bearer {{$env.N8N_WEBHOOK_SECRET}}        │
└──────────────┴────────────────────────────────────────────┘

Send Body: ON
Body Content Type: JSON

Body (JSON):
{
  "agent_id": "{{ $json.agentId }}",
  "metadata": {
    "conversationId": "{{ $json.conversationId }}",
    "phoneNumber": "{{ $json.from }}"
  }
}
```

## 🌍 Environment-Specific URLs

### Development

```
http://localhost:5000/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
```

### Production

```
https://embellics-app.onrender.com/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
```

## ✅ Checklist

- [ ] Added `N8N_WEBHOOK_SECRET` to N8N environment variables
- [ ] Updated URL to use proxy endpoint
- [ ] Changed Authorization header to use `{{$env.N8N_WEBHOOK_SECRET}}`
- [ ] Verified `tenantId` is passed from Webhook node
- [ ] Removed hardcoded Retell API key
- [ ] Tested workflow with sample payload

## 🧪 Test Your Setup

### 1. Check Environment Variable

In N8N, create a test node:

```
Type: Code
Code:
  return [{
    json: {
      secret: $env.N8N_WEBHOOK_SECRET
    }
  }];
```

Expected output: `NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=`

### 2. Test Create Chat

Send a test webhook with:

```json
{
  "tenantId": "your-tenant-id",
  "agentId": "your-agent-id",
  "conversationId": "test-123",
  "from": "+1234567890"
}
```

Expected: Chat created successfully, no authentication errors

### 3. Check Logs

In your platform logs, you should see:

```
[Proxy] Retell create-chat request for tenant: your-tenant-id
[Proxy] Retell chat created successfully: chat_xyz789
```

## 🚨 Common Issues

### "Missing authorization header"

- **Cause:** `Authorization` header not set or wrong format
- **Fix:** Ensure header is `Bearer {{$env.N8N_WEBHOOK_SECRET}}`

### "Invalid authorization token"

- **Cause:** Wrong N8N_WEBHOOK_SECRET value
- **Fix:** Verify secret matches your `.env` file: `NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g=`

### "Retell API key not found"

- **Cause:** Tenant doesn't have a Retell API key configured
- **Fix:** Login as platform admin → Tenant Management → Assign Retell API key

### "tenantId is undefined"

- **Cause:** Webhook payload doesn't include `tenantId`
- **Fix:** Ensure your WhatsApp webhook forwarding includes `tenantId` in the payload

## 💡 Pro Tips

1. **Use Environment Variable for Base URL**

   ```
   {{$env.PLATFORM_URL}}/api/proxy/{{ $('Webhook').item.json.body.tenantId }}/retell/create-chat
   ```

2. **Add Error Handling**

   ```
   Try/Catch node to handle proxy errors gracefully
   ```

3. **Log Requests**

   ```
   Add a debug node after Create-New-Chat to log responses
   ```

4. **Keep Old Node for Reference**
   ```
   Disable the old node instead of deleting it
   Mark it as "DEPRECATED - DO NOT USE"
   ```

## 📚 Related Documentation

- **Full Guide:** `RETELL_PROXY_API_GUIDE.md`
- **Implementation Details:** `RETELL_PROXY_IMPLEMENTATION.md`
- **WhatsApp Proxy (Similar Pattern):** `WHATSAPP_PROXY_API_GUIDE.md`

---

**Questions?** Check the platform logs or contact the development team.
