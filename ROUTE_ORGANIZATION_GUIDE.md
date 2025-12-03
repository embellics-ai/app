# Route Organization Guide

**Last Updated:** December 3, 2025  
**Purpose:** Define where new API endpoints should be placed in the modular route structure

---

## 📁 Route File Structure Overview

```
server/routes/
├── index.ts                    # Route orchestrator (registers all routes)
├── auth.routes.ts              # Authentication & user session
├── analytics.routes.ts         # Analytics & reporting
├── proxy.routes.ts             # External API proxying (WhatsApp, Retell, etc.)
├── tenant.routes.ts            # Tenant management (CRUD)
├── user.routes.ts              # User & invitation management
├── integration.routes.ts       # Integration configs (WhatsApp, N8N, External APIs)
├── function.routes.ts          # Retell function proxy
├── webhook.routes.ts           # Retell webhook receivers
├── conversation.routes.ts      # Messages & conversations
├── handoff.routes.ts           # Human agent handoff system
├── widget.routes.ts            # Widget embedding & chat
└── misc.routes.ts              # Widget config, API keys, health check

server/middleware/
├── auth.middleware.ts          # Authentication & authorization
└── validation.middleware.ts    # Request validation
```

---

## 🗂️ Route File Responsibilities

### 1. **auth.routes.ts** - Authentication & User Sessions

**Base Path:** `/api/auth`  
**Registration:** `app.use('/api/auth', authRoutes)`

**Add endpoints here if they handle:**

- ✅ User login/logout
- ✅ Password management (change, forgot, reset)
- ✅ Session management (heartbeat, /me)
- ✅ Invitation acceptance
- ✅ User onboarding
- ✅ Authentication tokens

**Examples:**

```typescript
POST / api / auth / login;
POST / api / auth / logout;
GET / api / auth / me;
POST / api / auth / heartbeat;
POST / api / auth / forgot - password;
POST / api / auth / reset - password;
POST / api / auth / change - password;
POST / api / auth / accept - invitation;
POST / api / auth / complete - onboarding;
```

---

### 2. **analytics.routes.ts** - Analytics & Reporting

**Base Paths:** `/api/platform/tenants/:tenantId/analytics/*`  
**Registration:** `app.use('/api/platform/tenants', analyticsRoutes)`

**Add endpoints here if they handle:**

- ✅ Chat analytics
- ✅ Voice call analytics
- ✅ Cost tracking
- ✅ Sentiment analysis
- ✅ Agent performance metrics
- ✅ Time-series data
- ✅ Analytics dashboards

**Examples:**

```typescript
GET /api/platform/tenants/:tenantId/analytics/overview
GET /api/platform/tenants/:tenantId/analytics/chats
GET /api/platform/tenants/:tenantId/analytics/chats/time-series
GET /api/platform/tenants/:tenantId/analytics/chats/agent-breakdown
GET /api/platform/tenants/:tenantId/analytics/chats/:chatId
GET /api/platform/tenants/:tenantId/analytics/sentiment
GET /api/platform/tenants/:tenantId/analytics/costs
GET /api/platform/tenants/:tenantId/analytics/calls
GET /api/platform/tenants/:tenantId/analytics/calls/:callId
```

---

### 3. **proxy.routes.ts** - External API Proxying

**Base Paths:** `/api/proxy/*` AND `/api/whatsapp/*`  
**Registration:**

```typescript
app.use('/api/proxy', proxyRoutes);
app.use('/api/whatsapp', proxyRoutes); // WhatsApp webhooks
```

**Add endpoints here if they handle:**

- ✅ WhatsApp API proxying (send messages, media, templates)
- ✅ WhatsApp webhook verification (GET)
- ✅ WhatsApp message receiver (POST)
- ✅ Retell AI API proxying (create calls, phone calls)
- ✅ External API generic proxy
- ✅ Integration testing endpoints

**Examples:**

```typescript
// WhatsApp
POST /api/proxy/:tenantId/whatsapp/send
GET  /api/proxy/:tenantId/whatsapp/templates
GET  /api/proxy/:tenantId/whatsapp/media/:mediaId
GET  /api/proxy/:tenantId/whatsapp/test
GET  /api/whatsapp/webhook              // Meta verification
POST /api/whatsapp/webhook              // Receive messages

// Retell AI
POST /api/proxy/:tenantId/retell/create-chat
POST /api/proxy/:tenantId/retell/create-call
POST /api/proxy/:tenantId/retell/create-phone-call

// External APIs
POST /api/proxy/external/:configId/request
GET  /api/proxy/integrations
POST /api/proxy/integrations/test
```

---

### 4. **tenant.routes.ts** - Tenant Management

**Base Paths:** `/api/platform/tenants/*` AND `/api/tenants/*`  
**Registration:**

```typescript
app.use('/api/platform/tenants', tenantRoutes);
app.use('/api/tenants', tenantRoutes); // Backward compatibility
```

**Add endpoints here if they handle:**

- ✅ Tenant CRUD operations
- ✅ Tenant listing
- ✅ Tenant information retrieval
- ✅ Tenant settings

**Examples:**

```typescript
GET    /api/platform/tenants           // List all (platform admin)
POST   /api/platform/tenants           // Create new tenant
GET    /api/platform/tenants/:id       // Get tenant details
GET    /api/tenants/:tenantId          // Get tenant (legacy path)
PATCH  /api/platform/tenants/:id       // Update tenant
DELETE /api/platform/tenants/:id       // Delete tenant
```

---

### 5. **user.routes.ts** - User & Invitation Management

**Base Path:** `/api/platform/*`  
**Registration:** `app.use('/api/platform', userRoutes)`

**Add endpoints here if they handle:**

- ✅ User CRUD operations
- ✅ User invitations
- ✅ User management (platform admin only)
- ✅ Invitation management

**Examples:**

```typescript
GET    /api/platform/users                    // List all users
POST   /api/platform/users                    // Create user
PATCH  /api/platform/users/:id                // Update user
DELETE /api/platform/users/:id                // Delete user
GET    /api/platform/invitations/pending      // List pending invitations
POST   /api/platform/invitations              // Create invitation
DELETE /api/platform/invitations/:id          // Delete invitation
```

---

### 6. **integration.routes.ts** - Integration Configurations

**Base Path:** `/api/platform/tenants/:tenantId/*`  
**Registration:** `app.use('/api/platform/tenants', integrationRoutes)`

**Add endpoints here if they handle:**

- ✅ WhatsApp configuration (credentials, phone numbers)
- ✅ SMS configuration
- ✅ N8N configuration (webhooks, base URL)
- ✅ External API configurations (Google Calendar, Stripe, etc.)
- ✅ Integration testing
- ✅ Webhook analytics

**Examples:**

```typescript
// General Integration
GET  /api/platform/tenants/:tenantId/integrations

// WhatsApp Integration
PUT    /api/platform/tenants/:tenantId/integrations/whatsapp
PATCH  /api/platform/tenants/:tenantId/integrations/whatsapp/:id
DELETE /api/platform/tenants/:tenantId/integrations/whatsapp/:id

// N8N Integration
PUT    /api/platform/tenants/:tenantId/integrations/n8n
PATCH  /api/platform/tenants/:tenantId/integrations/n8n/:id
DELETE /api/platform/tenants/:tenantId/integrations/n8n/:id

// External API Configurations
GET    /api/platform/tenants/:tenantId/external-apis
POST   /api/platform/tenants/:tenantId/external-apis
PUT    /api/platform/tenants/:tenantId/external-apis/:id
DELETE /api/platform/tenants/:tenantId/external-apis/:id

// Webhooks
GET  /api/platform/tenants/:tenantId/webhooks
POST /api/platform/tenants/:tenantId/webhooks
```

---

### 7. **function.routes.ts** - Retell Function Proxy

**Base Path:** `/api/functions/*`  
**Registration:** `app.use('/api/functions', functionRoutes)`

**Add endpoints here if they handle:**

- ✅ Retell AI function calls to N8N
- ✅ Dynamic function routing based on function name

**Examples:**

```typescript
POST /api/functions/:functionName
```

---

### 8. **webhook.routes.ts** - Retell Webhook Receivers

**Base Path:** `/api/retell/*`  
**Registration:** `app.use('/api/retell', webhookRoutes)`

**Add endpoints here if they handle:**

- ✅ Retell AI webhook receivers
- ✅ Chat analysis webhooks
- ✅ Call ended webhooks

**Examples:**

```typescript
POST / api / retell / chat - analyzed;
POST / api / retell / call - ended;
```

---

### 9. **conversation.routes.ts** - Messages & Conversations

**Base Path:** `/api/messages/*`, `/api/conversations/*`  
**Registration:** `app.use('/', conversationRoutes)`

**Add endpoints here if they handle:**

- ✅ Message CRUD operations
- ✅ Conversation management
- ✅ Chat history
- ✅ Conversation ending

**Examples:**

```typescript
GET  /api/messages/:conversationId         // Get messages
POST /api/messages                         // Send message
GET  /api/conversations                    // List conversations
POST /api/conversations                    // Create conversation
POST /api/conversations/:id/end            // End conversation
```

---

### 10. **handoff.routes.ts** - Human Agent Handoff

**Base Path:** `/api/human-agents/*`, `/api/widget-handoffs/*`, `/api/handoff/*`  
**Registration:** `app.use('/', handoffRoutes)`

**Add endpoints here if they handle:**

- ✅ Human agent management
- ✅ Widget handoff requests
- ✅ Handoff assignment and completion
- ✅ Agent status management
- ✅ Handoff messaging

**Examples:**

```typescript
// Human Agents
GET    /api/human-agents
POST   /api/human-agents
PATCH  /api/human-agents/:id
DELETE /api/human-agents/:id
PATCH  /api/human-agents/:id/status
GET    /api/human-agents/available

// Widget Handoffs
GET  /api/widget-handoffs
GET  /api/widget-handoffs/pending
GET  /api/widget-handoffs/active
GET  /api/widget-handoffs/:id
POST /api/widget-handoffs

// Handoff Management
POST /api/handoff/trigger
POST /api/handoff/assign
POST /api/handoff/complete
GET  /api/handoff/pending
GET  /api/handoff/active
POST /api/handoff/send-message
```

---

### 11. **widget.routes.ts** - Widget Embedding & Chat

**Base Path:** `/widget.js`, `/api/widget/*`  
**Registration:** `app.use('/', widgetRoutes)`

**Add endpoints here if they handle:**

- ✅ Widget JavaScript file serving
- ✅ Widget initialization
- ✅ Widget chat messaging
- ✅ Widget session history
- ✅ Widget handoff requests
- ✅ Widget configuration (public-facing)

**Examples:**

```typescript
GET  /widget.js                                    // Widget JavaScript
POST /api/widget/init                              // Initialize widget
POST /api/widget/chat                              // Send chat message
GET  /api/widget/session/:chatId/history           // Get chat history
POST /api/widget/handoff                           // Request handoff
POST /api/widget/end-chat                          // End chat session
GET  /api/widget/handoff/:handoffId/status         // Check handoff status
POST /api/widget/handoff/:handoffId/message        // Send handoff message
GET  /api/widget/handoff/:handoffId/messages       // Get handoff messages
```

---

### 12. **misc.routes.ts** - Miscellaneous Endpoints

**Base Path:** `/api/widget-config/*`, `/api/api-keys/*`, `/api/health`  
**Registration:** `app.use('/', miscRoutes)`

**Add endpoints here if they handle:**

- ✅ Widget configuration (admin-facing)
- ✅ API key management
- ✅ Health check endpoints
- ✅ System status
- ✅ Other uncategorized endpoints

**Examples:**

```typescript
// Widget Configuration
GET    /api/widget-config
POST   /api/widget-config
PATCH  /api/widget-config/:id

// API Keys
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys/:id

// Health
GET /api/health
```

---

## 🚨 Critical Rules for Adding New Endpoints

### 1. **Choose the Right File**

- Read the responsibilities section above
- Place endpoint in the file that matches its PRIMARY purpose
- If unsure, ask: "What is the main business function of this endpoint?"

### 2. **Follow Existing Patterns**

- Study existing endpoints in the target file
- Use same authentication middleware (`requireAuth`, `requirePlatformAdmin`)
- Use same error handling patterns
- Use same validation approach (Zod schemas)

### 3. **Use Correct Path Structure**

```typescript
// ❌ WRONG - Including base path in route definition
router.get('/api/auth/login', ...)

// ✅ CORRECT - Base path is in index.ts registration
router.get('/login', ...)  // Registered at app.use('/api/auth', authRoutes)
```

### 4. **Document the Endpoint**

```typescript
/**
 * Brief description of what the endpoint does
 *
 * Additional details if needed
 *
 * METHOD /full/path/with/params
 */
router.method('/route', middleware, async (req, res) => {
  // Implementation
});
```

### 5. **Handle Multi-Path Registration**

Some routes are registered at multiple base paths for backward compatibility:

```typescript
// In index.ts
app.use('/api/platform/tenants', tenantRoutes);
app.use('/api/tenants', tenantRoutes); // Legacy support
```

This means `router.get('/:id')` resolves to BOTH:

- `/api/platform/tenants/:id`
- `/api/tenants/:id`

### 6. **Middleware Order Matters**

```typescript
// ✅ CORRECT - Auth first, then validation, then handler
router.post(
  '/endpoint',
  requireAuth, // 1. Check authentication
  requirePlatformAdmin, // 2. Check authorization
  async (req, res) => {
    // 3. Handle request
    const data = schema.parse(req.body); // 4. Validate inside handler
  },
);
```

---

## 📋 Checklist for Adding New Endpoints

- [ ] Determined which route file matches the endpoint's purpose
- [ ] Studied existing endpoints in that file for patterns
- [ ] Used relative path (not including base path)
- [ ] Added proper JSDoc comment above endpoint
- [ ] Applied correct authentication middleware
- [ ] Applied authorization checks (tenant isolation, role checks)
- [ ] Implemented proper error handling (try/catch, status codes)
- [ ] Used Zod for request validation
- [ ] Added console.log statements for debugging
- [ ] Tested the endpoint works (manual or automated test)
- [ ] Verified TypeScript compilation (`npm run check`)
- [ ] Checked no duplicate routes exist
- [ ] Updated API documentation if needed

---

## 🎯 Decision Tree

```
New endpoint needed for:

├─ User login/auth/session?
│  └─> auth.routes.ts
│
├─ Analytics/reports/metrics?
│  └─> analytics.routes.ts
│
├─ Calling external APIs (WhatsApp, Retell, etc)?
│  └─> proxy.routes.ts
│
├─ Tenant CRUD operations?
│  └─> tenant.routes.ts
│
├─ User/invitation management?
│  └─> user.routes.ts
│
├─ Integration configuration (credentials, webhooks)?
│  └─> integration.routes.ts
│
├─ Retell function calls to N8N?
│  └─> function.routes.ts
│
├─ Receiving webhooks from Retell?
│  └─> webhook.routes.ts
│
├─ Chat messages/conversations?
│  └─> conversation.routes.ts
│
├─ Human agent handoff system?
│  └─> handoff.routes.ts
│
├─ Widget embedding/chat (public)?
│  └─> widget.routes.ts
│
└─ Widget config, API keys, health check?
   └─> misc.routes.ts
```

---

## 🔍 Common Mistakes to Avoid

### ❌ Mistake 1: Including Base Path in Route

```typescript
// WRONG - proxy.routes.ts
router.post('/api/proxy/:tenantId/whatsapp/send', ...)

// CORRECT
router.post('/:tenantId/whatsapp/send', ...)  // Base /api/proxy added in index.ts
```

### ❌ Mistake 2: Wrong File Choice

```typescript
// WRONG - Putting external API config in proxy.routes.ts
router.post('/:tenantId/external-apis', ...)  // This is configuration!

// CORRECT - Put in integration.routes.ts
router.post('/:tenantId/external-apis', ...)  // Configurations go here
```

### ❌ Mistake 3: Forgetting Multi-Registration

```typescript
// WRONG - Only registering at one path
app.use('/api/platform/tenants', tenantRoutes);

// CORRECT - Register at both paths if needed for backward compatibility
app.use('/api/platform/tenants', tenantRoutes);
app.use('/api/tenants', tenantRoutes);
```

### ❌ Mistake 4: Missing Authentication

```typescript
// WRONG - Public endpoint that should be protected
router.get('/api/users', async (req, res) => {
  const users = await storage.getAllUsers(); // 🚨 Security issue!
  res.json(users);
});

// CORRECT
router.get('/users', requireAuth, requirePlatformAdmin, async (req, res) => {
  const users = await storage.getAllUsers();
  res.json(users);
});
```

---

## 📚 Reference Examples

### Example 1: Adding Authentication Endpoint

```typescript
// File: server/routes/auth.routes.ts

/**
 * POST /api/auth/verify-email
 * Verify user email address
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      token: z.string(),
    });

    const { email, token } = schema.parse(req.body);

    const user = await storage.verifyUserEmail(email, token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});
```

### Example 2: Adding Analytics Endpoint

```typescript
// File: server/routes/analytics.routes.ts

/**
 * GET /api/platform/tenants/:tenantId/analytics/revenue
 * Get revenue analytics for tenant
 */
router.get(
  '/:tenantId/analytics/revenue',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Authorization check
      if (!req.user?.isPlatformAdmin && req.user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const revenue = await storage.getRevenueAnalytics(tenantId);
      res.json(revenue);
    } catch (error) {
      console.error('Revenue analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
  },
);
```

### Example 3: Adding Integration Configuration

```typescript
// File: server/routes/integration.routes.ts

/**
 * POST /api/platform/tenants/:tenantId/integrations/stripe
 * Configure Stripe integration for tenant
 */
router.post(
  '/:tenantId/integrations/stripe',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;
      const { apiKey, webhookSecret } = req.body;

      // Encrypt sensitive data
      const encryptedKey = encrypt(apiKey);
      const encryptedSecret = encrypt(webhookSecret);

      const config = await storage.createStripeIntegration({
        tenantId,
        encryptedApiKey: encryptedKey,
        encryptedWebhookSecret: encryptedSecret,
      });

      res.json({ id: config.id, success: true });
    } catch (error) {
      console.error('Stripe integration error:', error);
      res.status(500).json({ error: 'Failed to configure Stripe' });
    }
  },
);
```

---

## 🎓 Learning from Past Mistakes

**What Went Wrong During Refactoring:**

1. **External API endpoints missing** - Were in original routes.ts but not extracted
2. **Auth endpoints missing** - `complete-onboarding`, `accept-invitation` left behind
3. **Tenant detail endpoint** - Legacy `/api/tenants/:id` path not registered
4. **WhatsApp webhooks** - Needed dual registration at `/api/whatsapp`

**Lessons Learned:**

1. ✅ Always do a systematic comparison when refactoring
2. ✅ Test all endpoints after major changes
3. ✅ Maintain backward compatibility with dual registrations
4. ✅ Document route organization for future developers
5. ✅ Use this guide when adding new endpoints!

---

**Last Updated:** December 3, 2025  
**Maintainer:** Development Team  
**Status:** 🟢 Active - Use this guide for all new endpoints
