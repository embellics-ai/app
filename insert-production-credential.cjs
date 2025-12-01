// Insert OAuth credential into PRODUCTION database
// Run this ONCE after deploying to production

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Use PRODUCTION database URL (you'll need to set this in your environment)
const PRODUCTION_DB_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: PRODUCTION_DB_URL,
  ssl: { rejectUnauthorized: false },
});

// AES-256-GCM encryption (matching server/storage.ts)
function encrypt(text) {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12); // 12 bytes for GCM

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

async function insertCredential() {
  try {
    const tenantId = 'e3fe58df-4077-4fc2-a75a-f0fa8ac50028'; // Test Corp tenant
    const provider = 'whatsapp';

    // Use the permanent token from WHATSAPP_WEBHOOK_VERIFY_TOKEN
    const accessToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (!accessToken) {
      throw new Error('WHATSAPP_WEBHOOK_VERIFY_TOKEN not found in environment');
    }

    const encryptedToken = encrypt(accessToken);

    // Token expires in 60 days, but permanent System User Token won't actually expire
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const metadata = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '915998021588678',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1471345187284298',
    };

    // Check if credential already exists
    const existingCheck = await pool.query(
      'SELECT id FROM oauth_credentials WHERE tenant_id = $1 AND provider = $2',
      [tenantId, provider],
    );

    if (existingCheck.rows.length > 0) {
      // Update existing credential
      await pool.query(
        `UPDATE oauth_credentials 
         SET access_token = $1, expires_at = $2, metadata = $3, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $4 AND provider = $5`,
        [encryptedToken, expiresAt, JSON.stringify(metadata), tenantId, provider],
      );
      console.log('✅ Updated existing OAuth credential in PRODUCTION');
    } else {
      // Insert new credential
      await pool.query(
        `INSERT INTO oauth_credentials (tenant_id, provider, access_token, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [tenantId, provider, encryptedToken, expiresAt, JSON.stringify(metadata)],
      );
      console.log('✅ Inserted new OAuth credential in PRODUCTION');
    }

    console.log(`   Tenant: ${tenantId}`);
    console.log(`   Provider: ${provider}`);
    console.log(`   Expires: ${expiresAt.toISOString().split('T')[0]}`);
    console.log(`   Phone Number ID: ${metadata.phoneNumberId}`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

insertCredential();
