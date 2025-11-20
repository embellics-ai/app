#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { humanAgents, clientUsers } from './shared/schema';
import { eq } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

(async () => {
  try {
    process.stdout.write('🔍 Looking for support staff...\n\n');

    const [user] = await db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.email, 'hisloveforwords@gmail.com'))
      .limit(1);

    if (!user) {
      process.stdout.write('❌ User not found\n');
      process.exit(1);
    }

    process.stdout.write(`✅ Found: ${user.email}\n`);
    process.stdout.write(`   Tenant: ${user.tenantId}\n`);
    process.stdout.write(`   Name: ${user.firstName} ${user.lastName}\n\n`);

    const [existing] = await db
      .select()
      .from(humanAgents)
      .where(eq(humanAgents.email, user.email))
      .limit(1);

    if (existing) {
      process.stdout.write('ℹ️  Agent record already exists!\n');
      process.stdout.write(`   ID: ${existing.id}\n`);
      process.exit(0);
    }

    process.stdout.write('📝 Creating agent record...\n');

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Agent';

    const [agent] = await db
      .insert(humanAgents)
      .values({
        tenantId: user.tenantId,
        name,
        email: user.email,
        status: 'available',
        activeChats: 0,
        maxChats: 5,
      })
      .returning();

    process.stdout.write('\n✅ SUCCESS!\n');
    process.stdout.write(`   Agent ID: ${agent.id}\n`);
    process.stdout.write(`   Name: ${agent.name}\n`);
    process.stdout.write(`   Status: ${agent.status}\n`);
    process.stdout.write(`   Max Chats: ${agent.maxChats}\n`);
    process.stdout.write('\n🎉 User can now pick up handoffs!\n');
  } catch (error) {
    process.stderr.write(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
})();
