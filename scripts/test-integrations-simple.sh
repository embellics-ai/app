#!/bin/bash

# Simple Integration API Test
set -e

API_URL="http://localhost:3000"

echo "🔐 Step 1: Login"
LOGIN_RESP=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@embellics.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESP | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:30}..."
echo ""

echo "🏢 Step 2: Create Test Tenant"
TENANT_RESP=$(curl -s -X POST "$API_URL/api/platform/tenants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Corp","email":"test@corp.com","phone":"+1234567890","plan":"pro","status":"active"}')

TENANT_ID=$(echo $TENANT_RESP | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Tenant ID: $TENANT_ID"
echo ""

echo "📱 Step 3: Configure WhatsApp"
curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/whatsapp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "phoneNumberId": "123456789",
    "businessAccountId": "987654321",
    "accessToken": "EAATestAccessTokenVeryLong123456789",
    "webhookVerifyToken": "MySecretVerifyToken",
    "phoneNumber": "+15551234567"
  }' | python3 -m json.tool
echo ""

echo "💬 Step 4: Configure SMS (Twilio)"
curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/sms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "provider": "twilio",
    "accountSid": "ACTestAccountSid123",
    "authToken": "MySecretAuthToken456",
    "phoneNumber": "+15559876543"
  }' | python3 -m json.tool
echo ""

echo "🔗 Step 5: Configure N8N"
curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/n8n" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"baseUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID\",
    \"apiKey\": \"n8n_secret_key_123456\"
  }" | python3 -m json.tool
echo ""

echo "📋 Step 6: Get All Integrations (should show MASKED credentials)"
curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/integrations" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "🪝 Step 7: Create N8N Webhooks"
WEBHOOK1=$(curl -s -X POST "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowName\": \"contact_form\",
    \"webhookUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID/contact\",
    \"description\": \"Contact form submissions\",
    \"isActive\": true
  }" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Created webhook 1: $WEBHOOK1"

WEBHOOK2=$(curl -s -X POST "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowName\": \"booking_request\",
    \"webhookUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID/booking\",
    \"description\": \"Appointment bookings\",
    \"isActive\": true,
    \"authToken\": \"webhook_secret_token_123\"
  }" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Created webhook 2: $WEBHOOK2"
echo ""

echo "📊 Step 8: List All Webhooks"
curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "✏️ Step 9: Update Webhook (disable webhook 1)"
curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/webhooks/$WEBHOOK1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false, "description": "Contact form (disabled for maintenance)"}' | python3 -m json.tool
echo ""

echo "📈 Step 10: Get Analytics Summary"
curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/webhooks/analytics/summary" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

echo "✅ All tests completed!"
echo ""
echo "Tenant ID for reference: $TENANT_ID"
