import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import {
  users,
  clientUsers,
  tenants,
  apiKeys,
  widgetConfigs,
  conversations,
  messages,
  humanAgents,
  userInvitations,
} from "./shared/schema";
import { sql, eq } from "drizzle-orm";
import ws from "ws";

// Configure neon to use ws for WebSocket
neonConfig.webSocketConstructor = ws;

async function cleanupDatabase() {
  console.log("[Cleanup] Starting database cleanup...");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    // Delete data in the correct order to respect foreign key constraints
    console.log("[Cleanup] Deleting chat messages...");
    await db.delete(messages);

    console.log("[Cleanup] Deleting conversations...");
    await db.delete(conversations);

    console.log("[Cleanup] Deleting human agents...");
    await db.delete(humanAgents);

    console.log("[Cleanup] Deleting API keys...");
    await db.delete(apiKeys);

    console.log("[Cleanup] Deleting widget configs...");
    await db.delete(widgetConfigs);

    console.log("[Cleanup] Deleting user invitations...");
    await db.delete(userInvitations);

    console.log("[Cleanup] Deleting client users (non-platform admins)...");
    // Delete all client users except platform admins
    await db.delete(clientUsers).where(eq(clientUsers.isPlatformAdmin, false));

    console.log("[Cleanup] Deleting legacy users...");
    await db.delete(users);

    console.log("[Cleanup] Deleting tenants...");
    await db.delete(tenants);

    console.log("[Cleanup] ✓ Database cleanup completed successfully!");
    console.log("[Cleanup] Platform admin account preserved.");
  } catch (error) {
    console.error("[Cleanup] Error during cleanup:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run cleanup
cleanupDatabase()
  .then(() => {
    console.log("[Cleanup] Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Cleanup] Failed:", error);
    process.exit(1);
  });
