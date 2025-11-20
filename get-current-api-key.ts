import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { apiKeys, tenants } from './shared/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

async function getCurrentApiKey() {
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  console.log('🔍 Fetching current API keys from database...\n');

  // Get all API keys with tenant info
  const allApiKeys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      tenantId: apiKeys.tenantId,
      tenantName: tenants.name,
      createdAt: apiKeys.createdAt,
      lastUsed: apiKeys.lastUsed,
    })
    .from(apiKeys)
    .leftJoin(tenants, eq(apiKeys.tenantId, tenants.id));

  if (allApiKeys.length === 0) {
    console.log('⚠️  No API keys found in database!');
    console.log('\n💡 You need to:');
    console.log('   1. Login as platform admin');
    console.log('   2. Go to Clients page');
    console.log('   3. Assign Retell credentials to a client');
    console.log('   4. This will auto-generate a widget API key');
    return;
  }

  console.log(`Found ${allApiKeys.length} API key(s):\n`);

  for (const key of allApiKeys) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Name: ${key.name}`);
    console.log(`Tenant: ${key.tenantName} (${key.tenantId})`);
    console.log(`Prefix: embellics_${key.keyPrefix}`);
    console.log(`Created: ${key.createdAt}`);
    console.log(`Last Used: ${key.lastUsed || 'Never'}`);
    console.log();
  }

  console.log(`\n⚠️  IMPORTANT: The full API key is NOT stored in the database!`);
  console.log(`   It was only shown ONCE when created for security reasons.`);
  console.log(`\n✅ To get the API key for testing:`);
  console.log(`   1. Login to dashboard as the client (tenant owner)`);
  console.log(`   2. Go to "Widget Config" page`);
  console.log(`   3. Scroll to "Embed Code" section`);
  console.log(`   4. The embed code contains the FULL API key`);
  console.log(`   5. Copy that key for your test page`);
  console.log(`\n📝 If you don't see it in the dashboard:`);
  console.log(`   The client might need to regenerate the API key`);
  console.log(`   (This would create a new key with a new value)`);
}

getCurrentApiKey()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
