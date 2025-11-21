import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { apiKeys } from './shared/schema';
import { inArray } from 'drizzle-orm';

const exposedPrefixes = [
  'fcba7f5a', // embellics_fcba7f5aa6d138549945db5beda9a78102faf32c07e0a51d2e7a8f93cc694576
  '915f494a', // embellics_915f494a4e853a5dc97a2f09de314572460c7b40dc6c9699d41c23d7575a6844
  'd310fe4e', // embellics_d310fe4eca6791a4425e18e6af0614a9ceacb9269122a3bf965f04955df8e595
  '4c742acc', // embellics_4c742acc29b150844e6ba1ee19a47b58c3125eff2fc9e4a6f8824dc2613b133f
  '2e5a123d', // embellics_2e5a123d6582c4f1f89c8b180cbef73b67a0af76d849a6a43632b2de93521a05
  'de81b5ae', // embellics_de81b5ae9282712cd1f55247f5cfa3a67e9431793d96aea5bda96d17ca729729
  '01ba1bdd', // embellics_01ba1bdd3ae1fedd2ebdc98c665f9d971ff21c65aa421618a4cb1d9bc84b0845
  'a30ec232', // embellics_a30ec232bff311b45537c0fe626d4e365b4da69581160082468e2ac887434169
  '4fd1dfd3', // embellics_4fd1dfd3da533b716356bd2108f53c821015a16c89a5b3212d49dfc0fb6acfdb
];

async function revokeExposedKeys() {
  console.log('🔍 Checking for exposed API keys...\n');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  try {
    // First, check which keys exist
    const existingKeys = await db
      .select()
      .from(apiKeys)
      .where(inArray(apiKeys.keyPrefix, exposedPrefixes));

    if (existingKeys.length === 0) {
      console.log('✅ No exposed keys found in database. They may have already been deleted.');
      return;
    }

    console.log(`Found ${existingKeys.length} exposed API keys:`);
    existingKeys.forEach((key: any) => {
      console.log(
        `  - Prefix: ${key.keyPrefix} | Tenant ID: ${key.tenantId} | Created: ${key.createdAt}`,
      );
    });

    console.log('\n🗑️  Deleting exposed API keys...\n');

    // Delete the exposed keys
    await db.delete(apiKeys).where(inArray(apiKeys.keyPrefix, exposedPrefixes));

    console.log('✅ Successfully deleted exposed API keys!\n');

    // Verify deletion
    const remainingKeys = await db
      .select()
      .from(apiKeys)
      .where(inArray(apiKeys.keyPrefix, exposedPrefixes));

    if (remainingKeys.length === 0) {
      console.log('✅ Verification: All exposed keys have been removed from the database.\n');
    } else {
      console.log(
        `⚠️  Warning: ${remainingKeys.length} keys still remain. May need manual deletion.`,
      );
    }

    // Show remaining active keys
    const allKeys = await db
      .select({
        keyPrefix: apiKeys.keyPrefix,
        tenantId: apiKeys.tenantId,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys);

    console.log(`📊 Remaining active API keys: ${allKeys.length}`);
    if (allKeys.length > 0) {
      console.log('\nActive keys:');
      allKeys.forEach((key: any) => {
        console.log(
          `  - Prefix: ${key.keyPrefix} | Tenant ID: ${key.tenantId} | Created: ${key.createdAt}`,
        );
      });
    }

    console.log('\n✅ SECURITY FIX COMPLETE!');
    console.log('\n⚠️  NEXT STEPS:');
    console.log('1. Generate new API keys in the admin dashboard');
    console.log('2. Update production widget embeds with new keys');
    console.log('3. Remove keys from git history using git-filter-repo');
    console.log('4. Rotate other credentials (SMTP, database, Retell API, encryption key)');
  } catch (error) {
    console.error('❌ Error revoking API keys:', error);
    throw error;
  }
}

// Run the script
revokeExposedKeys()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
