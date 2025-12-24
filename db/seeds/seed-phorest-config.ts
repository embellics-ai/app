/**
 * Seed Script: Phorest Configuration
 *
 * This seed script adds Phorest API credentials and business IDs to the database.
 * It's designed to be environment-specific and run separately for dev/staging/production.
 *
 * Configuration is loaded from environment variables for security:
 * - PHOREST_TENANT_ID
 * - PHOREST_USERNAME
 * - PHOREST_PASSWORD
 * - PHOREST_BUSINESS_ID
 * - PHOREST_BUSINESS_NAME
 * - PHOREST_BASE_URL (optional, defaults to EU)
 *
 * Usage:
 *   # Development
 *   npx tsx db/seeds/seed-phorest-config.ts
 *
 *   # Production (with env vars)
 *   PHOREST_TENANT_ID=xxx PHOREST_USERNAME=global/xxx PHOREST_PASSWORD=xxx \
 *   PHOREST_BUSINESS_ID=xxx PHOREST_BUSINESS_NAME="xxx" \
 *   npx tsx db/seeds/seed-phorest-config.ts
 *
 * Or create a .env.phorest file:
 *   PHOREST_TENANT_ID=your_tenant_id
 *   PHOREST_USERNAME=global/your-username
 *   PHOREST_PASSWORD=your-api-password
 *   PHOREST_BUSINESS_ID=your-business-id
 *   PHOREST_BUSINESS_NAME=Your Business Name
 *   PHOREST_BASE_URL=https://api-gateway-eu.phorest.com/third-party-api-server/api
 *
 * Then run: npx tsx db/seeds/seed-phorest-config.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { externalApiConfigs, tenantBusinesses, tenants } from '../../shared/schema';
import { encrypt } from '../../server/encryption';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.phorest' }); // Optional additional config file

async function seedPhorestConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🌱 Seeding Phorest Configuration');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: Validate environment variables
  const tenantId = process.env.PHOREST_TENANT_ID;
  const username = process.env.PHOREST_USERNAME;
  const password = process.env.PHOREST_PASSWORD;
  const businessId = process.env.PHOREST_BUSINESS_ID;
  const businessName = process.env.PHOREST_BUSINESS_NAME;
  const baseUrl =
    process.env.PHOREST_BASE_URL || 'https://api-gateway-eu.phorest.com/third-party-api-server/api';

  if (!tenantId || !username || !password || !businessId || !businessName) {
    console.error('❌ Missing required environment variables:');
    console.error('');
    console.error('Required:');
    console.error('  PHOREST_TENANT_ID      ' + (tenantId ? '✓' : '✗ Missing'));
    console.error('  PHOREST_USERNAME       ' + (username ? '✓' : '✗ Missing'));
    console.error('  PHOREST_PASSWORD       ' + (password ? '✓' : '✗ Missing'));
    console.error('  PHOREST_BUSINESS_ID    ' + (businessId ? '✓' : '✗ Missing'));
    console.error('  PHOREST_BUSINESS_NAME  ' + (businessName ? '✓' : '✗ Missing'));
    console.error('');
    console.error('Optional:');
    console.error(
      '  PHOREST_BASE_URL       ' + (process.env.PHOREST_BASE_URL ? '✓' : '(using default)'),
    );
    console.error('');
    console.error('Please set these environment variables and try again.');
    process.exit(1);
  }

  // Validate username format
  if (!username.startsWith('global/')) {
    console.warn('⚠️  Warning: Phorest username should start with "global/"');
    console.warn(`   Current value: ${username}`);
    console.warn('   Expected format: global/your-username');
    console.warn('');
  }

  console.log('Configuration to seed:');
  console.log('  Tenant ID:     ' + tenantId);
  console.log('  Username:      ' + username);
  console.log('  Password:      ' + '*'.repeat(password.length));
  console.log('  Business ID:   ' + businessId);
  console.log('  Business Name: ' + businessName);
  console.log('  Base URL:      ' + baseUrl);
  console.log('');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    // Step 2: Verify tenant exists
    console.log('🔍 Verifying tenant exists...');
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    if (!tenant) {
      console.error(`❌ Tenant not found: ${tenantId}`);
      console.error(
        '   Available tenants can be listed with: SELECT id, name, email FROM tenants;',
      );
      await pool.end();
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.name} (${tenant.email})`);
    console.log('');

    // Step 3: Encrypt credentials
    console.log('🔐 Encrypting credentials...');
    const credentialsJson = JSON.stringify({ username, password });
    const encryptedCredentials = encrypt(credentialsJson);
    console.log('✅ Credentials encrypted');
    console.log('');

    // Step 4: Check for existing external API config
    console.log('🔍 Checking for existing Phorest API configuration...');
    const existingConfig = await db
      .select()
      .from(externalApiConfigs)
      .where(
        and(
          eq(externalApiConfigs.tenantId, tenantId),
          eq(externalApiConfigs.serviceName, 'phorest_api'),
        ),
      );

    if (existingConfig.length > 0) {
      console.log('⚠️  Existing configuration found - Updating...');

      await db
        .update(externalApiConfigs)
        .set({
          baseUrl,
          encryptedCredentials,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(externalApiConfigs.tenantId, tenantId),
            eq(externalApiConfigs.serviceName, 'phorest_api'),
          ),
        );

      console.log('✅ Updated external_api_configs');
    } else {
      console.log('📝 Creating new configuration...');

      await db.insert(externalApiConfigs).values({
        tenantId,
        serviceName: 'phorest_api',
        displayName: 'Phorest API',
        baseUrl,
        authType: 'basic',
        encryptedCredentials,
        isActive: true,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
      });

      console.log('✅ Created external_api_configs entry');
    }
    console.log('');

    // Step 5: Check for existing business
    console.log('🔍 Checking for existing business configuration...');
    const existingBusiness = await db
      .select()
      .from(tenantBusinesses)
      .where(
        and(
          eq(tenantBusinesses.tenantId, tenantId),
          eq(tenantBusinesses.serviceName, 'phorest_api'),
        ),
      );

    if (existingBusiness.length > 0) {
      console.log('⚠️  Existing business found - Updating...');

      await db
        .update(tenantBusinesses)
        .set({
          businessId,
          businessName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenantBusinesses.tenantId, tenantId),
            eq(tenantBusinesses.serviceName, 'phorest_api'),
          ),
        );

      console.log('✅ Updated tenant_businesses');
    } else {
      console.log('📝 Creating new business...');

      await db.insert(tenantBusinesses).values({
        tenantId,
        serviceName: 'phorest_api',
        businessId,
        businessName,
      });

      console.log('✅ Created tenant_businesses entry');
    }
    console.log('');

    // Step 6: Success summary
    console.log('='.repeat(60));
    console.log('✅ Phorest configuration seeded successfully!');
    console.log('='.repeat(60));
    console.log('');
    console.log('Configuration details:');
    console.log(`  Tenant:   ${tenant.name}`);
    console.log(`  Service:  phorest_api`);
    console.log(`  Business: ${businessName} (${businessId})`);
    console.log(`  Base URL: ${baseUrl}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test the connection: npx tsx scripts/test-phorest-connection.ts');
    console.log('  2. Try creating a client via POST /api/phorest/clients');
    console.log('  3. Check server logs for successful client creation');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('❌ Seeding failed:', error.message);
    console.error('');
    if (error.stack) {
      console.error(error.stack);
    }
    await pool.end();
    process.exit(1);
  }
}

seedPhorestConfig();
