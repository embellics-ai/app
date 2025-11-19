import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { userInvitations } from '../shared/schema';
import { sql } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set in environment');
    process.exit(1);
  }

  const sqlConn = neon(process.env.DATABASE_URL);
  const db = drizzle(sqlConn);

  console.log('[DB Cleanup] Nulling all plain_temporary_password values...');

  const result = await db
    .update(userInvitations)
    .set({ plainTemporaryPassword: null })
    .where(sql`${userInvitations.plainTemporaryPassword} IS NOT NULL`);

  console.log('[DB Cleanup] Updated rows:', result.rowCount || 0);
}

main().catch((err) => {
  console.error('Error nulling plaintext invitation passwords:', err);
  process.exit(1);
});
