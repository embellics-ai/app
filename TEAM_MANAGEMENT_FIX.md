# Team Management Issues - Complete Fix

## Problems Identified

### 1. Client Admin Shows "Pending"

- **Issue**: Status is based on `onboardingCompleted` flag
- **Cause**: Flag is only set to `true` during password reset flow
- **Impact**: Even logged-in users show as "Pending"

### 2. Support Staff Not Showing as Active Agents

- **Issue**: No human_agents record created automatically
- **Cause**: Agent record creation is manual (requires script)
- **Impact**: Staff can't pick up handoffs until agent record exists

### 3. Missing Auto-Creation Logic

- **Issue**: No automatic agent record creation on first login
- **Cause**: Login flow doesn't check/create agent records
- **Impact**: Manual intervention required for every support staff member

## Solutions

### Solution 1: Mark Onboarding Complete on First Login

Update the login endpoint to mark onboarding as complete when user successfully logs in:

```typescript
// In POST /api/auth/login - after successful login
if (!user.onboardingCompleted) {
  await storage.updateClientUser(user.id, {
    onboardingCompleted: true,
  });
}
```

### Solution 2: Auto-Create Human Agent Record

Add logic to create human_agents record automatically for support staff:

```typescript
// In POST /api/auth/login - after marking onboarding complete
if (user.role === 'support_staff' && user.tenantId) {
  // Check if agent record exists
  const agents = await storage.getHumanAgentsByTenant(user.tenantId);
  const agentExists = agents.some((a) => a.email === user.email);

  if (!agentExists) {
    // Create agent record
    await storage.createHumanAgent(
      {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email!,
        status: 'available',
        activeChats: 0,
        maxChats: 5,
      },
      user.tenantId,
    );

    console.log(`[Login] Created human agent record for ${user.email}`);
  }
}
```

### Solution 3: Create Agent Record on Invitation

Optionally create agent record when support staff is invited:

```typescript
// In POST /api/tenant/invite-member
if (role === 'support_staff' && tenantId) {
  await storage.createHumanAgent(
    {
      name: `${firstName} ${lastName}`,
      email,
      status: 'offline', // Start offline until first login
      activeChats: 0,
      maxChats: 5,
    },
    tenantId,
  );
}
```

## Implementation Priority

1. **Fix 1 (High Priority)**: Mark onboarding complete on login
   - Fixes "Pending" status for all users
   - Simple, low-risk change

2. **Fix 2 (High Priority)**: Auto-create agent record on login
   - Fixes missing agents issue
   - No manual intervention needed

3. **Fix 3 (Optional)**: Create agent record on invitation
   - Pre-creates records
   - Can set initial status to 'offline'

## Files to Modify

- `server/routes.ts` - Login endpoint (line ~160-250)
- `server/routes.ts` - Team invitation endpoint (line ~1100-1180)

## Testing Checklist

After implementing fixes:

1. ✅ Invite new support staff member
2. ✅ Staff member logs in with temp password
3. ✅ Staff member changes password
4. ✅ Check Team Management page - should show "Active"
5. ✅ Check human_agents table - record should exist
6. ✅ Staff member can pick up handoffs in Agent Queue
7. ✅ Client admin shows as "Active" not "Pending"
