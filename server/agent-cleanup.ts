import type { IStorage } from './storage';

const OFFLINE_THRESHOLD = 2 * 60 * 1000; // 2 minutes in milliseconds
const CLEANUP_INTERVAL = 60 * 1000; // Run every 1 minute

/**
 * Wait for database to be ready (migrations completed)
 */
async function waitForDatabase(storage: IStorage, maxAttempts = 30): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try to query tenants table - if it works, database is ready
      await storage.getAllTenants();
      console.log('[Agent Cleanup] Database ready');
      return true;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('[Agent Cleanup] Database not ready after maximum attempts');
        return false;
      }
      // Wait 1 second before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

/**
 * Background job that monitors agent last_seen timestamps and marks agents
 * as offline if they haven't sent a heartbeat in the last 2 minutes.
 */
export async function startAgentCleanupJob(storage: IStorage) {
  console.log('[Agent Cleanup] Waiting for database to be ready...');

  // Wait for database to be ready before starting cleanup
  const isReady = await waitForDatabase(storage);
  if (!isReady) {
    console.error('[Agent Cleanup] Failed to start - database not ready');
    return () => {}; // Return empty cleanup function
  }

  console.log('[Agent Cleanup] Starting background job (runs every 60 seconds)');

  const cleanupStaleAgents = async () => {
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

  // Run cleanup immediately on startup
  cleanupStaleAgents();

  // Then run every minute
  const interval = setInterval(cleanupStaleAgents, CLEANUP_INTERVAL);

  // Return cleanup function to stop the job (for graceful shutdown)
  return () => {
    console.log('[Agent Cleanup] Stopping background job');
    clearInterval(interval);
  };
}
