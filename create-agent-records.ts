import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { humanAgents, clientUsers, tenants } from './shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function createAgentRecord() {
  console.log('🔍 Checking for users who need agent records...\n');

  // Get all support staff and admin users
  const users = await db.select().from(clientUsers).where(eq(clientUsers.role, 'support_staff'));

  console.log(`Found ${users.length} support staff user(s)\n`);

  for (const user of users) {
    const userName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.email!.split('@')[0];

    console.log(`Checking user: ${userName} (${user.email})`);
    console.log(`  Tenant ID: ${user.tenantId}`);
    console.log(`  Role: ${user.role}\n`);

    // Check if agent record already exists
    const existingAgent = await db
      .select()
      .from(humanAgents)
      .where(eq(humanAgents.email, user.email!))
      .limit(1);

    if (existingAgent.length > 0) {
      console.log(`  ✅ Agent record already exists\n`);
      continue;
    }

    // Create agent record
    if (user.tenantId) {
      const agentName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.email!.split('@')[0];

      const [newAgent] = await db
        .insert(humanAgents)
        .values({
          tenantId: user.tenantId,
          name: agentName,
          email: user.email!,
          status: 'available',
          activeChats: 0,
          maxChats: 5,
        })
        .returning();

      console.log(`  ✨ Created agent record:`);
      console.log(`     ID: ${newAgent.id}`);
      console.log(`     Status: ${newAgent.status}`);
      console.log(`     Max Chats: ${newAgent.maxChats}\n`);
    } else {
      console.log(`  ⚠️  User has no tenant ID, skipping\n`);
    }
  }

  console.log('\n📊 Final agent count:');
  const allAgents = await db.select().from(humanAgents);
  console.log(`   Total agents: ${allAgents.length}\n`);

  if (allAgents.length > 0) {
    console.log('All agents:');
    for (const agent of allAgents) {
      console.log(`  - ${agent.name} (${agent.email}) - Status: ${agent.status}`);
    }
  }
}

createAgentRecord()
  .then(() => {
    console.log('\n✅ Done! Support staff can now pick up handoffs.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
