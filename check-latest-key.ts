import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { apiKeys } from './shared/schema';
import dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

async function checkLatestKey() {
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  const allApiKeys = await db.select().from(apiKeys);

  if (allApiKeys.length === 0) {
    console.log('❌ No API keys in database!');
    return;
  }

  const latestKey = allApiKeys[allApiKeys.length - 1];
  
  console.log('Latest API Key in Database:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ID:', latestKey.id);
  console.log('Name:', latestKey.name);
  console.log('Prefix:', latestKey.keyPrefix);
  console.log('Full Hash:', latestKey.keyHash);
  console.log('Created:', latestKey.createdAt);
  console.log('');
  console.log('Expected API key format:');
  console.log(`embellics_${latestKey.keyPrefix}...`);
  console.log('');
  console.log('⚠️  The key you received when creating had the full hex string after "embellics_"');
  console.log('⚠️  Make sure you copied it EXACTLY from the success message!');
}

checkLatestKey()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
