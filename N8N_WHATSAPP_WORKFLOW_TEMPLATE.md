# N8N WhatsApp Multi-Tenant Workflow Template

## Overview

This workflow receives WhatsApp messages from your backend, processes them, and sends replies back through the WhatsApp Proxy API.

## Workflow ID

The webhook URL should match: `7833fb83-037f-4638-8e0e-07f064321816`

## Step-by-Step Setup

### Step 1: Create New Workflow in N8N

1. Log in to N8N: https://n8n.srv1144822.hstgr.cloud
2. Click "Create New Workflow"
3. Name it: `WhatsApp Multi-Tenant Message Handler`

### Step 2: Add Webhook Node (Trigger)

1. Click the "+" button
2. Search for "Webhook"
3. Select "Webhook" node
4. Configure:
   - **HTTP Method**: POST
   - **Path**: `webhook/7833fb83-037f-4638-8e0e-07f064321816/webhook`
   - **Authentication**: None (backend forwards authenticated requests)
   - **Respond**: Immediately
   - **Response Code**: 200

### Step 3: Add Function Node (Extract Message Data)

1. Add a "Code" node after Webhook
2. Name it: `Extract Message Data`
3. Add this JavaScript code:

```javascript
// Extract data from backend payload
const tenantId = $input.item.json.tenantId;
const tenantName = $input.item.json.tenantName;
const phoneNumberId = $input.item.json.phoneNumberId;
const messages = $input.item.json.messages || [];
const contacts = $input.item.json.contacts || [];

// Get the first message
const message = messages[0];
if (!message) {
  return { json: { error: 'No message found' } };
}

const from = message.from; // Sender's phone number
const messageId = message.id;
const timestamp = message.timestamp;

// Extract message content based on type
let messageText = '';
let messageType = message.type;

switch (messageType) {
  case 'text':
    messageText = message.text?.body || '';
    break;
  case 'image':
    messageText = message.image?.caption || '[Image received]';
    break;
  case 'video':
    messageText = message.video?.caption || '[Video received]';
    break;
  case 'document':
    messageText = message.document?.caption || '[Document received]';
    break;
  case 'audio':
    messageText = '[Audio message received]';
    break;
  default:
    messageText = `[${messageType} message received]`;
}

// Get contact name if available
const contact = contacts[0];
const senderName = contact?.profile?.name || from;

return {
  json: {
    tenantId,
    tenantName,
    phoneNumberId,
    from,
    senderName,
    messageId,
    timestamp,
    messageType,
    messageText,
    fullMessage: message,
    fullContact: contact,
  },
};
```

### Step 4: Add Retell AI Node (Process with Voice Agent)

1. Add "HTTP Request" node
2. Name it: `Send to Retell AI`
3. Configure:
   - **Method**: POST
   - **URL**: `https://api.retellai.com/v2/create-web-call`
   - **Authentication**: Header Auth
     - Header Name: `Authorization`
     - Header Value: `Bearer sk-xxxxxxxxxxxx` (your Retell API key)
   - **Send Headers**: Yes
     - Add header: `Content-Type: application/json`
   - **Send Body**: Yes
   - **Body Content Type**: JSON
   - **Specify Body**: Using JSON

**Request Body:**

```json
{
  "agent_id": "agent_c0d0eb09c5c5f3745872b5617b",
  "metadata": {
    "tenantId": "={{ $json.tenantId }}",
    "phoneNumber": "={{ $json.from }}",
    "platform": "whatsapp"
  },
  "retell_llm_dynamic_variables": {
    "customer_name": "={{ $json.senderName }}",
    "message": "={{ $json.messageText }}"
  }
}
```

**Note**: This step is OPTIONAL. If you want to use Retell AI to process the message, keep this node. Otherwise, skip to Step 5.

### Step 5: Add Function Node (Prepare Reply)

1. Add a "Code" node
2. Name it: `Prepare WhatsApp Reply`
3. Add this JavaScript code:

```javascript
// Get the message data
const from = $('Extract Message Data').item.json.from;
const messageText = $('Extract Message Data').item.json.messageText;
const tenantId = $('Extract Message Data').item.json.tenantId;

// Simple echo reply (customize this based on your logic)
// You can integrate with Retell AI response here if you want
let replyText = '';

// Option 1: Simple auto-reply
replyText = `Hello! We received your message: "${messageText}". A team member will respond shortly.`;

// Option 2: Use Retell AI response (if you added Retell node)
// Uncomment this if you're using Retell:
// const retellResponse = $('Send to Retell AI').item.json;
// replyText = retellResponse.response_text || 'Thank you for your message!';

// Option 3: Custom logic based on message content
if (messageText.toLowerCase().includes('hello') || messageText.toLowerCase().includes('hi')) {
  replyText = 'Hello! How can I help you today?';
} else if (messageText.toLowerCase().includes('help')) {
  replyText =
    'Here are the options:\n1. Talk to sales\n2. Get support\n3. Learn more\n\nReply with a number.';
} else if (messageText === '1') {
  replyText = 'Connecting you to our sales team...';
} else if (messageText === '2') {
  replyText = 'Our support team will assist you shortly.';
} else if (messageText === '3') {
  replyText = 'Visit our website: https://example.com';
} else {
  replyText = `Thank you for your message! We'll get back to you soon.`;
}

return {
  json: {
    tenantId,
    to: from,
    type: 'text',
    text: {
      body: replyText,
    },
  },
};
```

### Step 6: Add HTTP Request Node (Send WhatsApp Reply)

1. Add "HTTP Request" node
2. Name it: `Send WhatsApp Reply via Proxy`
3. Configure:
   - **Method**: POST
   - **URL**: `https://embellics-app.onrender.com/api/proxy/={{ $json.tenantId }}/whatsapp/send`
   - **Authentication**: Header Auth
     - Header Name: `Authorization`
     - Header Value: `Bearer {{ $env.N8N_WEBHOOK_SECRET }}`
   - **Send Headers**: Yes
     - Add header: `Content-Type: application/json`
   - **Send Body**: Yes
   - **Body Content Type**: JSON
   - **Specify Body**: Using JSON

**Request Body:**

```json
{
  "to": "={{ $json.to }}",
  "type": "={{ $json.type }}",
  "text": {
    "body": "={{ $json.text.body }}"
  }
}
```

### Step 7: Add Environment Variable

1. In N8N, go to Settings → Environments
2. Add variable:
   - **Name**: `N8N_WEBHOOK_SECRET`
   - **Value**: Your N8N webhook secret (same as in backend .env)

## Testing the Workflow

### Test 1: Activate Workflow

1. Click "Activate" toggle in top-right
2. Save the workflow

### Test 2: Send Test WhatsApp Message

1. Send a message to your WhatsApp number: `+35345244992`
2. Example: "Hello"

### Test 3: Check Execution Logs

1. In N8N, go to "Executions" tab
2. You should see a new execution for your workflow
3. Click on it to see each node's output
4. Verify:
   - Webhook received the message ✓
   - Extract node parsed the data ✓
   - Prepare Reply node created response ✓
   - Send Reply node sent to proxy API ✓

### Test 4: Verify User Received Reply

1. Check your WhatsApp
2. You should receive the auto-reply

## Common Issues & Solutions

### Issue: "Workflow not found"

**Solution**: Make sure the webhook path matches exactly: `webhook/7833fb83-037f-4638-8e0e-07f064321816/webhook`

### Issue: "401 Unauthorized" when sending reply

**Solution**:

1. Check N8N_WEBHOOK_SECRET is set correctly
2. Verify it matches the secret in your backend .env
3. Check Authorization header format: `Bearer YOUR_SECRET`

### Issue: "No reply received"

**Solution**:

1. Check N8N execution logs for errors
2. Verify proxy API endpoint is correct
3. Check backend logs for incoming request
4. Verify WhatsApp access token is valid

### Issue: "Webhook receives message but doesn't execute"

**Solution**:

1. Make sure workflow is activated (toggle ON)
2. Check if webhook response is set to "Immediately"
3. Verify no errors in the Extract Message Data node

## Advanced Customization

### Add Message Logging

Add a "Postgres" node after Extract Message Data to log all incoming messages:

```sql
INSERT INTO chat_messages (tenant_id, phone_number, message_text, direction, created_at)
VALUES ($1, $2, $3, 'incoming', NOW())
```

### Add Business Hours Check

Add a "Code" node before Prepare Reply:

```javascript
const now = new Date();
const hour = now.getHours();
const day = now.getDay(); // 0 = Sunday, 6 = Saturday

const isBusinessHours = day >= 1 && day <= 5 && hour >= 9 && hour < 18;

return {
  json: {
    isBusinessHours,
    currentHour: hour,
    currentDay: day,
  },
};
```

Then use an "IF" node to send different replies for business hours vs after hours.

### Add Media Support

Extend the Extract Message Data node to handle images:

```javascript
if (messageType === 'image') {
  const imageId = message.image?.id;
  const caption = message.image?.caption || '';

  return {
    json: {
      ...previousData,
      mediaId: imageId,
      mediaType: 'image',
      caption,
    },
  };
}
```

## Workflow JSON Export

After creating the workflow, you can export it:

1. Click "..." menu in top-right
2. Select "Download"
3. Save as `whatsapp-multi-tenant-workflow.json`
4. Share with team members who can import it directly

## Next Steps

1. Create the workflow following steps above
2. Test with a simple message
3. Customize the reply logic in "Prepare Reply" node
4. Add database logging if needed
5. Set up business hours handling
6. Add media message support

## Support

If you encounter issues:

1. Check N8N execution logs
2. Check backend Render logs: https://dashboard.render.com
3. Verify WhatsApp Business API settings in Meta dashboard
4. Test proxy API endpoint directly with curl:
   ```bash
   curl -X POST https://embellics-app.onrender.com/api/proxy/84e33bb8-6a3a-49c0-8ea0-117f2e79bd79/whatsapp/send \
     -H "Authorization: Bearer YOUR_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"to":"353899644326","type":"text","text":{"body":"Test reply"}}'
   ```
