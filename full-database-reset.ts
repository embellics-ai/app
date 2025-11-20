import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {
  widgetChatMessages,
  widgetHandoffs,
  widgetHandoffMessages,
  humanAgents,
  apiKeys,
  widgetConfigs,
  clientUsers,
  tenants,
  conversations,
  messages,
  userInvitations,
} from './shared/schema';
import { ne } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function fullDatabaseReset() {
  console.log('🔥 FULL DATABASE RESET');
  console.log('⚠️  This will delete ALL data except platform admin\n');

  try {
    let totalDeleted = 0;

    // 1. Delete widget handoff messages
    console.log('📝 Deleting widget handoff messages...');
    const deletedHandoffMessages = await db.delete(widgetHandoffMessages).returning();
    console.log(`   ✓ Deleted ${deletedHandoffMessages.length} records\n`);
    totalDeleted += deletedHandoffMessages.length;

    // 2. Delete widget handoffs
    console.log('🤝 Deleting widget handoffs...');
    const deletedHandoffs = await db.delete(widgetHandoffs).returning();
    console.log(`   ✓ Deleted ${deletedHandoffs.length} records\n`);
    totalDeleted += deletedHandoffs.length;

    // 3. Delete widget chat messages
    console.log('💬 Deleting widget chat messages...');
    const deletedChatMessages = await db.delete(widgetChatMessages).returning();
    console.log(`   ✓ Deleted ${deletedChatMessages.length} records\n`);
    totalDeleted += deletedChatMessages.length;

    // 4. Delete conversation messages
    console.log('📨 Deleting conversation messages...');
    const deletedMessages = await db.delete(messages).returning();
    console.log(`   ✓ Deleted ${deletedMessages.length} records\n`);
    totalDeleted += deletedMessages.length;

    // 5. Delete conversations
    console.log('💭 Deleting conversations...');
    const deletedConversations = await db.delete(conversations).returning();
    console.log(`   ✓ Deleted ${deletedConversations.length} records\n`);
    totalDeleted += deletedConversations.length;

    // 6. Delete human agents
    console.log('👥 Deleting human agents...');
    const deletedAgents = await db.delete(humanAgents).returning();
    console.log(`   ✓ Deleted ${deletedAgents.length} records\n`);
    totalDeleted += deletedAgents.length;

    // 7. Delete API keys
    console.log('🔑 Deleting API keys...');
    const deletedApiKeys = await db.delete(apiKeys).returning();
    console.log(`   ✓ Deleted ${deletedApiKeys.length} records\n`);
    totalDeleted += deletedApiKeys.length;

    // 8. Delete widget configs (includes Retell credentials)
    console.log('⚙️  Deleting widget configs...');
    const deletedWidgetConfigs = await db.delete(widgetConfigs).returning();
    console.log(`   ✓ Deleted ${deletedWidgetConfigs.length} records\n`);
    totalDeleted += deletedWidgetConfigs.length;

    // 9. Delete user invitations (must be before users due to foreign key)
    console.log('✉️  Deleting user invitations...');
    const deletedInvitations = await db.delete(userInvitations).returning();
    console.log(`   ✓ Deleted ${deletedInvitations.length} records\n`);
    totalDeleted += deletedInvitations.length;

    // 10. Delete client users (except platform admin)
    console.log('👤 Deleting client users (keeping platform admin)...');
    const deletedUsers = await db
      .delete(clientUsers)
      .where(ne(clientUsers.isPlatformAdmin, true))
      .returning();
    console.log(`   ✓ Deleted ${deletedUsers.length} records\n`);
    totalDeleted += deletedUsers.length;

    // 11. Delete tenants
    console.log('🏢 Deleting tenants...');
    const deletedTenants = await db.delete(tenants).returning();
    console.log(`   ✓ Deleted ${deletedTenants.length} records\n`);
    totalDeleted += deletedTenants.length;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ RESET COMPLETE!`);
    console.log(`   Total records deleted: ${totalDeleted}\n`);

    // Verify what's left
    console.log('📋 Remaining data:');
    const remainingUsers = await db.select().from(clientUsers);
    console.log(`   Platform Admin Users: ${remainingUsers.length}`);
    remainingUsers.forEach((user) => {
      console.log(`   - ${user.email} (${user.isPlatformAdmin ? 'Platform Admin' : user.role})`);
    });

    console.log('\n🎯 Database is now clean!');
    console.log('   Ready to start fresh testing from scratch.\n');
    console.log('📝 Next steps:');
    console.log('   1. Login as platform admin');
    console.log('   2. Create a new tenant/client');
    console.log('   3. Assign Retell credentials');
    console.log('   4. Test the widget\n');
  } catch (error) {
    console.error('❌ Error during reset:', error);
    throw error;
  }
}

fullDatabaseReset()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
