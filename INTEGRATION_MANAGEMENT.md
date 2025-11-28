# Integration Management Guide

## Overview

The Integration Management system allows platform administrators to configure and manage third-party integrations for each tenant. This includes:

- **WhatsApp Business API** - For WhatsApp messaging
- **SMS Providers** - Twilio, Vonage, or AWS SNS for SMS messaging
- **N8N Webhooks** - Custom workflow automation

All sensitive credentials are encrypted in the database using AES-256-GCM encryption and are never exposed in full to the frontend.

## Table of Contents

1. [Accessing Integration Management](#accessing-integration-management)
2. [WhatsApp Business API Setup](#whatsapp-business-api-setup)
3. [SMS Provider Setup](#sms-provider-setup)
4. [N8N Webhook Management](#n8n-webhook-management)
5. [Webhook Analytics](#webhook-analytics)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Accessing Integration Management

### Prerequisites

- You must be logged in as a **Platform Admin**
- At least one tenant must exist in the system

### Navigation Steps

1. Log in to the platform admin dashboard
2. Navigate to **Platform Administration** page
3. Click on the **Integrations** tab
4. Select a tenant from the dropdown

Once a tenant is selected, you'll see three configuration tabs:

- **WhatsApp** - Configure WhatsApp Business API
- **SMS** - Configure SMS provider
- **N8N Webhooks** - Manage workflow webhooks and view analytics

---

## WhatsApp Business API Setup

### What You'll Need

Before configuring WhatsApp integration, gather the following from your Facebook Business Manager:

- **Phone Number ID** - The ID of your WhatsApp Business phone number
- **Business Account ID** - Your WhatsApp Business Account ID
- **Access Token** - Permanent access token from Facebook Graph API
- **Webhook Verify Token** - Token for webhook verification
- **Phone Number** - The actual phone number (display only)

### Step-by-Step Setup

1. **Navigate to WhatsApp Tab**
   - Select your tenant in the Integrations page
   - Click on the **WhatsApp** tab

2. **Enable WhatsApp**
   - Toggle the "Enable WhatsApp" switch to ON

3. **Enter Configuration**

   ```
   Phone Number ID: [Your phone number ID from Facebook]
   Business Account ID: [Your business account ID]
   Access Token: [Your permanent access token]
   Webhook Verify Token: [Your chosen verify token]
   Phone Number: [Your WhatsApp number, e.g., +1234567890]
   ```

4. **Save Configuration**
   - Click **Save WhatsApp Configuration**
   - You'll see a success toast notification
   - The access token will be encrypted and masked in the UI

### Getting Facebook Credentials

1. **Facebook Business Manager**
   - Go to https://business.facebook.com/
   - Navigate to **Business Settings** → **WhatsApp Accounts**
   - Select your WhatsApp Business Account

2. **Phone Number ID**
   - Click on your phone number
   - Copy the **Phone Number ID** from the URL or settings

3. **Access Token**
   - Go to **System Users** → Create a system user
   - Generate a permanent token with `whatsapp_business_messaging` permission
   - **Important**: Copy and save this token immediately (shown only once)

4. **Business Account ID**
   - Found in **Business Settings** → **WhatsApp Accounts**
   - Or in the URL when viewing your account

5. **Webhook Verify Token**
   - Choose a random secret string (e.g., `my_verify_token_123`)
   - Use this same token when setting up Facebook webhooks

### Security Notes

- The Access Token is encrypted in the database
- The frontend only shows masked values: `EAATestAcc***456789`
- To update the token, simply enter a new value and save
- Leave fields blank to keep existing values

---

## SMS Provider Setup

### Supported Providers

- **Twilio** - Most popular, easy to use
- **Vonage** (formerly Nexmo) - Good international coverage
- **AWS SNS** - For AWS-integrated systems

### Step-by-Step Setup

1. **Navigate to SMS Tab**
   - Select your tenant in the Integrations page
   - Click on the **SMS** tab

2. **Enable SMS**
   - Toggle the "Enable SMS" switch to ON

3. **Select Provider**
   - Choose from the dropdown: Twilio, Vonage, or AWS SNS

4. **Enter Provider-Specific Configuration** (see below)

5. **Save Configuration**
   - Click **Save SMS Configuration**
   - Credentials will be encrypted and stored securely

---

### Twilio Setup

#### What You'll Need

- Twilio Account SID
- Twilio Auth Token
- Twilio Phone Number
- Messaging Service SID (optional, for advanced features)

#### Getting Twilio Credentials

1. **Sign up for Twilio**
   - Go to https://www.twilio.com/
   - Create an account or log in

2. **Find Account SID**
   - Go to **Console Dashboard**
   - Copy **Account SID** from the project info

3. **Find Auth Token**
   - On the same dashboard
   - Click **Show** next to **Auth Token**
   - Copy the token

4. **Get Phone Number**
   - Go to **Phone Numbers** → **Manage** → **Active Numbers**
   - Copy your Twilio phone number (format: +1234567890)

5. **Messaging Service SID** (Optional)
   - Go to **Messaging** → **Services**
   - Create a messaging service if needed
   - Copy the **Service SID**

#### Configuration Fields

```
Provider: Twilio
Account SID: [Your Account SID]
Auth Token: [Your Auth Token]
Phone Number: [Your Twilio phone, e.g., +15551234567]
Messaging Service SID: [Optional - for advanced features]
```

---

### Vonage Setup

#### What You'll Need

- Vonage API Key
- Vonage API Secret
- Vonage Phone Number or Brand Name

#### Getting Vonage Credentials

1. **Sign up for Vonage**
   - Go to https://www.vonage.com/communications-apis/
   - Create an account or log in

2. **Find API Credentials**
   - Go to **Dashboard** → **API Settings**
   - Copy **API Key** and **API Secret**

3. **Get Phone Number**
   - Go to **Numbers** → **Your Numbers**
   - Copy your virtual number or brand name

#### Configuration Fields

```
Provider: Vonage
API Key: [Your API Key]
API Secret: [Your API Secret]
From: [Your Vonage number or brand name]
```

---

### AWS SNS Setup

#### What You'll Need

- AWS Access Key ID
- AWS Secret Access Key
- AWS Region (e.g., us-east-1)
- Sender ID or Phone Number

#### Getting AWS Credentials

1. **AWS IAM Console**
   - Go to AWS IAM Console
   - Create a new IAM user with SNS permissions

2. **Generate Access Keys**
   - Select the user → **Security Credentials**
   - Click **Create Access Key**
   - Download and save the **Access Key ID** and **Secret Access Key**

3. **Configure SNS**
   - Go to **SNS Console**
   - Ensure SNS is enabled in your desired region
   - Note the region code (e.g., us-east-1)

#### Configuration Fields

```
Provider: AWS SNS
Access Key ID: [Your AWS Access Key ID]
Secret Access Key: [Your AWS Secret Access Key]
Region: [AWS region, e.g., us-east-1]
Phone Number: [Your sender phone or ID]
```

---

## N8N Webhook Management

### Overview

N8N webhooks allow you to trigger custom workflows from your application. Each tenant can have multiple webhooks for different workflows.

### N8N Base Configuration

Before adding webhooks, configure the base settings:

1. **N8N Base URL**
   - Format: `https://n8n.hostinger.com/webhook/[tenant-id]`
   - This is the base path for all webhooks for this tenant

2. **API Key** (Optional)
   - If your N8N instance requires authentication
   - Will be encrypted and stored securely

### Adding Webhooks

1. **Click "Add Webhook"** button
2. **Fill in Webhook Details**:
   - **Workflow Name** - Unique identifier (e.g., `contact_form`, `booking_request`)
   - **Webhook URL** - Full URL to the N8N webhook endpoint
   - **Description** - What this webhook does (optional)
   - **Auth Token** - Optional Bearer token for authentication
   - **Active** - Toggle to enable/disable the webhook

3. **Save** - The webhook will be created and ready to use

### Example Webhook Configuration

```
Workflow Name: contact_form
Webhook URL: https://n8n.hostinger.com/webhook/7df3131d-c135-4e98-937a-40e846e57d83/contact
Description: Processes contact form submissions
Auth Token: [Optional - your secret token]
Active: ✓ Enabled
```

### Editing Webhooks

1. Click the **Edit** (pencil) icon next to a webhook
2. Modify any fields except **Workflow Name** (immutable)
3. Save changes

**Note**: The Workflow Name cannot be changed after creation. If you need a different name, delete and recreate the webhook.

### Deleting Webhooks

1. Click the **Delete** (trash) icon next to a webhook
2. Confirm deletion in the dialog
3. The webhook and all its analytics data will be deleted

**Warning**: Deletion is permanent and cannot be undone!

### Webhook Status

Each webhook can be:

- **Active** (green badge) - Enabled and ready to receive calls
- **Disabled** (gray badge) - Temporarily disabled, won't be called

### Calling Webhooks Programmatically

Use the webhook service in your backend code:

```typescript
import { callWebhook, callWebhookByName } from '@/services/webhookService';

// Option 1: Call by webhook ID
const result = await callWebhook({
  webhookId: 'abc-123-def-456',
  payload: {
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello!',
  },
});

// Option 2: Call by workflow name
const result = await callWebhookByName('tenant-id-here', 'contact_form', {
  name: 'Jane Smith',
  email: 'jane@example.com',
});

// Option 3: Broadcast to all tenant webhooks
const results = await callAllTenantWebhooks('tenant-id-here', { event: 'tenant_updated' });
```

### Webhook Service Features

- **Automatic Retries** - Failed calls are retried 3 times with exponential backoff
- **Timeout Protection** - 30-second timeout prevents hanging requests
- **Error Handling** - Client errors (4xx) don't retry, server errors (5xx) do
- **Analytics Tracking** - All calls are logged to webhook_analytics table
- **Statistics Updates** - totalCalls, successfulCalls, failedCalls tracked per webhook
- **Auth Token Handling** - Tokens are automatically decrypted and added as Bearer tokens

---

## Webhook Analytics

### Overview

The analytics dashboard provides real-time insights into webhook performance.

### Summary Cards

**Total Calls** - Total number of webhook calls across all webhooks  
**Successful** - Calls that returned 2xx status codes  
**Failed** - Calls that returned errors or timeouts  
**Avg Response** - Average response time in milliseconds

### Webhook Performance Table

Shows per-webhook statistics:

- Workflow Name
- Status (Active/Disabled)
- Total Calls
- Successful Calls
- Failed Calls
- Success Rate (color-coded badge)
  - Green: ≥95% success rate
  - Yellow: 80-94% success rate
  - Red: <80% success rate
- Last Called timestamp

### Recent Webhook Calls

Displays the last 50 webhook calls with:

- Timestamp
- Webhook name
- Status badge (green for success, red for failure)
- Response time in milliseconds
- Error message (if failed)

### Filters

**Webhook Filter** - View analytics for a specific webhook or all webhooks  
**Time Range Filter**:

- Last Hour
- Last 24 Hours
- Last 7 Days
- Last 30 Days

### Auto-Refresh

The analytics dashboard automatically refreshes every 30 seconds to show the latest data.

---

## Security Best Practices

### Credential Management

1. **Never Share Credentials**
   - Treat all API keys, tokens, and secrets as sensitive
   - Don't share them in emails, Slack, or documentation

2. **Rotate Regularly**
   - Rotate access tokens every 90 days minimum
   - Update credentials immediately if compromised

3. **Use Separate Credentials Per Environment**
   - Use test/sandbox credentials for development
   - Use production credentials only in production

4. **Limit Permissions**
   - Grant minimum required permissions
   - Don't use admin/owner accounts for API access

### Platform Security

1. **Encryption at Rest**
   - All credentials are encrypted with AES-256-GCM
   - Each field has a unique initialization vector (IV)
   - Authenticated encryption prevents tampering

2. **Encryption in Transit**
   - All API calls use HTTPS/TLS
   - Credentials are never sent in plain text

3. **Access Control**
   - Only platform admins can view/modify integrations
   - Regular users cannot access this page
   - JWT-based authentication with role checks

4. **Masked Display**
   - Frontend only shows masked values (e.g., `EAATestAcc***456789`)
   - Full values never exposed in client-side code
   - API responses mask sensitive data

### Best Practices for Webhooks

1. **Use Auth Tokens**
   - Always configure auth tokens for webhooks
   - Use strong, random tokens (at least 32 characters)
   - Rotate tokens periodically

2. **Validate Webhook Calls**
   - In your N8N workflows, validate incoming auth tokens
   - Check payload structure and required fields
   - Return appropriate HTTP status codes

3. **Rate Limiting**
   - Implement rate limiting in N8N to prevent abuse
   - Monitor for unusual traffic patterns

4. **Error Handling**
   - Return 4xx for invalid requests (no retry)
   - Return 5xx for temporary failures (will retry)
   - Include helpful error messages in responses

---

## Troubleshooting

### WhatsApp Issues

#### Problem: "Invalid Access Token"

**Solution**:

- Verify the token is a **permanent token**, not temporary
- Check token has `whatsapp_business_messaging` permission
- Ensure token hasn't expired (Facebook tokens can expire)
- Regenerate token in Facebook Business Manager

#### Problem: "Phone Number Not Found"

**Solution**:

- Verify Phone Number ID is correct
- Ensure phone number is approved and active
- Check business verification status in Facebook

#### Problem: "Webhook Verification Failed"

**Solution**:

- Ensure Webhook Verify Token matches Facebook webhook settings
- Check webhook URL is accessible from Facebook servers
- Verify HTTPS is enabled on your webhook endpoint

---

### SMS Issues

#### Problem: "Authentication Failed" (Twilio)

**Solution**:

- Double-check Account SID and Auth Token
- Ensure there are no extra spaces or characters
- Verify account is active and not suspended

#### Problem: "Invalid Phone Number"

**Solution**:

- Phone numbers must include country code (e.g., +1 for US)
- Format: +[country][number] (no spaces or dashes)
- Verify number is verified in Twilio/Vonage

#### Problem: "Insufficient Funds"

**Solution**:

- Check account balance in Twilio/Vonage dashboard
- Add credits or enable auto-recharge
- Monitor usage to prevent unexpected costs

---

### N8N Webhook Issues

#### Problem: "Webhook Not Found" (404)

**Solution**:

- Verify Webhook URL is correct
- Check N8N workflow is active (not paused)
- Ensure N8N instance is running and accessible

#### Problem: "Timeout Error"

**Solution**:

- N8N workflow is taking too long (>30 seconds)
- Optimize workflow to respond faster
- Use asynchronous processing for slow tasks
- Consider increasing timeout (modify webhookService.ts)

#### Problem: "Unauthorized" (401)

**Solution**:

- Check Auth Token is correct
- Verify N8N workflow expects Bearer token format
- Ensure token hasn't been changed in N8N

#### Problem: "Internal Server Error" (500)

**Solution**:

- Check N8N logs for error details
- Verify workflow nodes are configured correctly
- Test workflow manually in N8N editor

#### Problem: "Webhook Not Being Called"

**Solution**:

- Check webhook status is **Active** (not disabled)
- Verify webhook is being triggered in your code
- Check application logs for errors
- Look for error messages in webhook analytics

---

### Analytics Issues

#### Problem: "No Analytics Data"

**Solution**:

- Ensure webhooks have been called at least once
- Check time range filter (may need to expand)
- Verify analytics are being logged (check database)

#### Problem: "Analytics Not Updating"

**Solution**:

- Wait for auto-refresh (30 seconds)
- Manually refresh the page
- Check browser console for errors
- Verify API endpoint is accessible

---

### General Issues

#### Problem: "Changes Not Saving"

**Solution**:

- Check for validation errors in form
- Look for error toast notifications
- Verify platform admin permissions
- Check browser console for JavaScript errors

#### Problem: "Data Not Loading"

**Solution**:

- Refresh the page
- Check network tab for failed requests
- Verify authentication token is valid
- Check database connection

#### Problem: "Masked Values Not Updating"

**Solution**:

- Masked values show first 10 + last 6 characters
- If value changed successfully, you'll see success toast
- Full value is never shown for security
- To verify, check behavior (e.g., send test WhatsApp message)

---

## API Reference

### Integration Endpoints

All endpoints require **Platform Admin** authentication.

#### Get Tenant Integration

```
GET /api/platform/tenants/:tenantId/integrations
```

Returns masked integration configuration for a tenant.

#### Update WhatsApp Configuration

```
PUT /api/platform/tenants/:tenantId/integrations/whatsapp
Content-Type: application/json

{
  "enabled": true,
  "phoneNumberId": "123456789",
  "businessAccountId": "987654321",
  "accessToken": "EAATestAccessToken...",
  "webhookVerifyToken": "my_verify_token",
  "phoneNumber": "+1234567890"
}
```

#### Update SMS Configuration

```
PUT /api/platform/tenants/:tenantId/integrations/sms
Content-Type: application/json

{
  "enabled": true,
  "provider": "twilio",
  "accountSid": "ACxxxxx",
  "authToken": "auth_token_here",
  "phoneNumber": "+15551234567",
  "messagingServiceSid": "MGxxxxx"
}
```

#### Update N8N Configuration

```
PUT /api/platform/tenants/:tenantId/integrations/n8n
Content-Type: application/json

{
  "baseUrl": "https://n8n.hostinger.com/webhook/tenant-id",
  "apiKey": "optional_api_key"
}
```

### Webhook Endpoints

#### List Webhooks

```
GET /api/platform/tenants/:tenantId/webhooks
```

#### Create Webhook

```
POST /api/platform/tenants/:tenantId/webhooks
Content-Type: application/json

{
  "workflowName": "contact_form",
  "webhookUrl": "https://n8n.hostinger.com/webhook/tenant-id/contact",
  "description": "Contact form submissions",
  "authToken": "optional_bearer_token",
  "isActive": true
}
```

#### Update Webhook

```
PUT /api/platform/tenants/:tenantId/webhooks/:webhookId
Content-Type: application/json

{
  "description": "Updated description",
  "isActive": false
}
```

#### Delete Webhook

```
DELETE /api/platform/tenants/:tenantId/webhooks/:webhookId
```

### Analytics Endpoints

#### Get Analytics Summary

```
GET /api/platform/tenants/:tenantId/webhooks/analytics/summary
```

Returns total calls, successful calls, failed calls, average response time.

#### Get Webhook Analytics

```
GET /api/platform/tenants/:tenantId/webhooks/:webhookId/analytics
```

Returns all analytics entries for a specific webhook.

---

## Support

For technical support or questions:

- Check this documentation first
- Review the [Troubleshooting](#troubleshooting) section
- Check application logs for error messages
- Contact your platform administrator

---

## Changelog

### Version 1.0.0 (November 2025)

- Initial release
- WhatsApp Business API integration
- SMS integration (Twilio, Vonage, AWS SNS)
- N8N webhook management
- Real-time analytics dashboard
- AES-256-GCM encryption for credentials
- Auto-retry logic with exponential backoff
- Comprehensive error handling

---

_Last Updated: November 28, 2025_
