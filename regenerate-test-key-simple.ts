import dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { apiKeys, tenants } from './shared/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL!;
const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function regenerateTestApiKey() {
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);

  console.log('🔄 Regenerating API key for testing...\n');

  // Get the test tenant
  const testTenant = await db.select().from(tenants).where(eq(tenants.name, 'SWC')).limit(1);

  if (testTenant.length === 0) {
    console.log('❌ No tenant named "SWC" found!');
    return;
  }

  const tenant = testTenant[0];
  console.log(`Found tenant: ${tenant.name} (${tenant.id})\n`);

  // Delete old API key for this tenant
  const oldKeys = await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenant.id)).returning();

  if (oldKeys.length > 0) {
    console.log(`🗑️  Deleted ${oldKeys.length} old API key(s)\n`);
  }

  // Generate new API key (matching server logic)
  const apiKey = randomBytes(32).toString('hex');
  const keyPrefix = apiKey.substring(0, 8); // First 8 chars for display (NO embellics_ prefix)
  const fullKey = `embellics_${apiKey}`;
  const keyHash = await hashPassword(fullKey);

  // Insert new API key
  const [newKey] = await db
    .insert(apiKeys)
    .values({
      name: 'Widget Test Key',
      keyPrefix,
      keyHash,
      tenantId: tenant.id,
    })
    .returning();

  console.log('✅ New API key created successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔑 FULL API KEY (copy this!):\n');
  console.log(`   ${fullKey}\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Key Details:');
  console.log(`  Name: ${newKey.name}`);
  console.log(`  Prefix: ${keyPrefix}`);
  console.log(`  Tenant: ${tenant.name}`);
  console.log(`  Created: ${newKey.createdAt}\n`);
  console.log('⚠️  IMPORTANT: Save this key somewhere safe!');
  console.log('   It will NOT be shown again for security reasons.\n');
  console.log('📝 Use this key in your widget test file:');
  console.log(`   data-api-key="${fullKey}"`);
}

regenerateTestApiKey()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
