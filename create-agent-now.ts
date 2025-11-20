import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { humanAgents, clientUsers } from './shared/schema';
import { eq } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

console.log('Starting agent creation script...');

async function run() {
  console.log('Looking for user hisloveforwords@gmail.com...');

  const [user] = await db
    .select()
    .from(clientUsers)
    .where(eq(clientUsers.email, 'hisloveforwords@gmail.com'))
    .limit(1);

  if (!user) {
    console.log('ERROR: User not found');
    return;
  }

  console.log('Found user:', user.email);
  console.log('Tenant:', user.tenantId);

  const [existing] = await db
    .select()
    .from(humanAgents)
    .where(eq(humanAgents.email, user.email))
    .limit(1);

  if (existing) {
    console.log('Agent already exists:', existing.id);
    return;
  }

  console.log('Creating agent record...');

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Agent';

  const [agent] = await db
    .insert(humanAgents)
    .values({
      tenantId: user.tenantId!,
      name,
      email: user.email,
      status: 'available',
      activeChats: 0,
      maxChats: 5,
    })
    .returning();

  console.log('SUCCESS! Created agent:');
  console.log('  ID:', agent.id);
  console.log('  Name:', agent.name);
  console.log('  Status:', agent.status);
}

run()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
