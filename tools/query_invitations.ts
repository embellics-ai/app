import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { userInvitations } from '../shared/schema';
import { desc } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set in environment');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  const rows = await db
    .select()
    .from(userInvitations)
    .orderBy(desc(userInvitations.createdAt))
    .limit(20);

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error('Error querying invitations:', err);
  process.exit(1);
});
