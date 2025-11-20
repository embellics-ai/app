import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  try {
    await sql`ALTER TABLE widget_handoffs ALTER COLUMN chat_id DROP NOT NULL`;
    console.log('✅ Migration successful: chat_id is now nullable');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
