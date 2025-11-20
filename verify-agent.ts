import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { humanAgents } from './shared/schema';
import { eq } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function verify() {
  console.log('🔍 Checking for agent record...\n');
  
  const agents = await db
    .select()
    .from(humanAgents)
    .where(eq(humanAgents.email, 'hisloveforwords@gmail.com'));
  
  if (agents.length === 0) {
    console.log('❌ No agent record found!');
    console.log('The script may not have completed successfully.\n');
    return;
  }
  
  const agent = agents[0];
  console.log('✅ Agent record found!\n');
  console.log('Details:');
  console.log(`  ID: ${agent.id}`);
  console.log(`  Name: ${agent.name}`);
  console.log(`  Email: ${agent.email}`);
  console.log(`  Status: ${agent.status}`);
  console.log(`  Active Chats: ${agent.activeChats}`);
  console.log(`  Max Chats: ${agent.maxChats}`);
  console.log(`  Tenant: ${agent.tenantId}`);
  console.log(`  Created: ${agent.createdAt}`);
  console.log('\n✅ User can now pick up handoffs!');
}

verify()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
