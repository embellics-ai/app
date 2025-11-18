# Deployment Guide - Onboarding Fix

## Issue Summary

**Problem:** Onboarding wizard loops from step 5 back to step 1, "skip for now" button not working, preventing dashboard access.

**Root Cause:** The `/api/auth/complete-onboarding` endpoint required ALL users to have a `tenantId`, but platform admins don't have one. This caused a 401 error that wasn't properly handled by the frontend.

## Fixes Applied

### 1. Backend Fix (server/routes.ts)

**File:** `server/routes.ts` (lines 207-224)

```typescript
// Complete onboarding (PROTECTED)
app.post('/api/auth/complete-onboarding', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const isPlatformAdmin = req.user!.isPlatformAdmin;

    // Platform admins don't have a tenantId - that's okay
    // Client admins and support staff should have a tenantId
    if (!isPlatformAdmin) {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
    }

    await storage.markOnboardingComplete(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});
```

**What Changed:**

- Added `isPlatformAdmin` check before validating `tenantId`
- Platform admins can complete onboarding without a tenant
- Client admins and support staff still require valid `tenantId`

### 2. Frontend Error Handling (client/src/pages/onboarding.tsx)

**File:** `client/src/pages/onboarding.tsx` (lines 154-214)

```typescript
const handleCompleteOnboarding = async () => {
  try {
    await completeOnboarding.mutateAsync();
    // ... success handling
  } catch (error) {
    console.error('Failed to complete onboarding:', error);
    toast({
      title: 'Setup Error',
      description:
        'There was an issue completing your setup. Please try refreshing the page or contact support if the issue persists.',
      variant: 'destructive',
    });
  }
};

const handleSkipOnboarding = async () => {
  try {
    await completeOnboarding.mutateAsync();
    // ... success handling
  } catch (error) {
    console.error('Failed to skip onboarding:', error);
    toast({
      title: 'Setup Error',
      description:
        'There was an issue completing your setup. Please try refreshing the page or contact support if the issue persists.',
      variant: 'destructive',
    });
  }
};
```

**What Changed:**

- Added explicit error handling with user-friendly messages
- Added console logging for debugging
- Show clear error toast instead of silently failing

## Deployment Steps

### Step 1: Verify Tests Pass (Development)

```bash
# Run all tests
npx vitest run

# Expected output: All tests passing
✓ tests/backend/auth.test.ts (13 tests)
✓ tests/backend/onboarding.test.ts (8 tests)
✓ tests/frontend/onboarding.test.tsx (25+ tests)
```

### Step 2: Test Locally (Development)

```bash
# Start development server
npm run dev

# Test scenarios:
1. Login as platform admin → Complete onboarding → Should reach /platform-admin
2. Login as client admin → Complete onboarding → Should reach /analytics
3. Login as client admin → Skip onboarding → Should reach /analytics
```

### Step 3: Deploy to Production

**Deployment Steps:**

1. Build the application:
   ```bash
   npm run build
   ```
2. Deploy to your hosting platform (Azure, AWS, etc.)
3. Ensure environment variables are set:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `APP_URL`
   - `RESEND_API_KEY`
   - `OPENAI_API_KEY`
   - `RETELL_API_KEY`
4. Run database migrations if needed
5. Restart the production server

### Step 4: Verify Production Fix

**Test with affected user:**

1. Go to `https://hub-embellics.com`
2. Login as `william.animesh@gmail.com` (or other affected user)
3. Verify onboarding flow:
   - ✅ "Skip for now" button works
   - ✅ Going through all 5 steps works
   - ✅ Successfully redirects to dashboard
   - ✅ No loop back to step 1

**Test with platform admin:**

1. Login as `admin@embellics.com` / `admin123`
2. Create new client admin invitation
3. Login with temporary password
4. Complete or skip onboarding
5. Verify successful redirect to analytics

### Step 5: Monitor for Errors

Check production logs for any errors:

```bash
# Check application logs for errors related to:
- /api/auth/complete-onboarding
- /api/auth/login
- Onboarding flow
```

## Database State

### Development Database

- Separate from production
- Auto-resets on server restart
- Platform owner: `admin@embellics.com` / `admin123`

### Production Database

- Persistent data
- Platform owner password auto-resets to `admin123` on deployment
- Existing user data preserved

## Rollback Plan

If issues occur after deployment:

1. **Immediate:** Revert to previous deployment using your platform's rollback feature
2. **Temporary Fix:** Platform owner can manually update `onboarding_completed` in database
3. **Alternative:** Restore database from backup

## Post-Deployment Verification

### Success Criteria

- [ ] Client admins can complete onboarding
- [ ] Client admins can skip onboarding
- [ ] Platform admins can complete onboarding
- [ ] No 401 errors in `/api/auth/complete-onboarding`
- [ ] Users redirect to correct dashboard based on role
- [ ] No loop back to step 1

### Metrics to Monitor

- **Error Rate:** Should be 0% for `/api/auth/complete-onboarding`
- **Completion Rate:** Should increase (users no longer stuck)
- **User Complaints:** Should decrease significantly

## Known Issues (Resolved)

✅ **Issue #1:** Onboarding loop - FIXED
✅ **Issue #2:** Skip button not working - FIXED
✅ **Issue #3:** Platform admin onboarding failing - FIXED

## Additional Notes

### Auto-Reset Password Feature

The platform owner password (`admin@embellics.com`) is automatically reset to `admin123` on every server startup/deployment. This ensures:

- Platform owner always has access
- Consistent testing credentials
- Easy recovery if password is lost

### Security Considerations

- Temporary passwords are hashed in database
- Plaintext temporary passwords visible only to platform owner for 7 days
- All user passwords hashed with bcrypt
- JWT tokens expire after 7 days

## Support

If issues persist after deployment:

1. Check `TESTING.md` for test scenarios
2. Review server logs for errors
3. Verify database schema is up to date
4. Contact platform administrator

## Testing Checklist

Before marking deployment as successful:

- [ ] All automated tests pass
- [ ] Manual testing in development complete
- [ ] Production deployment successful
- [ ] Platform owner login works
- [ ] Client admin onboarding works (full flow)
- [ ] Client admin onboarding works (skip flow)
- [ ] Platform admin onboarding works
- [ ] No console errors in browser
- [ ] No server errors in logs
- [ ] Affected users notified and verified fix
