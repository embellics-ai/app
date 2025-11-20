import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import {
  widgetChatMessages,
  widgetHandoffs,
  widgetHandoffMessages,
  humanAgents,
} from './shared/schema';
import { eq } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...\n');

  try {
    // Get the tenant ID for SWC
    const tenantId = '3e9340e5-4dd0-434d-93b2-907d4850b87a';

    // 1. Delete widget handoff messages
    console.log('📝 Deleting handoff messages...');
    const deletedMessages = await db.delete(widgetHandoffMessages).returning();
    console.log(`   ✓ Deleted ${deletedMessages.length} handoff messages\n`);

    // 2. Delete widget handoffs
    console.log('🤝 Deleting handoff requests...');
    const deletedHandoffs = await db
      .delete(widgetHandoffs)
      .where(eq(widgetHandoffs.tenantId, tenantId))
      .returning();
    console.log(`   ✓ Deleted ${deletedHandoffs.length} handoff requests\n`);

    // 3. Delete widget chat messages
    console.log('💬 Deleting chat messages...');
    const deletedChats = await db
      .delete(widgetChatMessages)
      .where(eq(widgetChatMessages.tenantId, tenantId))
      .returning();
    console.log(`   ✓ Deleted ${deletedChats.length} chat messages\n`);

    // 4. Reset agent's active chat count
    console.log('👤 Resetting agent status...');
    const updatedAgents = await db
      .update(humanAgents)
      .set({
        activeChats: 0,
        status: 'available',
      })
      .where(eq(humanAgents.tenantId, tenantId))
      .returning();

    if (updatedAgents.length > 0) {
      updatedAgents.forEach((agent) => {
        console.log(`   ✓ Reset ${agent.name} (${agent.email})`);
        console.log(`     Status: ${agent.status}, Active Chats: ${agent.activeChats}\n`);
      });
    }

    console.log('✅ Cleanup complete!\n');
    console.log('📋 What was preserved:');
    console.log('   ✓ API keys');
    console.log('   ✓ Agent records');
    console.log('   ✓ Widget configuration');
    console.log('   ✓ User accounts');
    console.log('   ✓ Tenant data\n');

    console.log('🧪 Ready for fresh testing!');
    console.log('   1. Open widget test page');
    console.log('   2. Start new chat');
    console.log('   3. Request handoff');
    console.log('   4. Pick up in Agent Queue\n');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

cleanupTestData()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
