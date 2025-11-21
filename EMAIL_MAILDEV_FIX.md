# Email Not Arriving in MailDev - FIXED

## Problem

Emails were still going to Gmail instead of MailDev even though `.env.local` was created.

## Root Cause

The `import 'dotenv/config'` statement doesn't automatically load `.env.local` files. It only loads `.env`.

## Solution

Modified `server/index.ts` to explicitly load both files:

```typescript
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load .env first, then .env.local (which overrides .env)
config(); // Load .env
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true }); // Load .env.local and override
  console.log('[Server] 🔧 Loaded .env.local - using local configuration');
}
```

## How to Use

### 1. Make sure MailDev is running

```bash
# Check if running
ps aux | grep maildev

# If not running, start it
nohup maildev > /dev/null 2>&1 &
```

### 2. Verify configuration

```bash
npx tsx check-email-config.ts
```

Should show:

```
✅ Using MailDev (localhost:1025)
📧 View emails at: http://localhost:1080
```

### 3. Restart your app

```bash
# Stop your app (Ctrl+C if running)
npm run dev
```

You should see in the console:

```
[Server] 🔧 Loaded .env.local - using local configuration
```

### 4. Send a test email

- Invite a user
- Reset a password
- Any email-sending action

### 5. Check MailDev

Open http://localhost:1080 - your email should be there!

## Verification

Run the check script anytime to verify which SMTP server will be used:

```bash
npx tsx check-email-config.ts
```

## Files Changed

- ✅ `server/index.ts` - Fixed dotenv loading to support `.env.local`
- ✅ Created `check-email-config.ts` - Verify SMTP configuration
- ✅ MailDev running on port 1025 (SMTP) and 1080 (Web UI)

## Status

✅ Configuration verified - MailDev will now receive all emails
✅ Just restart your app to apply changes!
