import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  try {
    // First, delete any handoffs with NULL chat_id (test data)
    const deleted = await sql`DELETE FROM widget_handoffs WHERE chat_id IS NULL`;
    console.log(`🗑️  Deleted ${deleted.length} handoff(s) with NULL chat_id`);

    // Now make chat_id NOT NULL again
    await sql`ALTER TABLE widget_handoffs ALTER COLUMN chat_id SET NOT NULL`;
    console.log('✅ Migration successful: chat_id is now required (NOT NULL)');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
