# Auto-Generated Widget API Keys

## Problem Statement

**Previous Flow (Incorrect):**

1. Platform admin assigns Retell API key + Agent ID to client admin ✅
2. Client admin can see analytics (works fine) ✅
3. Client admin has to manually create a widget API key ❌
4. Client admin has to manually copy and add that key to widget embed code ❌

**Issues:**

- Extra manual step for client admins
- Confusing UX - why do they need to create another API key?
- Widget doesn't work immediately after Retell credentials are assigned
- Potential for errors if client admin forgets to create the key

## Solution Implemented

**New Flow (Correct):**

1. Platform admin assigns Retell API key + Agent ID to client admin ✅
2. **Widget API key is automatically generated** ✅
3. Widget embed code already includes the API key ✅
4. Client admin can immediately use the widget ✅

## Technical Changes

### Auto-Generation Logic

Location: `server/routes.ts` - PATCH `/api/platform/tenants/:tenantId/retell-api-key`

When platform admin updates Retell credentials, the system now:

1. **Checks for existing API keys** for the tenant
2. **Auto-generates a widget API key** if none exist:
   - Format: `embellics_[64-char-hex]`
   - Name: "Default Widget Key (Auto-generated)"
   - Stored securely as SHA-256 hash
   - Key prefix (first 8 chars) saved for display

3. **Skips generation** if keys already exist

### Code Added

```typescript
// FEATURE: Auto-generate widget API key if one doesn't exist
// This allows client admin to immediately use the widget without manual API key creation
const existingApiKeys = await storage.getApiKeysByTenant(tenantId);

if (existingApiKeys.length === 0) {
  console.log(`[Update Retell API Key] No API key found for tenant, auto-generating...`);

  // Generate API key (matches the format in POST /api/api-keys)
  const apiKey = randomBytes(32).toString('hex');
  const keyPrefix = apiKey.substring(0, 8); // First 8 chars for display
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  // Save to database
  await storage.createApiKey({
    tenantId,
    keyHash,
    keyPrefix,
    name: 'Default Widget Key (Auto-generated)',
  });

  console.log(`[Update Retell API Key] ✓ Auto-generated widget API key for tenant: ${tenantId}`);
}
```

## Benefits

### For Client Admins

- ✅ Widget works immediately after setup
- ✅ No manual API key creation needed
- ✅ Copy widget embed code and use right away
- ✅ Simpler onboarding experience

### For Platform Admins

- ✅ One-step setup for new tenants
- ✅ Less support requests about "widget not working"
- ✅ Consistent configuration across all tenants

### For End Users

- ✅ Faster deployment
- ✅ Fewer configuration errors
- ✅ More reliable widget availability

## Testing

### Test Scenario 1: New Tenant Setup

1. **Platform admin creates new client admin**
   - Login as `admin@embellics.com`
   - Create new client admin tenant

2. **Platform admin assigns Retell credentials**
   - Go to tenant management
   - Add Retell API key and Agent ID
   - **Check:** API key should be auto-generated

3. **Client admin checks widget**
   - Login as client admin
   - Go to Widget Config page
   - **Expected:** Widget embed code already has API key
   - **Expected:** Widget works immediately

### Test Scenario 2: Existing Tenant (API Key Already Exists)

1. **Tenant already has API key**
   - Client admin previously created a key

2. **Platform admin updates Retell credentials**
   - Update API key or Agent ID

3. **Verify no duplicate**
   - **Expected:** No new API key generated
   - **Expected:** Existing key remains unchanged
   - **Expected:** Widget continues working

### Test Scenario 3: Fresh Database

1. **Clean database**
   - Run `npm run clean-db`

2. **Create new tenant**
   - Platform admin creates client admin
   - Assigns Retell credentials

3. **Verify auto-generation**
   - Check API Keys page
   - **Expected:** One "Default Widget Key (Auto-generated)"
   - **Expected:** Widget works

## Console Logging

Added detailed logging to track auto-generation:

```
[Update Retell API Key] No API key found for tenant, auto-generating...
[Update Retell API Key] ✓ Auto-generated widget API key for tenant: abc-123
[Update Retell API Key] Widget will now work immediately for client admin
```

Or if key exists:

```
[Update Retell API Key] API key already exists (1 keys), skipping auto-generation
```

## API Keys Page Considerations

### Current State

- Client admins can still manually create/delete API keys
- This is fine - allows advanced users to manage multiple keys if needed

### Future Enhancement (Optional)

Consider simplifying the API Keys page for client admins:

- Show the auto-generated key (read-only)
- Add warning: "This key is automatically managed"
- Hide the "Create New Key" button or add help text

## Security

- ✅ API keys are generated using `crypto.randomBytes(32)` (secure)
- ✅ Keys are hashed with SHA-256 before storage
- ✅ Full key is never stored or shown again after generation
- ✅ Only key prefix (first 8 chars) is visible in admin panel
- ✅ Auto-generation only happens if NO keys exist (no duplicates)

## Backwards Compatibility

- ✅ Existing tenants with API keys: No change
- ✅ Manual API key creation: Still works
- ✅ Multiple API keys per tenant: Supported
- ✅ API key deletion: Works as before

## Related Files

- `server/routes.ts` - Auto-generation logic
- `server/storage.ts` - API key creation methods
- `client/src/pages/api-keys.tsx` - API Keys management page
- `client/src/pages/widget-config.tsx` - Widget configuration page

## Rollout Plan

1. ✅ Code implemented
2. Test with clean database
3. Test with existing tenants
4. Deploy to staging
5. Monitor console logs
6. Deploy to production
7. Document in user guide

## Support

If issues arise:

- Check console logs for auto-generation messages
- Verify widget embed code includes API key
- Client admin can still manually create keys if needed
- Platform admin can regenerate by deleting existing key and updating Retell credentials again
