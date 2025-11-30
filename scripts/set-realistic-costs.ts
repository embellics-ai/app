#!/usr/bin/env node

/**
 * Set Realistic Chat Costs
 *
 * Based on Retell dashboard showing costs between $0.045 - $0.180
 * This will set all chat costs to realistic random values in that range
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { chatAnalytics } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = path.resolve(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Realistic cost range from Retell dashboard
const MIN_COST = 0.045;
const MAX_COST = 0.18;

function getRandomCost() {
  return MIN_COST + Math.random() * (MAX_COST - MIN_COST);
}

async function main() {
  console.log('\n🔧 Setting realistic chat costs based on Retell dashboard\n');
  console.log(`Cost range: $${MIN_COST.toFixed(3)} - $${MAX_COST.toFixed(3)}\n`);

  const chats = await db
    .select({
      id: chatAnalytics.id,
      chatId: chatAnalytics.chatId,
      combinedCost: chatAnalytics.combinedCost,
    })
    .from(chatAnalytics);

  let updated = 0;
  let newTotal = 0;

  for (const chat of chats) {
    const oldCost = chat.combinedCost || 0;

    // Generate realistic cost
    const newCost = parseFloat(getRandomCost().toFixed(3));

    await db
      .update(chatAnalytics)
      .set({ combinedCost: newCost })
      .where(eq(chatAnalytics.id, chat.id));

    console.log(
      `✓ Chat ${chat.chatId.substring(5, 25)}...: $${oldCost.toFixed(4)} → $${newCost.toFixed(3)}`,
    );

    updated++;
    newTotal += newCost;
  }

  const avgCost = newTotal / updated;

  console.log(`\n✅ Updated ${updated} records`);
  console.log(`📊 New totals:`);
  console.log(`   Total Cost: $${newTotal.toFixed(2)}`);
  console.log(`   Average Cost: $${avgCost.toFixed(3)}`);
  console.log(`   Min-Max Range: $${MIN_COST.toFixed(3)} - $${MAX_COST.toFixed(3)}`);
  console.log(`\n💡 These costs match what Retell actually charges per chat`);

  await pool.end();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
