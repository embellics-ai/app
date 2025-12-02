#!/usr/bin/env node

/**
 * Insert Test OAuth Credential
 * Creates a test WhatsApp OAuth credential for testing the proxy API
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const TENANT_ID = 'e3fe58df-4077-4fc2-a75a-f0fa8ac50028'; // Test Corp
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
// Use the permanent token from WHATSAPP_WEBHOOK_VERIFY_TOKEN
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const WHATSAPP_APP_ID = process.env.WHATSAPP_APP_ID;
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// Encryption function (matches server/encryption.ts)
function encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

async function insertTestCredential() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('\n🔧 Inserting Test OAuth Credential\n');
    console.log('==================================\n');

    // Encrypt tokens
    const encryptedAccessToken = encrypt(WHATSAPP_ACCESS_TOKEN);
    const encryptedClientSecret = encrypt(WHATSAPP_APP_SECRET);

    // Token expiry: 60 days from now
    const tokenExpiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Check if credential exists
    const existing = await pool.query(
      'SELECT * FROM oauth_credentials WHERE tenant_id = $1 AND provider = $2',
      [TENANT_ID, 'whatsapp'],
    );

    if (existing.rows.length > 0) {
      console.log('⚠️  OAuth credential already exists for Test Corp');
      console.log('   Updating existing credential...\n');

      await pool.query(
        `
        UPDATE oauth_credentials 
        SET 
          access_token = $1,
          token_expiry = $2,
          is_active = true,
          metadata = $3,
          updated_at = NOW()
        WHERE tenant_id = $4 AND provider = $5
      `,
        [
          encryptedAccessToken,
          tokenExpiry,
          JSON.stringify({
            phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
            businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
          }),
          TENANT_ID,
          'whatsapp',
        ],
      );

      console.log('✅ Updated existing OAuth credential');
    } else {
      console.log('Creating new OAuth credential...\n');

      await pool.query(
        `
        INSERT INTO oauth_credentials (
          id,
          tenant_id,
          provider,
          client_id,
          client_secret,
          access_token,
          token_expiry,
          scopes,
          metadata,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          true,
          NOW(),
          NOW()
        )
      `,
        [
          TENANT_ID,
          'whatsapp',
          WHATSAPP_APP_ID,
          encryptedClientSecret,
          encryptedAccessToken,
          tokenExpiry,
          ['whatsapp_business_management', 'whatsapp_business_messaging'],
          JSON.stringify({
            phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
            businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
          }),
        ],
      );

      console.log('✅ Created new OAuth credential');
    }

    console.log('\n📊 Credential Details:');
    console.log('   Tenant: Test Corp');
    console.log('   Provider: WhatsApp');
    console.log(`   Token Expiry: ${tokenExpiry.toISOString()}`);
    console.log(`   Phone Number ID: ${WHATSAPP_PHONE_NUMBER_ID}`);
    console.log(`   Business Account ID: ${WHATSAPP_BUSINESS_ACCOUNT_ID}`);
    console.log('   Status: Active');

    console.log('\n✅ Test credential inserted successfully!');
    console.log('\n💡 Now you can test the proxy API:');
    console.log('   Run: node test-oauth.cjs\n');

    await pool.end();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

insertTestCredential();
