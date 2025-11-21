# ENCRYPTION_KEY Error Fix

## Problem

When starting the app with `npm run dev`, it crashed with:

```
Error: ENCRYPTION_KEY environment variable is required
```

## Root Cause

The issue was with **ES module import hoisting**:

1. `server/index.ts` tried to load dotenv at the top
2. But `import` statements are hoisted in ES modules
3. So `import { registerRoutes } from './routes'` ran BEFORE the dotenv config
4. `routes.ts` imports `encryption.ts`
5. `encryption.ts` checks `process.env.ENCRYPTION_KEY` at module initialization time
6. At that point, dotenv hadn't loaded yet → crash!

## Solution

Created a separate entry point `server/start.ts` that:

1. Loads `.env` first
2. Loads `.env.local` second (overrides `.env`)
3. Then dynamically imports `server/index.ts`

This ensures environment variables are loaded BEFORE any other modules.

## Files Changed

### 1. Created `server/start.ts` (new entry point)

```typescript
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env first, then .env.local (which overrides .env)
config();
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
  console.log('[Server] 🔧 Loaded .env.local - using local configuration');
}

// Now import the actual server
import('./index.js');
```

### 2. Reverted `server/index.ts`

Removed the dotenv loading code (now handled by `start.ts`)

### 3. Updated `package.json`

```json
"scripts": {
  "dev": "NODE_ENV=development tsx server/start.ts",  // Changed from index.ts
  ...
}
```

## How It Works Now

**Before (Broken):**

```
npm run dev
  ↓
tsx server/index.ts
  ↓
ES modules hoist imports
  ↓
encryption.ts runs → process.env.ENCRYPTION_KEY undefined → CRASH
  ↓
dotenv.config() runs (too late!)
```

**After (Fixed):**

```
npm run dev
  ↓
tsx server/start.ts
  ↓
dotenv.config() loads .env
  ↓
dotenv.config() loads .env.local (overrides)
  ↓
✅ Environment variables ready
  ↓
Dynamic import('./index.js')
  ↓
encryption.ts runs → process.env.ENCRYPTION_KEY available → SUCCESS
```

## Verification

You should see this when starting the app:

```
[Server] 🔧 Loaded .env.local - using local configuration
[DB Init] Checking for platform owner...
[DB Init] ✓ Platform owner already exists
9:19:24 AM [express] serving on 0.0.0.0:3000
```

## Email Configuration Status

✅ App loads `.env.local` successfully  
✅ SMTP_HOST: localhost (MailDev)  
✅ SMTP_PORT: 1025  
✅ Emails will go to MailDev, not Gmail  
✅ View emails at: http://localhost:1080

## Testing

1. **Start MailDev** (if not running):

   ```bash
   maildev
   ```

2. **Start the app**:

   ```bash
   npm run dev
   ```

3. **Send a test email** (invite user, reset password)

4. **View in MailDev**: http://localhost:1080

All emails should now arrive in MailDev! 📧
