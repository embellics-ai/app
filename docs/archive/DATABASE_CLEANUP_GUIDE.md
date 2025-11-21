# Database Cleanup Guide

## Overview

This guide explains how to clean up the database and start fresh with only the platform admin account.

## When to Use

Use the database cleanup script when:

- Testing authentication flows from scratch
- Resolving duplicate user issues
- Starting fresh after development/testing
- Need to clear all tenant data but keep the platform admin

## What Gets Deleted

The cleanup script will delete:

- ✅ All tenants and their data
- ✅ All client admins
- ✅ All support staff members
- ✅ All conversations and messages
- ✅ All widget configurations
- ✅ All API keys
- ✅ All human agents
- ✅ All widget handoffs and messages
- ✅ All widget chat messages
- ✅ All user invitations
- ✅ All password reset tokens

## What Gets Preserved

The script preserves:

- ✅ Platform admin account (`admin@embellics.com`)

## How to Run

### Step 1: Stop the Development Server

```bash
# Press Ctrl+C in the terminal running npm run dev
```

### Step 2: Run the Cleanup Script

```bash
npm run clean-db
```

### Step 3: Wait for Confirmation

The script will:

1. Show current database statistics
2. Wait 5 seconds (giving you time to cancel with Ctrl+C)
3. Delete all data except platform admin
4. Show summary of what was deleted

### Step 4: Restart the Server

```bash
npm run dev
```

## Example Output

```
🧹 Starting database cleanup...
⚠️  WARNING: This will delete ALL data except platform admin!
⚠️  Waiting 5 seconds before proceeding...

📋 Current database state:
  - Users: 15
  - Tenants: 3
  - Conversations: 245
  - Messages: 1,823
  - Widget Configs: 3
  - API Keys: 5
  - Human Agents: 8
  - Widget Handoffs: 32
  - Widget Handoff Messages: 156
  - Widget Chat Messages: 892
  - User Invitations: 4
  - Password Reset Tokens: 2

✅ Found platform admin: admin@embellics.com (ID: abc-123)

🗑️  Deleting data...

  [1/12] Deleting password reset tokens...
  ✓ Password reset tokens deleted
  [2/12] Deleting user invitations...
  ✓ User invitations deleted
  ...
  [12/12] Deleting users (except platform admin)...
  ✓ Deleted 14 users (kept platform admin)

✅ Database cleanup complete!

📊 Remaining data:
  - Platform Admin: admin@embellics.com
  - All other tables: EMPTY

🎯 You can now test with a clean slate!
```

## Post-Cleanup Testing Steps

After cleanup, follow these steps for systematic testing:

### 1. Login as Platform Admin

```
Email: admin@embellics.com
Password: admin123
```

### 2. Create a Test Tenant

1. Go to Platform Admin dashboard
2. Click "Invite User"
3. Select role: "Client Admin"
4. Enter email: `test@example.com`
5. Fill in company details
6. Copy the temporary password

### 3. Test Client Admin Login

1. Logout from platform admin
2. Login with test@example.com and temporary password
3. Complete password change
4. Verify you see client admin dashboard

### 4. Create Staff Members

1. As client admin, go to Team Management
2. Invite a support staff member
3. Test their login and password flow

### 5. Test Password Reset

1. Logout
2. Click "Forgot Password"
3. Enter staff member email
4. Check console logs for reset process
5. Reset password and login
6. Verify correct profile shows (staff, not admin!)

## Troubleshooting

### Script Shows "Platform admin not found"

```bash
# Reinitialize the platform admin
npm run init-admin
```

### Script Fails with Permission Error

Check that:

- DATABASE_URL is set correctly in .env
- Database is accessible
- No active connections are blocking deletion

### Want to Cancel Mid-Execution

Press `Ctrl+C` during the 5-second warning period.

## Safety Features

- ✅ 5-second warning before deletion
- ✅ Shows what will be deleted
- ✅ Preserves platform admin
- ✅ Provides detailed progress feedback
- ✅ Shows summary of deletions

## Related Scripts

- `npm run init-admin` - Create/reset platform admin
- `npm run db:push` - Push schema changes to database
- `npm run dev` - Start development server

## Notes

- The script uses CASCADE DELETE where appropriate
- Foreign key relationships are respected
- The platform admin password remains unchanged
- All console logs show detailed progress

## Emergency Recovery

If you accidentally delete the platform admin:

```bash
npm run init-admin
```

This will recreate the platform admin with default credentials.
