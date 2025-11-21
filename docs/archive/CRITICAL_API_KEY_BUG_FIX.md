# Critical Bug Fixed: SHA256 vs BCrypt API Key Validation

## 🐛 The Real Bug

The widget API endpoints were using **TWO DIFFERENT** hashing algorithms for API key validation:

### ✅ Correct Implementation (used by `/api/widget/init`)

```typescript
// Uses bcrypt (secure password hashing)
const allApiKeys = await storage.getAllApiKeys();
for (const key of allApiKeys) {
  const isMatch = await verifyPassword(apiKey, key.keyHash);
  if (isMatch) {
    apiKeyRecord = key;
    break;
  }
}
```

### ❌ Wrong Implementation (used by other endpoints)

```typescript
// Uses SHA256 (simple hash, not compatible with bcrypt!)
const keyHash = createHash('sha256').update(apiKey).digest('hex');
const apiKeyRecord = await storage.getApiKeyByHash(keyHash);
```

## Why It Failed

1. **API keys are stored with bcrypt hash** in the database
2. **Bcrypt is a password hashing function** - you can't reverse it or compare hashes directly
3. **SHA256 hash of the API key** will NEVER match the bcrypt hash in database
4. **Result:** Every API key validation failed with "Invalid API key"

## How API Keys Are Created

```typescript
// In server/routes.ts - POST /api/keys
const apiKey = randomBytes(32).toString('hex'); // Random 64 hex chars
const keyPrefix = apiKey.substring(0, 8); // First 8 chars (for display)
const fullApiKey = `embellics_${apiKey}`; // Add prefix
const keyHash = await hashPassword(fullApiKey); // Hash with BCRYPT
```

Database stores:

- `keyPrefix`: First 8 chars (e.g., `d310fe4e`)
- `keyHash`: Bcrypt hash of full key (e.g., `$2a$10$...`)

## Why Init Worked But Chat Didn't

- `/api/widget/init` - Used **bcrypt validation** ✅
- `/api/widget/chat` - Used **SHA256 validation** ❌
- `/api/widget/session/:chatId/history` - Used **SHA256 validation** ❌
- `/api/widget/handoff` - Used **SHA256 validation** ❌
- Other endpoints - Used **SHA256 validation** ❌

This is why the widget initialized successfully but failed when sending messages!

## The Fix

### Fixed Endpoints

1. `/api/widget/chat` - Now uses bcrypt validation
2. `/api/widget/session/:chatId/history` - Now uses bcrypt validation
3. `/api/widget/handoff` - Now uses bcrypt validation
4. `/api/widget/handoff/:handoffId/messages` - Now uses bcrypt validation
5. `/api/widget/handoff/:handoffId/status` - Now uses bcrypt validation
6. `/api/widget/handoff/:handoffId/end` - Now uses bcrypt validation

### Script Created

`fix-api-key-validation.mjs` - Automated script that:

- Finds all SHA256 validation blocks
- Replaces them with bcrypt validation
- Reports the number of fixes made

Result: **5 endpoints fixed** (plus the 2 already using bcrypt = 7 total)

## Current API Key

```
embellics_YOUR_API_KEY_HERE
```

**Tenant:** SWC  
**Prefix:** [first 8 chars]  
**Created:** [timestamp]

## Testing

Now test the widget:

1. Server will auto-reload with the fix (using tsx watch)
2. Refresh the test page: `docs/widget-simple-test.html`
3. Click the chat button
4. Send a message
5. **It should work now!** ✨

## Why This Bug Existed

Looks like someone copied the init endpoint code but "simplified" it by using SHA256 instead of bcrypt, not realizing that:

1. Bcrypt hashes can't be compared directly
2. You must verify against the stored hash using `bcrypt.compare()`
3. SHA256 hash will NEVER match a bcrypt hash

## Prevention

All widget API endpoints should use the same validation pattern:

```typescript
// Standard pattern for widget API key validation
const allApiKeys = await storage.getAllApiKeys();
let apiKeyRecord = null;

for (const key of allApiKeys) {
  const isMatch = await verifyPassword(apiKey, key.keyHash);
  if (isMatch) {
    apiKeyRecord = key;
    break;
  }
}

if (!apiKeyRecord) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

Never use `getApiKeyByHash(sha256Hash)` for bcrypt-stored keys!
