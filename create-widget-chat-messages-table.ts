import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { widgetChatMessages } from './shared/schema';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function migrate() {
  console.log('[Migration] Creating widget_chat_messages table...');

  try {
    // Create the table using raw SQL
    await sql`
      CREATE TABLE IF NOT EXISTS widget_chat_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;

    // Create index for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_widget_chat_messages_chat_id 
      ON widget_chat_messages(chat_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_widget_chat_messages_timestamp 
      ON widget_chat_messages(timestamp)
    `;

    console.log('[Migration] ✅ Table widget_chat_messages created successfully');
    console.log('[Migration] ✅ Indexes created successfully');
  } catch (error) {
    console.error('[Migration] ❌ Failed:', error);
    throw error;
  }
}

migrate()
  .then(() => {
    console.log('[Migration] Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Failed:', error);
    process.exit(1);
  });
