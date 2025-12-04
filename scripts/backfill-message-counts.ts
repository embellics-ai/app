#!/usr/bin/env tsx
/**
 * Backfill Message Counts in Chat Analytics
 *
 * This script updates the message_count field in chat_analytics table
 * by counting actual messages from widget_chat_history table.
 *
 * Run with: npx tsx scripts/backfill-message-counts.ts
 */

import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function backfillMessageCounts() {
  console.log('🔧 Starting message count backfill...\n');

  try {
    // Get all chats with their current message counts
    const chatsResult = await pool.query(`
      SELECT id, chat_id, message_count, start_timestamp
      FROM chat_analytics
      ORDER BY start_timestamp DESC
    `);

    console.log(`📊 Found ${chatsResult.rows.length} chat sessions\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const chat of chatsResult.rows) {
      // Count actual messages for this chat
      const messagesResult = await pool.query(
        `SELECT COUNT(*) as actual_count
         FROM widget_chat_history
         WHERE chat_id = $1`,
        [chat.chat_id],
      );

      const actualCount = parseInt(messagesResult.rows[0].actual_count);
      const storedCount = chat.message_count || 0;

      if (actualCount !== storedCount) {
        // Update the message count
        await pool.query(
          `UPDATE chat_analytics
           SET message_count = $1
           WHERE id = $2`,
          [actualCount, chat.id],
        );

        console.log(
          `✓ Updated ${chat.chat_id.substring(0, 20)}... : ${storedCount} → ${actualCount} messages`,
        );
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Backfill complete!');
    console.log(`   Updated: ${updatedCount} chats`);
    console.log(`   Skipped: ${skippedCount} chats (already correct)`);
    console.log('═══════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the backfill
backfillMessageCounts()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
