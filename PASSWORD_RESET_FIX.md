# Password Reset Issue - Fix Documentation

## Problem Identified

The admin password for `admin@embellics.com` was being reset to `admin123` every time the server restarted. This prevented users from permanently changing their password.

### Root Cause

The `initializeDatabase()` function in `server/db-init.ts` runs on **every server startup** and was designed to:

1. Create the platform owner account if it doesn't exist (✓ correct)
2. **Reset the password to `admin123` if the account already exists** (❌ problematic)

This meant that any password changes made by the admin would be overwritten on the next server restart.

## Files Modified

### 1. `server/db-init.ts`

**Before:**

```typescript
} else {
  // Platform owner exists - ensure password is correct
  console.log('[DB Init] Platform owner found. Resetting password to ensure consistency...');
  const hashedPassword = await hashPassword(PLATFORM_OWNER_PASSWORD);
  await storage.updateClientUserPassword(platformOwner.id, hashedPassword);
  console.log('[DB Init] ✓ Platform owner password reset');
}
```

**After:**

```typescript
} else {
  // Platform owner exists - do NOT reset password to preserve user changes
  console.log('[DB Init] ✓ Platform owner already exists');
}
```

**Change:** Removed the automatic password reset logic that was running on every server startup. Now it only creates the account with default credentials if it doesn't exist, but preserves any password changes if the account already exists.

### 2. `init-admin.ts`

This is a manual recovery script that can be run to reset the password if you're locked out. Added warnings to make it clear that running this script will overwrite custom passwords:

**Changes:**

- Added clear warning messages before resetting password
- Added 3-second delay to allow users to cancel if run accidentally
- Only shows login credentials when account is newly created, not on every reset

## How Password Changes Work Now

1. **First Time Setup:** Server starts, creates admin account with `admin123`
2. **User Changes Password:** Admin logs in and changes password to something secure
3. **Server Restarts:** Password remains unchanged ✅
4. **If Locked Out:** Run `npm run init-admin` to manually reset (with warnings)

## Testing the Fix

To verify the fix works:

1. Start the server: `npm run dev`
2. Log in as `admin@embellics.com` with password `admin123`
3. Navigate to change password page and change it to something else (e.g., `NewSecurePassword123`)
4. Restart the server (Ctrl+C and `npm run dev` again)
5. Try logging in with `admin123` - it should fail ❌
6. Log in with the new password - it should work ✅

## Emergency Password Reset

If you're locked out of your account, you can run the manual recovery script:

```bash
npm run init-admin
```

**Warning:** This will reset the password back to `admin123`. The script will warn you and give you 3 seconds to cancel before proceeding.

## Security Implications

✅ **Fixed:** Passwords are now persistent across server restarts
✅ **Improved:** Users can now securely change their passwords
✅ **Maintained:** Emergency password reset script available if locked out
⚠️ **Reminder:** Always change default passwords after first login

## Staff Member Passwords

✅ **Good News:** Staff member (support_staff and client_admin) passwords are **NOT affected** by this issue.

Staff members are created through the invitation system:

1. Admin sends invitation with temporary password
2. Staff member logs in with temporary password
3. Staff member changes password on first login
4. Password is stored permanently in the database
5. **No automatic reset occurs on server restart**

The issue only affected the platform owner account (`admin@embellics.com`) because it had special initialization logic.

## Related Files

- `server/db-init.ts` - Auto-initialization (runs on every startup) - **FIXED**
- `init-admin.ts` - Manual recovery script (run only when locked out) - **IMPROVED**
- `server/routes.ts` - Password change endpoint (unchanged, works correctly)
- `server/auth.ts` - Password hashing/verification (unchanged)
