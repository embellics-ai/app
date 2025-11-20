import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, ne } from 'drizzle-orm';
import {
  clientUsers,
  tenants,
  conversations,
  messages,
  widgetConfigs,
  apiKeys,
  humanAgents,
  widgetHandoffs,
  widgetHandoffMessages,
  widgetChatMessages,
  userInvitations,
  passwordResetTokens,
} from '../shared/schema';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const PLATFORM_ADMIN_EMAIL = 'admin@embellics.com';

async function cleanDatabase() {
  console.log('🧹 Starting database cleanup...');
  console.log('⚠️  WARNING: This will delete ALL data except platform admin!');
  console.log('⚠️  Waiting 5 seconds before proceeding...\n');

  // Give user time to cancel
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  try {
    console.log('📋 Current database state:');

    // Count records before deletion
    const userCount = await db.select().from(clientUsers);
    const tenantCount = await db.select().from(tenants);
    const conversationCount = await db.select().from(conversations);
    const messageCount = await db.select().from(messages);
    const widgetConfigCount = await db.select().from(widgetConfigs);
    const apiKeyCount = await db.select().from(apiKeys);
    const humanAgentCount = await db.select().from(humanAgents);
    const widgetHandoffCount = await db.select().from(widgetHandoffs);
    const widgetHandoffMessageCount = await db.select().from(widgetHandoffMessages);
    const widgetChatMessageCount = await db.select().from(widgetChatMessages);
    const invitationCount = await db.select().from(userInvitations);
    const resetTokenCount = await db.select().from(passwordResetTokens);

    console.log(`  - Users: ${userCount.length}`);
    console.log(`  - Tenants: ${tenantCount.length}`);
    console.log(`  - Conversations: ${conversationCount.length}`);
    console.log(`  - Messages: ${messageCount.length}`);
    console.log(`  - Widget Configs: ${widgetConfigCount.length}`);
    console.log(`  - API Keys: ${apiKeyCount.length}`);
    console.log(`  - Human Agents: ${humanAgentCount.length}`);
    console.log(`  - Widget Handoffs: ${widgetHandoffCount.length}`);
    console.log(`  - Widget Handoff Messages: ${widgetHandoffMessageCount.length}`);
    console.log(`  - Widget Chat Messages: ${widgetChatMessageCount.length}`);
    console.log(`  - User Invitations: ${invitationCount.length}`);
    console.log(`  - Password Reset Tokens: ${resetTokenCount.length}`);
    console.log('');

    // Get platform admin user
    const platformAdmin = await db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.email, PLATFORM_ADMIN_EMAIL));

    if (platformAdmin.length === 0) {
      console.error('❌ ERROR: Platform admin not found!');
      console.error(`   Please ensure ${PLATFORM_ADMIN_EMAIL} exists in the database`);
      process.exit(1);
    }

    const adminId = platformAdmin[0].id;
    console.log(`✅ Found platform admin: ${PLATFORM_ADMIN_EMAIL} (ID: ${adminId})`);
    console.log('');

    // Start deletion process
    console.log('🗑️  Deleting data...\n');

    // 1. Delete password reset tokens
    console.log('  [1/12] Deleting password reset tokens...');
    await db.delete(passwordResetTokens);
    console.log('  ✓ Password reset tokens deleted');

    // 2. Delete user invitations
    console.log('  [2/12] Deleting user invitations...');
    await db.delete(userInvitations);
    console.log('  ✓ User invitations deleted');

    // 3. Delete widget handoff messages
    console.log('  [3/12] Deleting widget handoff messages...');
    await db.delete(widgetHandoffMessages);
    console.log('  ✓ Widget handoff messages deleted');

    // 4. Delete widget handoffs
    console.log('  [4/12] Deleting widget handoffs...');
    await db.delete(widgetHandoffs);
    console.log('  ✓ Widget handoffs deleted');

    // 5. Delete widget chat messages
    console.log('  [5/12] Deleting widget chat messages...');
    await db.delete(widgetChatMessages);
    console.log('  ✓ Widget chat messages deleted');

    // 6. Delete human agents
    console.log('  [6/12] Deleting human agents...');
    await db.delete(humanAgents);
    console.log('  ✓ Human agents deleted');

    // 7. Delete messages
    console.log('  [7/12] Deleting messages...');
    await db.delete(messages);
    console.log('  ✓ Messages deleted');

    // 8. Delete conversations
    console.log('  [8/12] Deleting conversations...');
    await db.delete(conversations);
    console.log('  ✓ Conversations deleted');

    // 9. Delete API keys
    console.log('  [9/12] Deleting API keys...');
    await db.delete(apiKeys);
    console.log('  ✓ API keys deleted');

    // 10. Delete widget configs
    console.log('  [10/12] Deleting widget configs...');
    await db.delete(widgetConfigs);
    console.log('  ✓ Widget configs deleted');

    // 11. Delete tenants (this will cascade delete related records)
    console.log('  [11/12] Deleting tenants...');
    await db.delete(tenants);
    console.log('  ✓ Tenants deleted');

    // 12. Delete all users EXCEPT platform admin
    console.log('  [12/12] Deleting users (except platform admin)...');
    const deletedUsers = await db
      .delete(clientUsers)
      .where(ne(clientUsers.email, PLATFORM_ADMIN_EMAIL))
      .returning();
    console.log(`  ✓ Deleted ${deletedUsers.length} users (kept platform admin)`);

    console.log('');
    console.log('✅ Database cleanup complete!');
    console.log('');
    console.log('📊 Remaining data:');
    console.log(`  - Platform Admin: ${PLATFORM_ADMIN_EMAIL}`);
    console.log('  - All other tables: EMPTY');
    console.log('');
    console.log('🎯 You can now test with a clean slate!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('  1. Login as platform admin');
    console.log('  2. Create a new tenant/client admin');
    console.log('  3. Test the password reset flow');
    console.log('  4. Create staff members and test');
    console.log('');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run cleanup
cleanDatabase()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
