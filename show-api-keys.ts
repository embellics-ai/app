import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { apiKeys } from './shared/schema';
import dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

async function showApiKeys() {
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  console.log('🔍 Fetching all API keys from database...\n');

  const allApiKeys = await db.select().from(apiKeys);

  if (allApiKeys.length === 0) {
    console.log('⚠️  No API keys found in database!');
    return;
  }

  console.log(`Found ${allApiKeys.length} API key(s):\n`);

  for (const key of allApiKeys) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Name: ${key.name}`);
    console.log(`Prefix: ${key.keyPrefix}`);
    console.log(`Tenant ID: ${key.tenantId}`);
    console.log(`Hash (first 40 chars): ${key.keyHash.substring(0, 40)}...`);
    console.log(`Created: ${key.createdAt}`);
    console.log(`Last Used: ${key.lastUsedAt || 'Never'}`);
    
    // Note: We cannot reconstruct the actual key from the hash
    // The key should have been shown only once when created
    console.log(`⚠️  Full key NOT stored in DB (security feature)`);
    console.log();
  }

  console.log('\n💡 To use the widget, you need the FULL API key that was shown');
  console.log('   when it was created (starts with "embellics_").');
  console.log('\n💡 If you lost the key, delete it and create a new one.');
}

showApiKeys()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
