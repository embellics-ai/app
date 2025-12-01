// Test OAuth Proxy in PRODUCTION
// Tests the deployed OAuth credential proxy system

const https = require('https');
require('dotenv').config({ path: '.env.local' });

const PROD_URL = 'embellics-app.onrender.com';
const TENANT_ID = 'e3fe58df-4077-4fc2-a75a-f0fa8ac50028';
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET;

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: PROD_URL,
      path: path,
      method: 'GET',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function runTests() {
  console.log('\n🧪 OAuth Credential Proxy Testing - PRODUCTION');
  console.log('\n================================\n');

  // Test 1: OAuth Authorization Redirect
  console.log('Test 1: OAuth Authorization Endpoint');
  console.log('--------------------------------------');
  console.log(`GET https://${PROD_URL}/api/platform/tenants/${TENANT_ID}/oauth/whatsapp/authorize`);
  try {
    const result = await makeRequest(`/api/platform/tenants/${TENANT_ID}/oauth/whatsapp/authorize`);
    if (result.status === 302 && result.headers.location?.includes('facebook.com')) {
      console.log('✅ OAuth redirect working!');
      console.log(`   Redirects to: ${result.headers.location.substring(0, 80)}...`);
    } else {
      console.log(`⚠️  Unexpected response: ${result.status}`);
      console.log(`   Body: ${result.body.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n');

  // Test 2: Proxy API with Valid Token
  console.log('Test 2: Test Proxy API Authentication');
  console.log('--------------------------------------');
  console.log(`GET https://${PROD_URL}/api/proxy/${TENANT_ID}/whatsapp/test`);
  console.log(`Authorization: Bearer ${N8N_SECRET.substring(0, 20)}...`);
  try {
    const result = await makeRequest(
      `/api/proxy/${TENANT_ID}/whatsapp/test`,
      { 'Authorization': `Bearer ${N8N_SECRET}` }
    );
    
    console.log(`Status: ${result.status}`);
    const response = JSON.parse(result.body);
    console.log('Response:', JSON.stringify(response, null, 2));
    
    if (result.status === 200 && response.connected) {
      console.log('\n✅ Proxy API is working!');
      console.log(`   WhatsApp connection: CONNECTED`);
      console.log(`   Phone: ${response.phoneNumber}`);
      console.log(`   Verified Name: ${response.verifiedName}`);
      console.log(`   Quality: ${response.quality}`);
    } else {
      console.log('\n⚠️  Unexpected response');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n');

  // Test 3: Invalid Token
  console.log('Test 3: Test Invalid Auth Token');
  console.log('--------------------------------');
  console.log(`GET https://${PROD_URL}/api/proxy/${TENANT_ID}/whatsapp/test`);
  console.log('Authorization: Bearer invalid_token_12345');
  try {
    const result = await makeRequest(
      `/api/proxy/${TENANT_ID}/whatsapp/test`,
      { 'Authorization': 'Bearer invalid_token_12345' }
    );
    
    console.log(`Status: ${result.status}`);
    const response = JSON.parse(result.body);
    console.log('Response:', JSON.stringify(response, null, 2));
    
    if (result.status === 401) {
      console.log('\n✅ Authentication is working correctly!');
      console.log('   Invalid tokens are rejected');
    } else {
      console.log('\n⚠️  Expected 401, got', result.status);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('\n================================');
  console.log('📊 Production Test Summary');
  console.log('================================\n');
  console.log('Production URL:', `https://${PROD_URL}`);
  console.log('Test Tenant:', TENANT_ID);
  console.log('\n💡 Next Steps:');
  console.log('1. Update N8N workflows to use proxy URLs');
  console.log('2. Test sending WhatsApp messages via N8N');
  console.log('3. Monitor logs for any issues\n');
}

runTests().catch(console.error);
