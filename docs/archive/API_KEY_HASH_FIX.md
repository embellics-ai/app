# API Key Hash Bug Fix

## Issue

Widget API keys were not working due to a hash mismatch bug. Even when users copied the correct API key, authentication would fail with "Invalid API key" error.

## Root Cause

The bug was in how API keys were hashed during creation vs validation:

**During key creation:**

```typescript
// WRONG - Only hashing the hex part
const apiKey = randomBytes(32).toString('hex'); // e.g., "4c742acc29b150844e..."
const keyHash = createHash('sha256').update(apiKey).digest('hex');
// Returns full key as: embellics_4c742acc29b150844e...
```

**During widget validation:**

```typescript
// Widget sends: embellics_4c742acc29b150844e...
const keyHash = createHash('sha256').update(apiKey).digest('hex');
// Hashes the FULL key including "embellics_" prefix
```

**Result:** The hashes never matched because:

- Database stored: `hash("4c742acc29b150844e...")`
- Widget sent: `hash("embellics_4c742acc29b150844e...")`

## The Fix

Updated both key generation locations to hash the FULL key with the `embellics_` prefix:

### 1. Manual Key Creation (POST /api/api-keys)

```typescript
// Generate key
const apiKey = randomBytes(32).toString('hex');
const keyPrefix = apiKey.substring(0, 8);
const fullApiKey = `embellics_${apiKey}`;

// Hash the FULL key (with embellics_ prefix)
const keyHash = createHash('sha256').update(fullApiKey).digest('hex');
```

### 2. Auto-Generation (When Retell credentials assigned)

Same fix applied to the auto-generation code in the Retell API key update endpoint.

## Files Changed

- `server/routes.ts`:
  - Line ~1895: Fixed manual API key creation hash
  - Line ~800: Fixed auto-generated API key hash
  - Line ~3710: Removed verbose debugging logs
  - Line ~240: Cleaned up auth logging
  - Line ~75: Cleaned up login logging

## Impact

- ✅ All NEW API keys will work correctly
- ❌ Old API keys (created before this fix) will NOT work
- 🔄 Users must delete old keys and create new ones

## Testing

After applying the fix and restarting the server:

1. Delete any existing API keys in the dashboard
2. Create a new API key
3. Copy the full key from the green banner (or server logs if debug enabled)
4. Use it in your widget embed code:
   ```html
   <script
     src="https://app.embellics.com/widget.js"
     data-api-key="embellics_[full-64-char-hex-string]"
   ></script>
   ```
5. Widget should initialize and authenticate successfully

## Production Deployment Notes

1. **Restart required**: Server must be restarted for the fix to take effect
2. **User communication**: Inform existing users that they need to regenerate their API keys
3. **Database migration**: No database migration needed - old keys will simply stop working
4. **Logging**: All excessive debug logging has been removed for production

## Prevention

To prevent similar issues in the future:

1. **Consistent hashing**: Always hash the exact same format that will be sent during validation
2. **Testing**: Add integration tests that verify API key creation and validation work end-to-end
3. **Documentation**: Clearly document the API key format and hashing logic

## Date

Fixed: November 20, 2025
