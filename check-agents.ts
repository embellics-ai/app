import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { humanAgents, users, tenants } from './shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function checkAgents() {
  console.log('🔍 Checking human agents in database...\n');

  const agents = await db
    .select({
      id: humanAgents.id,
      name: humanAgents.name,
      email: humanAgents.email,
      status: humanAgents.status,
      tenantId: humanAgents.tenantId,
      tenantName: tenants.name,
    })
    .from(humanAgents)
    .leftJoin(tenants, eq(humanAgents.tenantId, tenants.id));

  if (agents.length === 0) {
    console.log('❌ No human agents found in database!\n');
    console.log('The logged-in user needs a human_agents record to pick up handoffs.\n');
  } else {
    console.log(`Found ${agents.length} agent(s):\n`);
    agents.forEach((agent) => {
      console.log(`  Name: ${agent.name}`);
      console.log(`  Email: ${agent.email}`);
      console.log(`  Status: ${agent.status}`);
      console.log(`  Tenant: ${agent.tenantName} (${agent.tenantId})`);
      console.log('');
    });
  }

  console.log('\n🔍 Checking users table...\n');
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} user(s):\n`);
  allUsers.forEach((user) => {
    console.log(`  Name: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Tenant: ${user.tenantId}`);
    console.log('');
  });
}

checkAgents()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
