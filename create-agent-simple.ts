import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { humanAgents, clientUsers } from './shared/schema';
import { eq } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  try {
    console.log('Starting...\n');

    // Get support staff user
    const users = await db
      .select()
      .from(clientUsers)
      .where(eq(clientUsers.email, 'hisloveforwords@gmail.com'));

    if (users.length === 0) {
      console.log('User not found');
      return;
    }

    const user = users[0];
    console.log('Found user:', user.email);
    console.log('Tenant:', user.tenantId);
    console.log('Name:', user.firstName, user.lastName);

    // Check if agent exists
    const existing = await db.select().from(humanAgents).where(eq(humanAgents.email, user.email));

    if (existing.length > 0) {
      console.log('\nAgent record already exists!');
      return;
    }

    // Create agent
    const name =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || 'Agent';

    const [newAgent] = await db
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

    console.log('\n✅ Created agent record:');
    console.log('ID:', newAgent.id);
    console.log('Name:', newAgent.name);
    console.log('Email:', newAgent.email);
    console.log('Status:', newAgent.status);
  } catch (error) {
    console.error('Error:', error);
  }
}

main().then(() => process.exit(0));
