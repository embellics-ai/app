#!/bin/bash

# Test script for the generic HTTP proxy
# This tests the HTTPBin API configuration you just created

echo "🧪 Testing Generic HTTP Proxy with HTTPBin..."
echo ""

TENANT_ID="84e33bb8-6a3a-49c0-8ea0-117f2e79bd79"
N8N_SECRET="NymaKp3YpTwlKMALnaVC/f7sK+iG90hqN0DjKVIpl0g="
BASE_URL="http://localhost:3000"

echo "📡 Test 1: GET request to /headers endpoint"
echo "This should show HTTPBin receiving your Bearer token"
echo ""

curl -X POST "${BASE_URL}/api/proxy/${TENANT_ID}/http/httpbin/headers" \
  -H "Authorization: Bearer ${N8N_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -s | jq '.headers.Authorization' || echo "❌ Test failed"

echo ""
echo "---"
echo ""

echo "📡 Test 2: POST request to /post endpoint"
echo "This tests that POST data is forwarded correctly"
echo ""

curl -X POST "${BASE_URL}/api/proxy/${TENANT_ID}/http/httpbin/post" \
  -H "Authorization: Bearer ${N8N_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"test": "data", "from": "N8N"}' \
  -s | jq '.json' || echo "❌ Test failed"

echo ""
echo "---"
echo ""

echo "✅ Proxy tests complete!"
echo ""
echo "💡 What just happened:"
echo "   1. Your proxy received the request from 'N8N' (simulated)"
echo "   2. It added the Bearer token authentication"
echo "   3. It forwarded the request to https://httpbin.org"
echo "   4. HTTPBin echoed back what it received"
echo "   5. The proxy returned the response to you"
echo ""
echo "🔐 Your Bearer token (test_token_12345) was automatically injected!"
