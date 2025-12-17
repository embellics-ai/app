import type { IStorage } from './storage';

const OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes in milliseconds
const CLEANUP_INTERVAL = 60 * 1000; // Run every 1 minute

/**
 * Wait for database to be ready (migrations completed)
 */
async function waitForDatabase(storage: IStorage, maxAttempts = 60): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try to query tenants table - if it works, database is ready
      await storage.getAllTenants();
      console.log('[Agent Cleanup] ✓ Database connection established');
      return true;
    } catch (error) {
      // Log progress every 10 attempts
      if (attempt % 10 === 0) {
        console.log(
          `[Agent Cleanup] Still waiting for database... (attempt ${attempt}/${maxAttempts})`,
        );
      }

      if (attempt === maxAttempts) {
        console.error('[Agent Cleanup] ✗ Database not ready after maximum attempts:', error);
        return false;
      }
      // Wait 500ms before retrying (shorter delay for faster startup)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

/**
 * Background job that monitors agent last_seen timestamps and marks agents
 * as offline if they haven't sent a heartbeat in the last 2 minutes.
 */
export async function startAgentCleanupJob(storage: IStorage) {
  console.log('[Agent Cleanup] Starting background job...');

  let isReady = false;
  let intervalId: NodeJS.Timeout | null = null;

  // Try to connect to database asynchronously (non-blocking)
  waitForDatabase(storage).then((ready) => {
    isReady = ready;
    if (ready) {
      console.log('[Agent Cleanup] ✓ Database connected, cleanup job active');
    } else {
      console.error('[Agent Cleanup] ✗ Could not connect to database, cleanup disabled');
    }
  });

  // Don't wait for database - start the interval immediately
  // The cleanup function will simply skip if database isn't ready yet

  const cleanupStaleAgents = async () => {
    // Skip if database isn't ready yet
    if (!isReady) {
      return;
    }

    try {
      // Get all tenants
      const allTenants = await storage.getAllTenants();
      const now = new Date();
      let updatedCount = 0;

      for (const tenant of allTenants) {
        const agents = await storage.getHumanAgentsByTenant(tenant.id);

        for (const agent of agents) {
          // Only check agents that are currently marked as 'available'
          if (agent.status === 'available' && agent.lastSeen) {
            const timeSinceLastSeen = now.getTime() - new Date(agent.lastSeen).getTime();

            // If no heartbeat for more than 2 minutes, mark as offline
            if (timeSinceLastSeen > OFFLINE_THRESHOLD) {
              await storage.updateHumanAgentStatus(agent.id, 'offline', tenant.id);
              updatedCount++;

              const minutesAgo = Math.round(timeSinceLastSeen / 60000);
              console.log(
                `[Agent Cleanup] Marked ${agent.email} as offline (last seen ${minutesAgo} minutes ago)`,
              );
            }
          }
        }
      }

      if (updatedCount > 0) {
        console.log(`[Agent Cleanup] Updated ${updatedCount} agent(s) to offline`);
      }
    } catch (error) {
      console.error('[Agent Cleanup] Error during cleanup:', error);
    }
  };

  // Run cleanup immediately (will skip if DB not ready)
  cleanupStaleAgents();

  // Then run every minute
  intervalId = setInterval(cleanupStaleAgents, CLEANUP_INTERVAL);

  // Return cleanup function to stop the job (for graceful shutdown)
  return () => {
    console.log('[Agent Cleanup] Stopping background job');
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}
