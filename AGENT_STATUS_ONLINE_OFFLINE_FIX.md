# Agent Status Online/Offline Tracking

## Issue

Staff members (support_staff and client_admins with agent capabilities) were showing as "available" in the Agent Dashboard even when they were not logged in. This meant:

- ❌ Admins could assign chats to offline agents
- ❌ Chats would sit unhandled
- ❌ Poor customer experience

## Root Cause

When agent records were created on first login, the status was set to `'available'` and **never changed**. There was no logic to:

1. Update status to 'available' when user logs in
2. Update status to 'offline' when user logs out

## Solution Implemented

### 1. **Update Status to 'available' on Login**

**Modified File:** `server/routes.ts`

**Regular Login Flow (lines 243-280):**

```typescript
if (!agentExists) {
  // Create new agent record with status 'available'
  await storage.createHumanAgent(
    {
      name: agentName,
      email: user.email!,
      status: 'available',
      activeChats: 0,
      maxChats: 5,
    },
    user.tenantId,
  );
} else {
  // Agent exists - update status to 'available' on login
  const agent = agents.find((a) => a.email === user.email);
  if (agent && agent.status !== 'available') {
    await storage.updateHumanAgentStatus(agent.id, 'available', user.tenantId);
    console.log(`[Login] Updated agent status to 'available': ${user.email}`);
  }
}
```

**Impact:**

- ✅ New agents created with 'available' status
- ✅ Existing agents (who were offline) updated to 'available' on login

### 2. **Update Status to 'offline' on Logout**

**Modified File:** `server/routes.ts`

**Logout Endpoint (lines 351-369):**

```typescript
app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    if (user && user.tenantId && (user.role === 'support_staff' || user.role === 'client_admin')) {
      // Get agent record and update status to offline
      const agents = await storage.getHumanAgentsByTenant(user.tenantId);
      const agent = agents.find((a) => a.email === user.email);

      if (agent) {
        await storage.updateHumanAgentStatus(agent.id, 'offline', user.tenantId);
        console.log(`[Logout] Updated agent status to 'offline': ${user.email}`);
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Logout] Error updating agent status:', error);
    // Don't fail logout even if status update fails
    res.json({ message: 'Logged out successfully' });
  }
});
```

**Impact:**

- ✅ Agent status updated to 'offline' when user logs out
- ✅ Logout still succeeds even if status update fails
- ✅ Only affects users with agent capabilities (support_staff, client_admin)

### 3. **Agent Dashboard Filtering**

The Agent Dashboard already filters available agents correctly:

```typescript
const availableAgents = agents.filter(
  (agent) => agent.status === 'available' && agent.activeChats < agent.maxChats,
);
```

This ensures only online agents appear in assignment dropdowns.

## How It Works Now

### Agent Login Flow:

```
User logs in
  ↓
Check if agent record exists
  ↓
IF NEW:
  Create agent with status='available'
ELSE:
  Update existing agent to status='available'
  ↓
Agent appears in "Available Agents" list
  ↓
Can be assigned handoffs
```

### Agent Logout Flow:

```
User clicks logout
  ↓
Find their agent record
  ↓
Update status to 'offline'
  ↓
Agent removed from "Available Agents" list
  ↓
Cannot be assigned new handoffs
  ↓
Logout completes successfully
```

## Agent Status Values

### Current Status Options:

- **'available'** - Agent is logged in and can handle chats
- **'offline'** - Agent is logged out, cannot handle chats
- **'busy'** - (Future use) Agent is at capacity

### Future Enhancements:

- **'away'** - Agent is logged in but temporarily unavailable
- **'in_meeting'** - Agent is busy but logged in
- **'break'** - Agent is on break

## Testing Steps

### Test 1: Login Updates Status to Available

1. **Setup:**
   - Have an agent who was previously logged out (status='offline')

2. **Steps:**
   - Login as that agent
   - Check server console logs

3. **Expected:**
   - ✅ Log shows: `[Login] Updated agent status to 'available': [email]`
   - ✅ Agent appears in Agent Dashboard "Available Agents" (2)
   - ✅ Agent can be selected in "Assign to" dropdown

### Test 2: Logout Updates Status to Offline

1. **Setup:**
   - Login as agent (status should be 'available')

2. **Steps:**
   - Click logout button
   - Check server console logs
   - Login as admin
   - Check Agent Dashboard

3. **Expected:**
   - ✅ Log shows: `[Logout] Updated agent status to 'offline': [email]`
   - ✅ Agent does NOT appear in "Available Agents" count
   - ✅ Agent does NOT appear in "Assign to" dropdown

### Test 3: Multiple Sessions

1. **Setup:**
   - Agent logs in from Browser A
   - Agent logs in from Browser B (same account)

2. **Steps:**
   - Logout from Browser A
   - Check status in admin dashboard

3. **Expected:**
   - ⚠️ Agent becomes offline (last logout wins)
   - ⚠️ Browser B may show stale session
   - 📝 **Known limitation:** No session tracking per browser

### Test 4: Browser Close Without Logout

1. **Setup:**
   - Agent logs in

2. **Steps:**
   - Close browser without clicking logout
   - Check Agent Dashboard as admin

3. **Expected:**
   - ❌ Agent still shows as 'available' (status not updated)
   - 📝 **Known limitation:** No automatic offline on session timeout

## Database Schema

### human_agents Table:

```sql
CREATE TABLE human_agents (
  id UUID PRIMARY KEY,
  tenantId UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL, -- 'available', 'offline', 'busy'
  activeChats INTEGER DEFAULT 0,
  maxChats INTEGER DEFAULT 5,
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenantId, email)
);
```

### Status Update Query:

```sql
UPDATE human_agents
SET status = 'offline'
WHERE id = $1 AND tenantId = $2;
```

## API Endpoints Affected

### POST /api/auth/login

- **Before:** No agent status update
- **After:** Sets status='available' on login

### POST /api/auth/logout

- **Before:** Stub endpoint, no logic
- **After:** Sets status='offline' on logout

### GET /api/human-agents

- **No changes:** Already returns all agents with their status
- Frontend filters by status='available'

## Security Considerations

### 1. **Authorization:**

- ✅ Logout endpoint now requires authentication (`requireAuth`)
- ✅ Only updates status for the authenticated user
- ✅ Cannot update other users' status

### 2. **Tenant Isolation:**

- ✅ Agent status updates include tenantId check
- ✅ Users cannot affect agents in other tenants

### 3. **Error Handling:**

- ✅ Logout succeeds even if status update fails
- ✅ Login succeeds even if status update fails
- ✅ Errors logged for monitoring

## Performance Considerations

### Login:

- **Before:** 1 database query (user lookup)
- **After:** 2-3 database queries (user lookup + agent check + status update)
- **Impact:** Negligible (~10ms added to login time)

### Logout:

- **Before:** No database queries
- **After:** 2 database queries (agent lookup + status update)
- **Impact:** Minimal (~20ms added to logout time)

### Dashboard Polling:

- **No change:** Frontend already polls `/api/human-agents` every 5 seconds
- Status updates appear within 5 seconds on dashboard

## Known Limitations & Future Enhancements

### Limitations:

1. **Browser Close Detection:**
   - Agents who close browser without logout remain 'available'
   - **Workaround:** Implement session timeout

2. **Multiple Browser Sessions:**
   - Last logout sets status (no per-session tracking)
   - **Workaround:** Implement session management

3. **Network Interruption:**
   - If logout request fails, agent stays 'available'
   - **Workaround:** Implement heartbeat mechanism

### Future Enhancements:

**Option 1: Session Timeout**

```typescript
// Auto-logout after 30 minutes of inactivity
setInterval(() => {
  if (lastActivity < Date.now() - 30 * 60 * 1000) {
    updateAgentStatus(agentId, 'offline');
  }
}, 60000); // Check every minute
```

**Option 2: Heartbeat Mechanism**

```typescript
// Client sends heartbeat every 30 seconds
// Server marks offline if no heartbeat for 2 minutes
setInterval(() => {
  fetch('/api/agent/heartbeat', { method: 'POST' });
}, 30000);
```

**Option 3: WebSocket Connection Tracking**

```typescript
// When WebSocket disconnects, mark agent offline
ws.on('close', () => {
  updateAgentStatus(user.id, 'offline');
});
```

**Option 4: Manual Status Control**

```typescript
// Let agents set their own status
<Select value={status} onChange={(val) => updateStatus(val)}>
  <option value="available">Available</option>
  <option value="away">Away</option>
  <option value="busy">Busy</option>
</Select>
```

## Rollback Plan

If issues arise:

**Revert Changes:**

1. Remove status update logic from login flow (lines 263-270)
2. Revert logout endpoint to stub (lines 351-356)
3. Redeploy

**Impact of rollback:**

- Agents will stay 'available' permanently (like before)
- Assignment will work but may assign to offline agents
- Manual database updates needed to fix status

**Manual Fix Query:**

```sql
-- Set all agents to offline
UPDATE human_agents SET status = 'offline';

-- Set specific agent to available
UPDATE human_agents SET status = 'available'
WHERE email = 'agent@example.com';
```

## Monitoring & Debugging

### Key Log Messages:

```
[Login] Updated agent status to 'available': user@example.com
[Logout] Updated agent status to 'offline': user@example.com
[Login] Failed to update agent status: <error>
[Logout] Error updating agent status: <error>
```

### Database Queries for Monitoring:

```sql
-- Check agent status distribution
SELECT status, COUNT(*) FROM human_agents GROUP BY status;

-- Find agents who might be stuck 'available'
SELECT name, email, status, activeChats
FROM human_agents
WHERE status = 'available'
ORDER BY name;

-- Agents with active chats but offline
SELECT * FROM human_agents
WHERE status = 'offline' AND activeChats > 0;
```

## Summary

**What Changed:**

- ✅ Agent status updates to 'available' on login
- ✅ Agent status updates to 'offline' on logout
- ✅ Only online agents appear in assignment dropdown

**Why:**

- Prevent assigning chats to offline agents
- Accurate availability tracking
- Better customer experience

**Impact:**

- ✅ More reliable handoff assignment
- ✅ Agents only assigned when actually available
- ✅ Clear indication of team availability

**Limitations:**

- ⚠️ Browser close without logout doesn't update status
- ⚠️ Multiple sessions: last logout wins
- ⚠️ No automatic timeout/heartbeat (yet)

**Next Steps:**

1. Test login/logout status updates
2. Verify only online agents appear in dropdowns
3. Consider implementing session timeout or heartbeat
4. Add manual status control UI (optional)

---

**Status:** Implemented and ready for testing
**Files Modified:** `server/routes.ts` (2 changes)
**Breaking Changes:** None
**Migration Required:** None (works with existing data)
