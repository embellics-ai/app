# Agent Status Heartbeat Implementation

## Problem

Bhukkha Reddy (hisloveforwords@gmail.com) shows status as 'available' even when not logged in.

**Root Cause:** When users close browser tab/window or navigate away, the logout endpoint is NOT called. Status remains 'available' forever.

## Database Evidence

```
Name:         Bhukkha Reddy
Email:        hisloveforwords@gmail.com
Status:       available  ⚠️ STALE - User not logged in!
Active Chats: 2 / 5
Created:      Thu Nov 20 2025 22:09:36 GMT+0000 (Greenwich Mean Time)
```

## Solution: Heartbeat Mechanism

### Architecture

```
┌─────────────────┐
│  Client (React) │
│                 │
│  Every 30sec:   │
│  POST /api/     │
│  heartbeat      │
└────────┬────────┘
         │
         ▼
┌────────────────────────┐
│  Server (Express)      │
│                        │
│  Updates last_seen     │
│  timestamp in DB       │
└────────────────────────┘
         │
         ▼
┌────────────────────────┐
│  Background Job        │
│                        │
│  Every 2 minutes:      │
│  Mark agents offline   │
│  if last_seen > 2 min  │
└────────────────────────┘
```

### Implementation Plan

1. **Add `last_seen` column to `human_agents` table**
2. **Create heartbeat endpoint** (`POST /api/auth/heartbeat`)
3. **Client-side heartbeat hook** (React hook that pings every 30s)
4. **Background cleanup job** (marks agents offline if no heartbeat for 2 min)

## Implementation

### 1. Database Migration

Add `last_seen` column:

```typescript
// migrations/XXXX_add_last_seen_to_agents.ts
ALTER TABLE human_agents
ADD COLUMN last_seen TIMESTAMP DEFAULT NOW();
```

### 2. Update Schema

```typescript
// shared/schema.ts
export const humanAgents = pgTable('human_agents', {
  // ... existing fields
  lastSeen: timestamp('last_seen').defaultNow(),
});
```

### 3. Heartbeat Endpoint

```typescript
// server/routes.ts
app.post('/api/auth/heartbeat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    if (user && user.tenantId && (user.role === 'support_staff' || user.role === 'client_admin')) {
      const agents = await storage.getHumanAgentsByTenant(user.tenantId);
      const agent = agents.find((a) => a.email === user.email);

      if (agent) {
        await storage.updateAgentLastSeen(agent.id, user.tenantId);

        // Also ensure status is 'available' if it was offline
        if (agent.status === 'offline') {
          await storage.updateHumanAgentStatus(agent.id, 'available', user.tenantId);
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[Heartbeat] Error:', error);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});
```

### 4. Client-Side Heartbeat Hook

```typescript
// client/src/hooks/use-heartbeat.ts
import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function useHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    // Only run for agents (support_staff and client_admin)
    if (!user || (user.role !== 'support_staff' && user.role !== 'client_admin')) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/auth/heartbeat', {
          method: 'POST',
          credentials: 'include',
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    };

    // Send immediately on mount
    sendHeartbeat();

    // Then send every 30 seconds
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => clearInterval(interval);
  }, [user]);
}
```

### 5. Add Heartbeat to App

```typescript
// client/src/App.tsx
import { useHeartbeat } from '@/hooks/use-heartbeat';

function App() {
  useHeartbeat(); // Add this line

  // ... rest of the app
}
```

### 6. Background Cleanup Job

```typescript
// server/agent-cleanup.ts
import { storage } from './storage';

const OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

export async function cleanupStaleAgents() {
  try {
    const allTenants = await storage.getAllTenants();

    for (const tenant of allTenants) {
      const agents = await storage.getHumanAgentsByTenant(tenant.id);
      const now = new Date();

      for (const agent of agents) {
        if (agent.status === 'available' && agent.lastSeen) {
          const timeSinceLastSeen = now.getTime() - new Date(agent.lastSeen).getTime();

          if (timeSinceLastSeen > OFFLINE_THRESHOLD) {
            await storage.updateHumanAgentStatus(agent.id, 'offline', tenant.id);
            console.log(
              `[Cleanup] Marked ${agent.email} as offline (last seen ${Math.round(timeSinceLastSeen / 1000)}s ago)`,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('[Cleanup] Error:', error);
  }
}

// Run every minute
setInterval(cleanupStaleAgents, 60 * 1000);
```

### 7. Update Storage Interface

```typescript
// server/storage.ts
interface Storage {
  // ... existing methods
  updateAgentLastSeen(agentId: string, tenantId: string): Promise<void>;
}

// In MemoryStorage and DbStorage:
async updateAgentLastSeen(agentId: string, tenantId: string): Promise<void> {
  await this.db
    .update(humanAgents)
    .set({ lastSeen: new Date() })
    .where(
      and(
        eq(humanAgents.id, agentId),
        eq(humanAgents.tenantId, tenantId)
      )
    );
}
```

## Immediate Fix (Without Heartbeat)

To fix Bhukkha's status RIGHT NOW without implementing heartbeat:

```bash
# Create a quick script to mark offline
npx tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
await sql\`UPDATE human_agents SET status = 'offline' WHERE email = 'hisloveforwords@gmail.com'\`;
console.log('Updated Bhukkha to offline');
"
```

Or update the database directly via the Agent Dashboard (if we add a manual status toggle).

## Testing Plan

1. **Test heartbeat working:**
   - Login as agent
   - Check console for heartbeat logs
   - Verify last_seen updates every 30s

2. **Test cleanup job:**
   - Login as agent
   - Close browser WITHOUT logging out
   - Wait 2-3 minutes
   - Check agent status → should be 'offline'

3. **Test re-login:**
   - Agent shows offline
   - Login again
   - Heartbeat should mark as 'available'

## Future Enhancements

1. **Visual indicator** - Show "last seen" timestamp in Agent Dashboard
2. **Configurable timeout** - Let admins set timeout per tenant
3. **Away status** - Auto-switch to 'away' after 5 min, 'offline' after 15 min
4. **Manual status** - Let agents set custom status (Available, Away, Do Not Disturb)

## Deployment Notes

- Requires database migration
- Background job should run in main server process
- Monitor heartbeat endpoint for performance
- Consider Redis for heartbeat tracking (optional optimization)
