# Tenant Integrations Implementation

## 🎯 Overview

This document describes the **multi-tenant integration management system** built for securely storing and managing tenant-specific credentials for WhatsApp, SMS, N8N webhooks, and other third-party services.

**Status**: Backend infrastructure complete ✅  
**Date**: November 28, 2025  
**Next Steps**: API endpoints, UI, and testing

---

## 🏗️ Architecture

### Design Philosophy

**Hybrid Security Model:**

- **Platform-level secrets** → Render.com environment variables (shared infrastructure)
- **Tenant-specific credentials** → PostgreSQL database with AES-256-GCM encryption

### Why This Approach?

For a multi-tenant SaaS with **unique credentials per tenant**:

- ✅ Scales to unlimited tenants without code changes
- ✅ Each tenant has isolated, encrypted credentials
- ✅ Platform admins manage integrations via UI
- ✅ No hardcoded secrets in codebase
- ✅ Audit trail of who made changes
- ✅ Easy credential rotation per tenant

---

## 📊 Database Schema

### 1. `tenant_integrations` Table

Stores all third-party service configurations per tenant (one row per tenant).

```typescript
{
  id: string; // Primary key
  tenantId: string; // Foreign key to tenants (unique)

  // N8N Configuration
  n8nBaseUrl: string | null; // e.g., "https://n8n.hostinger.com/webhook/tenant123"
  n8nApiKey: string | null; // ENCRYPTED - Optional API key for n8n auth

  // WhatsApp Business API
  whatsappEnabled: boolean; // Enable/disable WhatsApp
  whatsappConfig: JSONB | null; // Encrypted JSON (see structure below)

  // SMS Provider (Twilio, Vonage, AWS SNS)
  smsEnabled: boolean; // Enable/disable SMS
  smsConfig: JSONB | null; // Encrypted JSON (see structure below)

  // Audit Trail
  updatedAt: timestamp;
  updatedBy: string | null; // Platform admin who made changes
  createdAt: timestamp;
  createdBy: string | null; // Platform admin who created
}
```

**WhatsApp Config Structure** (JSONB with encrypted fields):

```json
{
  "phoneNumberId": "915998021588678",
  "businessAccountId": "1471345127284298",
  "accessToken": "ENCRYPTED_EAA...", // <- Encrypted
  "webhookVerifyToken": "ENCRYPTED_verify...", // <- Encrypted
  "phoneNumber": "+91 599 8021 588" // Display only
}
```

**SMS Config Structure** (JSONB with encrypted fields):

```json
{
  "provider": "twilio", // or "vonage", "aws_sns"
  "accountSid": "ENCRYPTED_AC...", // <- Encrypted
  "authToken": "ENCRYPTED_token...", // <- Encrypted
  "phoneNumber": "+1234567890",
  "messagingServiceSid": "MG..." // Optional (Twilio)
}
```

---

### 2. `n8n_webhooks` Table

Separate table for managing **20+ dynamic webhooks** per tenant.

```typescript
{
  id: string; // Primary key
  tenantId: string; // Foreign key to tenants
  workflowName: string; // e.g., "contact_form", "booking_request"
  webhookUrl: string; // Full URL: "https://n8n.hostinger.com/webhook/..."
  description: string | null; // Optional description
  isActive: boolean; // Enable/disable individual webhook
  authToken: string | null; // ENCRYPTED - Optional per-webhook auth

  // Usage Tracking
  lastCalledAt: timestamp | null;
  totalCalls: number; // Total times called
  successfulCalls: number; // Successful (2xx) responses
  failedCalls: number; // Failed responses

  createdAt: timestamp;
  updatedAt: timestamp;
  createdBy: string | null; // Platform admin
}
```

**Unique Constraint**: `(tenantId, workflowName)` - prevents duplicate workflow names per tenant.

---

### 3. `webhook_analytics` Table

Tracks **every webhook call** for monitoring, debugging, and analytics.

```typescript
{
  id: string; // Primary key
  tenantId: string; // Foreign key to tenants
  webhookId: string; // Foreign key to n8n_webhooks

  // Request Details
  requestPayload: JSONB | null; // What was sent
  requestHeaders: JSONB | null; // Headers (sanitized - no auth)

  // Response Details
  statusCode: number | null; // HTTP status (200, 500, etc.)
  responseBody: JSONB | null; // Response from n8n
  responseTime: number | null; // Milliseconds

  // Status
  success: boolean; // True if 2xx status
  errorMessage: string | null; // Error details if failed

  // Context
  triggeredBy: string | null; // "widget_chat", "api_call", etc.
  metadata: JSONB | null; // Additional context

  timestamp: timestamp;
}
```

**Index**: `(tenantId, webhookId, timestamp)` for fast queries.

---

## 🔐 Encryption System

### Enhanced `server/encryption.ts`

New utilities for handling tenant integrations:

#### Generic Encryption

```typescript
encrypt(plaintext: string): string
decrypt(encrypted: string): string
```

#### JSONB Field Encryption

```typescript
// Encrypt specific fields in an object
encryptJSONBFields<T>(data: T, fieldsToEncrypt: string[]): T

// Decrypt specific fields in an object
decryptJSONBFields<T>(data: T, fieldsToDecrypt: string[]): T | null
```

#### WhatsApp/SMS Helpers

```typescript
// Encrypt all sensitive fields in WhatsApp config
encryptWhatsAppConfig(config: WhatsAppConfig): WhatsAppConfig

// Decrypt WhatsApp config
decryptWhatsAppConfig(config: WhatsAppConfig | null): WhatsAppConfig | null

// Encrypt SMS config
encryptSMSConfig(config: SMSConfig): SMSConfig

// Decrypt SMS config
decryptSMSConfig(config: SMSConfig | null): SMSConfig | null
```

#### Token Masking (for UI display)

```typescript
// Masks token: "sk_live_abc123xyz789..." -> "sk_live_***xyz789"
maskToken(token: string): string

// For long tokens (WhatsApp): shows first 10 & last 6 chars
maskLongToken(token: string): string

// Mask entire config for safe display
maskWhatsAppConfig(config: WhatsAppConfig | null): Partial<WhatsAppConfig> | null
maskSMSConfig(config: SMSConfig | null): Partial<SMSConfig> | null
```

### Encryption Algorithm

- **AES-256-GCM** (Galois/Counter Mode)
- **Master Key**: 64-char hex string (256 bits) from `ENCRYPTION_KEY` env var
- **Format**: `{IV}:{AuthTag}:{Encrypted}` (all hex-encoded)
- **Security**: Authenticated encryption prevents tampering

---

## 💾 Storage Layer (`server/storage.ts`)

### Tenant Integrations Methods

```typescript
// Get integration config for tenant
getTenantIntegration(tenantId: string): Promise<TenantIntegration | undefined>

// Create integration config
createTenantIntegration(integration: InsertTenantIntegration): Promise<TenantIntegration>

// Update integration config
updateTenantIntegration(
  tenantId: string,
  updates: Partial<InsertTenantIntegration>
): Promise<TenantIntegration | undefined>

// Delete integration config
deleteTenantIntegration(tenantId: string): Promise<void>
```

### N8N Webhooks Methods

```typescript
// Get webhook by ID
getN8nWebhook(id: string): Promise<N8nWebhook | undefined>

// Get all webhooks for tenant
getN8nWebhooksByTenant(tenantId: string): Promise<N8nWebhook[]>

// Get webhook by name
getN8nWebhookByName(tenantId: string, workflowName: string): Promise<N8nWebhook | undefined>

// Get only active webhooks
getActiveN8nWebhooks(tenantId: string): Promise<N8nWebhook[]>

// Create webhook
createN8nWebhook(webhook: InsertN8nWebhook): Promise<N8nWebhook>

// Update webhook
updateN8nWebhook(id: string, updates: Partial<InsertN8nWebhook>): Promise<N8nWebhook | undefined>

// Increment usage stats (auto-tracked on calls)
incrementWebhookStats(id: string, success: boolean): Promise<void>

// Delete webhook
deleteN8nWebhook(id: string, tenantId: string): Promise<void>
```

### Webhook Analytics Methods

```typescript
// Create analytics record (auto-called on webhook execution)
createWebhookAnalytics(analytics: InsertWebhookAnalytics): Promise<WebhookAnalytics>

// Get analytics for specific webhook (last 100 calls)
getWebhookAnalytics(webhookId: string, limit?: number): Promise<WebhookAnalytics[]>

// Get analytics for tenant (with date range)
getWebhookAnalyticsByTenant(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<WebhookAnalytics[]>

// Get summary statistics
getWebhookAnalyticsSummary(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
}>

// Cleanup old analytics (for archiving)
deleteOldWebhookAnalytics(olderThanDays: number): Promise<void>
```

---

## 🌐 Recommended N8N Webhook URL Structure

### Pattern:

```
{base_url}/{tenant_id}/{workflow_name}
```

### Examples:

```
https://n8n.hostinger.com/webhook/tenant_abc123/contact-form
https://n8n.hostinger.com/webhook/tenant_abc123/booking-request
https://n8n.hostinger.com/webhook/tenant_abc123/support-ticket
https://n8n.hostinger.com/webhook/tenant_abc123/payment-notification
... (16+ more)
```

### Alternative (Tenant Slug):

```
https://n8n.hostinger.com/webhook/acme-corp/contact-form
https://n8n.hostinger.com/webhook/acme-corp/booking-request
```

### Benefits:

- ✅ **Debuggable**: Instantly see which tenant from URL
- ✅ **No credential exposure**: Credentials in DB, not URL
- ✅ **Easy routing**: Extract `tenantId` from path
- ✅ **Audit-friendly**: Logs show tenant context

---

## 🔑 Environment Variables

### Platform-Level (Render.com)

Store these in Render's environment variables (shared across all tenants):

```bash
# Core Infrastructure
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=your-64-char-hex-string    # CRITICAL for decryption!
SESSION_SECRET=your-session-secret

# Platform SMTP (for user invitations)
SMTP_HOST=smtp.gmail.com
SMTP_USER=platform@embellics.com
SMTP_PASS=your-app-password

# App Config
APP_URL=https://app.embellics.com
PORT=3000
NODE_ENV=production
```

### Tenant-Level (Database)

**Never** store in environment variables:

- ❌ WhatsApp access tokens
- ❌ SMS API keys
- ❌ N8N webhook URLs
- ❌ Retell AI API keys (already in `widgetConfigs`)

These go in the **database**, encrypted with `ENCRYPTION_KEY`.

---

## ✅ Completed Tasks

### 1. ✅ Database Cleanup Script

- **File**: `scripts/clean-database-preserve-admin.ts`
- **Purpose**: Wipe all data except platform admin for fresh testing
- **Command**: `npm run clean-db:preserve-admin`
- **Result**: Database clean, ready for testing

### 2. ✅ Database Schema

- **File**: `shared/schema.ts`
- **Added**:
  - `tenant_integrations` table
  - `n8n_webhooks` table
  - `webhook_analytics` table
- **Migration**: Applied via `npm run db:push`

### 3. ✅ Encryption Enhancements

- **File**: `server/encryption.ts`
- **Added**:
  - Generic `encrypt()` / `decrypt()`
  - JSONB field encryption helpers
  - WhatsApp/SMS config encryption
  - Token masking utilities
- **Algorithm**: AES-256-GCM

### 4. ✅ Storage Layer

- **File**: `server/storage.ts`
- **Added**: 15+ methods for:
  - Tenant integrations CRUD
  - N8N webhooks management
  - Webhook analytics tracking
- **Type Safety**: Full TypeScript types from schema

### 5. ✅ Configuration

- **File**: `drizzle.config.ts`
- **Update**: Added dotenv support for local development

---

## 🚧 Next Steps (Pending Implementation)

### 1. API Endpoints (Platform Admin Only)

Create routes in `server/routes.ts`:

```typescript
// Tenant Integrations
POST   /api/platform/tenants/:id/integrations/whatsapp
PUT    /api/platform/tenants/:id/integrations/whatsapp
DELETE /api/platform/tenants/:id/integrations/whatsapp

POST   /api/platform/tenants/:id/integrations/sms
PUT    /api/platform/tenants/:id/integrations/sms
DELETE /api/platform/tenants/:id/integrations/sms

// N8N Webhooks
GET    /api/platform/tenants/:id/webhooks
POST   /api/platform/tenants/:id/webhooks
PUT    /api/platform/tenants/:id/webhooks/:webhookId
DELETE /api/platform/tenants/:id/webhooks/:webhookId

// Webhook Analytics
GET    /api/platform/tenants/:id/webhooks/:webhookId/analytics
GET    /api/platform/tenants/:id/webhooks/analytics/summary
```

### 2. Webhook Service

Create `server/services/webhookService.ts`:

```typescript
class WebhookService {
  // Call N8N webhook with error handling and analytics
  async callWebhook(tenantId: string, workflowName: string, payload: any): Promise<any>;

  // Retry logic for failed webhooks
  async callWebhookWithRetry(
    tenantId: string,
    workflowName: string,
    payload: any,
    maxRetries: number = 3,
  ): Promise<any>;
}
```

Features:

- ✅ Automatic analytics logging
- ✅ Error handling & retries
- ✅ Stats tracking (auto-increment counters)
- ✅ Timeout handling

### 3. Platform Admin UI

Update `client/src/pages/platform-admin.tsx`:

Add **Integrations** tab with:

- WhatsApp config form
- SMS config form
- N8N webhooks table (CRUD)
- Masked credential display
- Analytics dashboard

### 4. Webhook Analytics Dashboard

Create charts showing:

- Success/failure rates
- Response time trends
- Error logs
- Per-webhook performance

### 5. Documentation

Create `INTEGRATION_MANAGEMENT.md`:

- Platform admin guide
- How to configure WhatsApp
- How to add N8N webhooks
- How to view analytics
- Troubleshooting

### 6. Testing

Test complete workflow:

1. Create tenant
2. Configure WhatsApp integration
3. Add 20+ N8N webhooks
4. Call webhooks programmatically
5. View analytics
6. Update/delete integrations

---

## 🔒 Security Checklist

### ✅ Completed

- [x] Master encryption key in environment variable
- [x] AES-256-GCM encryption for sensitive fields
- [x] Encrypted JSONB fields (WhatsApp, SMS configs)
- [x] Token masking for UI display
- [x] Database-level tenant isolation
- [x] Audit trail (createdBy, updatedBy)

### 🚧 Pending

- [ ] Platform admin-only access enforcement (route middleware)
- [ ] Input validation (Zod schemas for configs)
- [ ] Rate limiting on webhook calls
- [ ] HTTPS enforcement for webhook URLs
- [ ] Credential rotation workflows
- [ ] Backup/restore for encrypted data

---

## 📖 Usage Examples

### Creating a Tenant Integration

```typescript
import { storage } from './server/storage';
import { encryptWhatsAppConfig } from './server/encryption';

// Platform admin creates WhatsApp config for tenant
const whatsappConfig = {
  phoneNumberId: '915998021588678',
  businessAccountId: '1471345127284298',
  accessToken: 'EAA...', // Will be encrypted
  webhookVerifyToken: 'verify...', // Will be encrypted
  phoneNumber: '+91 599 8021 588',
};

const encrypted = encryptWhatsAppConfig(whatsappConfig);

await storage.createTenantIntegration({
  tenantId: 'tenant_123',
  whatsappEnabled: true,
  whatsappConfig: encrypted,
  createdBy: platformAdminUserId,
});
```

### Adding N8N Webhooks

```typescript
// Add multiple webhooks for a tenant
const webhooks = [
  {
    tenantId: 'tenant_123',
    workflowName: 'contact_form',
    webhookUrl: 'https://n8n.hostinger.com/webhook/tenant123/contact',
    description: 'Handles contact form submissions',
    isActive: true,
    createdBy: platformAdminUserId,
  },
  {
    tenantId: 'tenant_123',
    workflowName: 'booking_request',
    webhookUrl: 'https://n8n.hostinger.com/webhook/tenant123/booking',
    description: 'Handles appointment booking requests',
    isActive: true,
    createdBy: platformAdminUserId,
  },
  // ... 18+ more
];

for (const webhook of webhooks) {
  await storage.createN8nWebhook(webhook);
}
```

### Calling a Webhook

```typescript
// In your app code (future webhookService)
import { storage } from './server/storage';

async function sendContactFormToN8N(tenantId: string, formData: any) {
  // Get webhook
  const webhook = await storage.getN8nWebhookByName(tenantId, 'contact_form');

  if (!webhook || !webhook.isActive) {
    throw new Error('Contact form webhook not configured');
  }

  // Call webhook
  const startTime = Date.now();
  try {
    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const responseTime = Date.now() - startTime;
    const success = response.ok;

    // Log analytics
    await storage.createWebhookAnalytics({
      tenantId,
      webhookId: webhook.id,
      requestPayload: formData,
      statusCode: response.status,
      responseBody: await response.json(),
      responseTime,
      success,
      triggeredBy: 'contact_form_widget',
    });

    // Update stats
    await storage.incrementWebhookStats(webhook.id, success);

    return response;
  } catch (error) {
    // Log error
    await storage.createWebhookAnalytics({
      tenantId,
      webhookId: webhook.id,
      requestPayload: formData,
      success: false,
      errorMessage: error.message,
      responseTime: Date.now() - startTime,
      triggeredBy: 'contact_form_widget',
    });

    await storage.incrementWebhookStats(webhook.id, false);
    throw error;
  }
}
```

### Viewing Analytics

```typescript
// Get summary for last 30 days
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

const summary = await storage.getWebhookAnalyticsSummary(tenantId, startDate, new Date());

console.log(`Total Calls: ${summary.totalCalls}`);
console.log(`Success Rate: ${((summary.successfulCalls / summary.totalCalls) * 100).toFixed(2)}%`);
console.log(`Avg Response Time: ${summary.averageResponseTime}ms`);
```

---

## 🎯 Success Criteria

The implementation will be complete when:

1. ✅ Database schema deployed
2. ✅ Encryption utilities working
3. ✅ Storage methods tested
4. ⏳ API endpoints created (platform admin only)
5. ⏳ Webhook service implemented
6. ⏳ UI for integration management
7. ⏳ Analytics dashboard working
8. ⏳ End-to-end testing passed
9. ⏳ Documentation complete
10. ⏳ Deployed to production

**Current Progress**: 3/10 (30%) - Backend infrastructure complete ✅

---

## 📚 Related Files

### Core Implementation

- `shared/schema.ts` - Database schema definitions
- `server/encryption.ts` - Encryption utilities
- `server/storage.ts` - Database access layer
- `scripts/clean-database-preserve-admin.ts` - Cleanup script

### Configuration

- `drizzle.config.ts` - Database migrations config
- `package.json` - NPM scripts

### Documentation

- `TENANT_INTEGRATIONS_IMPLEMENTATION.md` (this file)

### Pending

- `server/routes.ts` - API endpoints (to be added)
- `server/services/webhookService.ts` - Webhook calling service (to be created)
- `client/src/pages/platform-admin.tsx` - UI updates (to be added)
- `INTEGRATION_MANAGEMENT.md` - Admin guide (to be created)

---

## 💡 Key Design Decisions

### Why Separate `n8n_webhooks` Table?

**Alternative**: Store webhooks in JSONB field in `tenant_integrations`

**Chosen Approach**: Separate table

**Reasoning**:

1. **Scalability**: 20+ webhooks per tenant → easier to query/manage individually
2. **Indexing**: Can index by workflow name, tenant ID efficiently
3. **Stats tracking**: Per-webhook counters (totalCalls, successfulCalls, etc.)
4. **CRUD operations**: Simpler to add/update/delete individual webhooks
5. **Analytics joins**: Easy to join with `webhook_analytics` table

### Why JSONB for WhatsApp/SMS Configs?

**Alternative**: Separate columns for each field

**Chosen Approach**: JSONB with encrypted sub-fields

**Reasoning**:

1. **Flexibility**: Different SMS providers have different fields
2. **Versioning**: Easy to add new fields without migrations
3. **Atomic updates**: Update entire config in one operation
4. **Encryption**: Can encrypt only sensitive sub-fields
5. **Future-proof**: Easy to add new integrations (Telegram, etc.)

### Why Webhook Analytics Table?

**Alternative**: Just use counters in `n8n_webhooks`

**Chosen Approach**: Detailed analytics table

**Reasoning**:

1. **Debugging**: Need to see exact request/response for failed calls
2. **Performance monitoring**: Track response times over time
3. **Trends**: Identify patterns (peak usage, common failures)
4. **Compliance**: Audit trail of all webhook activity
5. **Cleanup**: Can archive old analytics without losing webhook configs

---

**End of Documentation**
