import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env.local') });

/**
 * Database Cleanup Script
 *
 * This script removes ALL data from the database EXCEPT the platform admin user.
 * Use this for fresh testing after making schema changes.
 *
 * ⚠️  WARNING: This will DELETE ALL tenant data, conversations, messages, etc.
 *
 * What gets deleted:
 * - All tenants and related data
 * - All client users (except platform admin)
 * - All conversations and messages
 * - All widget configs and chat messages
 * - All analytics data
 * - All invitations
 * - All API keys
 * - All human agents
 * - All handoffs
 * - All password reset tokens
 *
 * What gets preserved:
 * - Platform admin user (isPlatformAdmin = true)
 */

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle(pool, { schema });

async function cleanDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // Step 1: Get platform admin users (to preserve them)
    console.log('📋 Finding platform admin users to preserve...');
    const platformAdmins = await db
      .select()
      .from(schema.clientUsers)
      .where(eq(schema.clientUsers.isPlatformAdmin, true));

    if (platformAdmins.length === 0) {
      console.warn('⚠️  No platform admin found! This script will delete ALL users.');
      console.warn('   You should run init-admin.ts after this to create a platform admin.');
    } else {
      console.log(`✅ Found ${platformAdmins.length} platform admin(s) to preserve:`);
      platformAdmins.forEach((admin) => {
        console.log(`   - ${admin.email} (${admin.firstName} ${admin.lastName})`);
      });
    }
    console.log('');

    // Step 2: Delete in correct order (respecting foreign key constraints)

    console.log('🗑️  Deleting widget handoff messages...');
    const deletedHandoffMessages = await db.delete(schema.widgetHandoffMessages);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting widget handoffs...');
    const deletedHandoffs = await db.delete(schema.widgetHandoffs);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting password reset tokens...');
    const deletedResetTokens = await db.delete(schema.passwordResetTokens);
    console.log(`   Deleted all records\n`);

    // Note: daily_analytics, analytics_events, and webhook_analytics tables removed in migration 0013
    // Note: messages and conversations tables removed in migration 0014 (replaced by widget_handoffs)

    console.log('🗑️  Deleting widget chat messages...');
    const deletedWidgetMessages = await db.delete(schema.widgetChatMessages);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting widget configs...');
    const deletedWidgetConfigs = await db.delete(schema.widgetConfigs);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting API keys...');
    const deletedApiKeys = await db.delete(schema.apiKeys);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting user invitations...');
    const deletedInvitations = await db.delete(schema.userInvitations);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting human agents...');
    const deletedHumanAgents = await db.delete(schema.humanAgents);
    console.log(`   Deleted all records\n`);

    console.log('🗑️  Deleting non-platform admin client users...');
    const deletedClientUsers = await db
      .delete(schema.clientUsers)
      .where(eq(schema.clientUsers.isPlatformAdmin, false));
    console.log(`   Deleted non-admin users\n`);

    console.log('🗑️  Deleting all tenants (cascade will handle related data)...');
    const deletedTenants = await db.delete(schema.tenants);
    console.log(`   Deleted all tenants\n`);

    console.log('🗑️  Deleting old users table (if any)...');
    const deletedOldUsers = await db.delete(schema.users);
    console.log(`   Deleted all records\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Database cleanup complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✓ Preserved ${platformAdmins.length} platform admin user(s)`);
    console.log('   ✓ Deleted all tenants and related data');
    console.log('   ✓ Deleted all conversations and messages');
    console.log('   ✓ Deleted all widget configurations');
    console.log('   ✓ Deleted all analytics data');
    console.log('   ✓ Deleted all API keys');
    console.log('   ✓ Deleted all human agents');
    console.log('   ✓ Deleted all invitations');
    console.log('   ✓ Deleted all handoffs');
    console.log('   ✓ Deleted all non-admin client users');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (platformAdmins.length > 0) {
      console.log('🔐 You can now log in with:');
      platformAdmins.forEach((admin) => {
        console.log(`   Email: ${admin.email}`);
        console.log(`   Password: (use your existing password)\n`);
      });
    } else {
      console.log('⚠️  No platform admin exists. Run this to create one:');
      console.log('   npm run init-admin\n');
    }

    console.log('✨ Database is now clean and ready for fresh testing!');
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanDatabase()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
