#!/usr/bin/env node

/**
 * OAuth Testing Script
 * Tests the OAuth credential proxy system end-to-end
 */

const https = require('https');
const http = require('http');
require('dotenv').config({ path: '.env.local' });

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TENANT_ID = 'e3fe58df-4077-4fc2-a75a-f0fa8ac50028'; // Test Corp
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET;

console.log('\n🧪 OAuth Credential Proxy Testing\n');
console.log('================================\n');

// Test 1: Check OAuth Status
async function testOAuthStatus() {
  console.log('Test 1: Check OAuth Connection Status');
  console.log('--------------------------------------');

  try {
    const url = `${BASE_URL}/api/platform/tenants/${TENANT_ID}/oauth/whatsapp`;
    console.log(`GET ${url}`);
    console.log(`(This requires authentication - test from browser after login)\n`);
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Test 2: Test Proxy API Authentication
async function testProxyAuth() {
  console.log('\nTest 2: Test Proxy API Authentication');
  console.log('--------------------------------------');

  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}/api/proxy/${TENANT_ID}/whatsapp/test`);

    const options = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${N8N_SECRET}`,
      },
    };

    console.log(`GET ${url}`);
    console.log(`Authorization: Bearer ${N8N_SECRET?.substring(0, 20)}...`);

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}`);

        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));

          if (res.statusCode === 200 && json.connected) {
            console.log('\n✅ Proxy API is working!');
            console.log('   WhatsApp connection: CONNECTED');
            console.log(`   Phone: ${json.phoneNumber}`);
            console.log(`   Verified Name: ${json.verifiedName}`);
            resolve(true);
          } else if (res.statusCode === 500 && json.message?.includes('not found')) {
            console.log('\n⚠️  No OAuth credential found for this tenant');
            console.log('   Need to complete OAuth flow first');
            resolve(false);
          } else {
            console.log(`\n❌ Unexpected response`);
            resolve(false);
          }
        } catch (e) {
          console.log('Response (raw):', data);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request failed:', error.message);
      resolve(false);
    });

    req.end();
  });
}

// Test 3: Test Invalid Auth Token
async function testInvalidAuth() {
  console.log('\nTest 3: Test Invalid Auth Token');
  console.log('--------------------------------');

  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}/api/proxy/${TENANT_ID}/whatsapp/test`);

    const options = {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_token_12345',
      },
    };

    console.log(`GET ${url}`);
    console.log(`Authorization: Bearer invalid_token_12345`);

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}`);

        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));

          if (res.statusCode === 401) {
            console.log('\n✅ Authentication is working correctly!');
            console.log('   Invalid tokens are rejected');
            resolve(true);
          } else {
            console.log('\n❌ Should have rejected invalid token');
            resolve(false);
          }
        } catch (e) {
          console.log('Response (raw):', data);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request failed:', error.message);
      resolve(false);
    });

    req.end();
  });
}

// Run all tests
async function runTests() {
  await testOAuthStatus();
  const test2 = await testProxyAuth();
  const test3 = await testInvalidAuth();

  console.log('\n================================');
  console.log('📊 Test Summary');
  console.log('================================\n');

  console.log('Test 1: OAuth Status Endpoint - ℹ️  Requires browser login');
  console.log(`Test 2: Proxy API Test Connection - ${test2 ? '✅ PASS' : '⚠️  No credential'}`);
  console.log(`Test 3: Invalid Auth Rejection - ${test3 ? '✅ PASS' : '❌ FAIL'}`);

  console.log('\n💡 Next Steps:');
  console.log('1. Go to http://localhost:3000');
  console.log('2. Log in as admin');
  console.log('3. Go to Integration Management → OAuth Connections');
  console.log('4. Click "Connect WhatsApp" to complete OAuth flow');
  console.log('5. After connecting, run this script again to test the proxy API\n');
}

runTests();
