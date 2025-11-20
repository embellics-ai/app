/**
 * Create Test Human Agent for Live Handoff Testing
 *
 * This script creates a human agent using your login email and the test tenant.
 * Run with: npx tsx create-test-agent-script.ts
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { apiKeys, clientUsers, humanAgents } from './shared/schema';
import { eq } from 'drizzle-orm';

async function createTestAgent() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log('🔍 Looking for tenant and user information...\n');

  // Find the test API key's tenant
  const apiKeysList = await db.select().from(apiKeys).limit(1);

  if (apiKeysList.length === 0) {
    console.error('❌ No API keys found');
    console.log('   Please create an API key first through the platform UI');
    process.exit(1);
  }

  const tenantId = apiKeysList[0].tenantId;
  console.log(`✅ Found tenant ID: ${tenantId}`);

  // Find a user for this tenant
  const users = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.tenantId, tenantId))
    .limit(1);

  if (users.length === 0) {
    console.error('❌ No users found for this tenant');
    console.log('   Please create a user first through the platform UI');
    process.exit(1);
  }

  const user = users[0];
  const userEmail = user.email;
  const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Test Agent';

  console.log(`✅ Found user: ${userName} (${userEmail})\n`);

  // Check if agent already exists
  const existingAgent = await db
    .select()
    .from(humanAgents)
    .where(eq(humanAgents.email, userEmail))
    .limit(1);

  if (existingAgent.length > 0) {
    console.log('⚠️  Human agent already exists for this email');
    console.log(`   Agent ID: ${existingAgent[0].id}`);
    console.log(`   Status: ${existingAgent[0].status}`);
    console.log(`   Max Chats: ${existingAgent[0].maxChats}\n`);

    // Update to ensure it's available
    await db
      .update(humanAgents)
      .set({
        status: 'available',
        maxChats: 5,
      })
      .where(eq(humanAgents.id, existingAgent[0].id));

    console.log('✅ Updated agent status to "available" and max_chats to 5');
  } else {
    // Create new agent
    const newAgent = await db
      .insert(humanAgents)
      .values({
        tenantId: tenantId,
        name: userName,
        email: userEmail,
        status: 'available',
        activeChats: 0,
        maxChats: 5,
      })
      .returning();

    console.log('✅ Created new human agent:');
    console.log(`   ID: ${newAgent[0].id}`);
    console.log(`   Name: ${newAgent[0].name}`);
    console.log(`   Email: ${newAgent[0].email}`);
    console.log(`   Status: ${newAgent[0].status}`);
    console.log(`   Max Chats: ${newAgent[0].maxChats}`);
  }

  console.log('\n🎉 Human agent is ready for testing!');
  console.log('\n📋 Next steps:');
  console.log('   1. Open http://localhost:3000/widget-simple-test.html');
  console.log('   2. Click "Talk to a Human" button (appears after 3 seconds)');
  console.log('   3. Login to platform and go to Agent Queue');
  console.log('   4. Pick up the handoff and start chatting!');
}

createTestAgent().catch((error) => {
  console.error('❌ Error creating test agent:', error);
  process.exit(1);
});
