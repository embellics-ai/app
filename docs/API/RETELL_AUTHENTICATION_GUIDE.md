# Retell AI Authentication Guide

## Overview

You can secure your tenant lookup endpoint by requiring an API key that Retell AI will send in the request headers.

---

## Option 1: Custom API Key Authentication (Recommended)

### Step 1: Create Authentication Middleware

Create a simple middleware that checks for an API key:

**File:** `server/middleware/retell-auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to authenticate external API calls from Retell AI
 * Checks for a custom API key in the request headers
 */
export function requireRetellApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.RETELL_INTEGRATION_API_KEY;

  if (!expectedApiKey) {
    console.error('[Retell Auth] RETELL_INTEGRATION_API_KEY not set in environment variables');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
    });
    return;
  }

  if (!apiKey) {
    console.log('[Retell Auth] Missing API key in request');
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'API key missing. Include X-API-Key header.',
    });
    return;
  }

  if (apiKey !== expectedApiKey) {
    console.log('[Retell Auth] Invalid API key provided');
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  console.log('[Retell Auth] ✓ API key validated');
  next();
}
```

### Step 2: Add Environment Variable

Add to your `.env` file:

```bash
# Retell AI Integration API Key
RETELL_INTEGRATION_API_KEY=your-secure-random-key-here
```

Generate a secure random key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

### Step 3: Update Lookup Route

Modify `server/routes/lookup.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { requireRetellApiKey } from '../middleware/retell-auth.middleware';

const router = Router();

/**
 * GET /api/lookup/tenant
 * Look up tenant details by business name or email
 *
 * Requires API key authentication via X-API-Key header
 */
router.get('/tenant', requireRetellApiKey, async (req: Request, res: Response) => {
  // ... rest of your code
});

export default router;
```

### Step 4: Configure in Retell AI

In Retell AI dashboard, when configuring the tool:

**Headers:**

```json
{
  "X-API-Key": "your-secure-random-key-here"
}
```

**Full Configuration:**

```json
{
  "name": "get-tenant-details",
  "description": "Look up tenant details by business name",
  "url": "https://your-domain.com/api/lookup/tenant",
  "method": "get",
  "headers": {
    "X-API-Key": "your-secure-random-key-here"
  },
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
}
```

---

## Option 2: Bearer Token Authentication

If you prefer JWT-style tokens:

### Middleware:

```typescript
export function requireRetellBearerToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.RETELL_BEARER_TOKEN;

  if (!expectedToken) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const token = authHeader.substring(7);

  if (token !== expectedToken) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }

  next();
}
```

### Retell Configuration:

```json
{
  "headers": {
    "Authorization": "Bearer your-secret-token-here"
  }
}
```

---

## Option 3: Query Parameter API Key (Not Recommended)

Less secure but simpler:

```typescript
router.get('/tenant', async (req: Request, res: Response) => {
  const apiKey = req.query.apiKey as string;

  if (apiKey !== process.env.RETELL_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  // ... rest of code
});
```

**Retell URL:**

```
https://your-domain.com/api/lookup/tenant?apiKey=your-key
```

⚠️ **Not recommended** because:

- API key visible in logs
- Can be leaked in URLs
- Harder to rotate

---

## Option 4: IP Whitelist (Advanced)

Restrict access to Retell AI's IP addresses:

```typescript
const RETELL_IP_RANGES = [
  '35.168.0.0/16', // Example - get actual IPs from Retell
  '54.200.0.0/16',
];

export function requireRetellIP(req: Request, res: Response, next: NextFunction): void {
  const clientIP = req.ip || req.socket.remoteAddress;

  // Check if IP is in whitelist
  if (!isIPInRanges(clientIP, RETELL_IP_RANGES)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  next();
}
```

---

## Recommended: Combine Multiple Methods

For maximum security:

```typescript
router.get(
  '/tenant',
  requireRetellApiKey, // Check API key
  requireRetellIP, // Check IP whitelist
  async (req: Request, res: Response) => {
    // Your code
  },
);
```

---

## Testing with cURL

### With API Key Header:

```bash
curl -H "X-API-Key: your-secure-key" \
  "http://localhost:3000/api/lookup/tenant?name=SWC"
```

### With Bearer Token:

```bash
curl -H "Authorization: Bearer your-token" \
  "http://localhost:3000/api/lookup/tenant?name=SWC"
```

---

## Security Best Practices

### 1. Rotate Keys Regularly

```bash
# Generate new key
NEW_KEY=$(openssl rand -hex 32)

# Update .env
# Update Retell dashboard
# Test with new key
# Deploy
```

### 2. Different Keys per Environment

```bash
# .env.development
RETELL_INTEGRATION_API_KEY=dev-key-abc123

# .env.production
RETELL_INTEGRATION_API_KEY=prod-key-xyz789
```

### 3. Monitor Usage

```typescript
router.get('/tenant', requireRetellApiKey, async (req: Request, res: Response) => {
  // Log usage
  console.log('[Tenant Lookup] Request from Retell:', {
    timestamp: new Date().toISOString(),
    tenantName: req.query.name,
    ip: req.ip,
  });

  // Your code...
});
```

### 4. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const retellLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP',
});

router.get('/tenant', retellLimiter, requireRetellApiKey, async (req, res) => {
  // Your code
});
```

---

## What Retell AI Needs

Retell AI can send:

✅ **Custom Headers** (Recommended)

- `X-API-Key: your-key`
- `Authorization: Bearer your-token`
- Any custom header name you want

✅ **Query Parameters**

- `?apiKey=your-key`
- Not recommended for security

✅ **Static Values**

- The key is configured once in Retell dashboard
- Same key used for all calls from that agent

❌ **Cannot Send:**

- Dynamic per-call authentication
- User-specific tokens
- OAuth flows

---

## Quick Implementation

Want to implement this now? I can:

1. Create the authentication middleware file
2. Update your lookup route to use it
3. Add the environment variable to `.env.example`
4. Update the documentation

Just let me know if you want me to implement Option 1 (API Key Header) - it's the most secure and easiest to manage! 🔐
