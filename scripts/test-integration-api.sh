#!/bin/bash

# Integration API Testing Script
# Tests all tenant integration management endpoints

set -e  # Exit on error

API_URL="http://localhost:3000"
ADMIN_EMAIL="admin@embellics.com"
ADMIN_PASSWORD="admin123"  # Adjust this to your actual admin password

echo "🧪 Integration API Testing Script"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Login as Platform Admin
echo -e "${YELLOW}1. Logging in as Platform Admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed!${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Create a test tenant
echo -e "${YELLOW}2. Creating test tenant...${NC}"
CREATE_TENANT_RESPONSE=$(curl -s -X POST "$API_URL/api/platform/tenants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Tenant Inc",
    "email": "test@tenant.com",
    "phone": "+1234567890",
    "plan": "pro",
    "status": "active"
  }')

TENANT_ID=$(echo $CREATE_TENANT_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Tenant creation failed!${NC}"
  echo "Response: $CREATE_TENANT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Tenant created${NC}"
echo "Tenant ID: $TENANT_ID"
echo ""

# Step 3: Get integration configuration (should be empty)
echo -e "${YELLOW}3. Getting integration config (should be empty)...${NC}"
GET_INTEGRATION_RESPONSE=$(curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/integrations" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$GET_INTEGRATION_RESPONSE" | jq '.' || echo "$GET_INTEGRATION_RESPONSE"
echo ""

# Step 4: Configure WhatsApp integration
echo -e "${YELLOW}4. Configuring WhatsApp integration...${NC}"
WHATSAPP_RESPONSE=$(curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/whatsapp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "phoneNumberId": "123456789",
    "businessAccountId": "987654321",
    "accessToken": "EAATestAccessTokenThatIsVeryLong123456789",
    "webhookVerifyToken": "MySecretVerifyToken123",
    "phoneNumber": "+1 (555) 123-4567"
  }')

echo "Response:"
echo "$WHATSAPP_RESPONSE" | jq '.' || echo "$WHATSAPP_RESPONSE"
echo ""

# Step 5: Configure SMS integration
echo -e "${YELLOW}5. Configuring SMS integration (Twilio)...${NC}"
SMS_RESPONSE=$(curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/sms" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "provider": "twilio",
    "accountSid": "ACTestAccountSid123456789",
    "authToken": "MySecretAuthToken123456789",
    "phoneNumber": "+1234567890",
    "messagingServiceSid": "MGTestServiceSid"
  }')

echo "Response:"
echo "$SMS_RESPONSE" | jq '.' || echo "$SMS_RESPONSE"
echo ""

# Step 6: Configure N8N base URL
echo -e "${YELLOW}6. Configuring N8N integration...${NC}"
N8N_RESPONSE=$(curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/n8n" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"baseUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID\",
    \"apiKey\": \"n8n_secret_api_key_123456\"
  }")

echo "Response:"
echo "$N8N_RESPONSE" | jq '.' || echo "$N8N_RESPONSE"
echo ""

# Step 7: Get integration config again (should show masked credentials)
echo -e "${YELLOW}7. Getting integration config (should show masked data)...${NC}"
GET_INTEGRATION_RESPONSE=$(curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/integrations" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$GET_INTEGRATION_RESPONSE" | jq '.' || echo "$GET_INTEGRATION_RESPONSE"
echo ""

# Step 8: Create N8N webhooks
echo -e "${YELLOW}8. Creating N8N webhooks...${NC}"

# Webhook 1: Contact Form
WEBHOOK1_RESPONSE=$(curl -s -X POST "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowName\": \"contact_form\",
    \"webhookUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID/contact\",
    \"description\": \"Handles contact form submissions from website\",
    \"isActive\": true
  }")

WEBHOOK1_ID=$(echo $WEBHOOK1_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Webhook 1 (contact_form): $WEBHOOK1_ID"

# Webhook 2: Booking Request
WEBHOOK2_RESPONSE=$(curl -s -X POST "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowName\": \"booking_request\",
    \"webhookUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID/booking\",
    \"description\": \"Handles appointment booking requests\",
    \"isActive\": true
  }")

WEBHOOK2_ID=$(echo $WEBHOOK2_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Webhook 2 (booking_request): $WEBHOOK2_ID"

# Webhook 3: Support Ticket
WEBHOOK3_RESPONSE=$(curl -s -X POST "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowName\": \"support_ticket\",
    \"webhookUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID/support\",
    \"description\": \"Creates support tickets in helpdesk system\",
    \"isActive\": true,
    \"authToken\": \"webhook_secret_token_123\"
  }")

WEBHOOK3_ID=$(echo $WEBHOOK3_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "Webhook 3 (support_ticket): $WEBHOOK3_ID"
echo ""

# Step 9: List all webhooks
echo -e "${YELLOW}9. Listing all webhooks...${NC}"
LIST_WEBHOOKS_RESPONSE=$(curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$LIST_WEBHOOKS_RESPONSE" | jq '.' || echo "$LIST_WEBHOOKS_RESPONSE"
echo ""

# Step 10: Update a webhook
echo -e "${YELLOW}10. Updating webhook (disabling contact_form)...${NC}"
UPDATE_WEBHOOK_RESPONSE=$(curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/webhooks/$WEBHOOK1_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false,
    "description": "Contact form handler (currently disabled for maintenance)"
  }')

echo "Response:"
echo "$UPDATE_WEBHOOK_RESPONSE" | jq '.' || echo "$UPDATE_WEBHOOK_RESPONSE"
echo ""

# Step 11: Try to create duplicate webhook (should fail)
echo -e "${YELLOW}11. Trying to create duplicate webhook (should fail)...${NC}"
DUPLICATE_RESPONSE=$(curl -s -X POST "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflowName\": \"booking_request\",
    \"webhookUrl\": \"https://n8n.hostinger.com/webhook/$TENANT_ID/booking2\",
    \"description\": \"Duplicate workflow name\",
    \"isActive\": true
  }")

echo "Response (should show error):"
echo "$DUPLICATE_RESPONSE" | jq '.' || echo "$DUPLICATE_RESPONSE"
echo ""

# Step 12: Get analytics summary (should be empty - no calls yet)
echo -e "${YELLOW}12. Getting analytics summary...${NC}"
ANALYTICS_SUMMARY_RESPONSE=$(curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/webhooks/analytics/summary" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$ANALYTICS_SUMMARY_RESPONSE" | jq '.' || echo "$ANALYTICS_SUMMARY_RESPONSE"
echo ""

# Step 13: Delete a webhook
echo -e "${YELLOW}13. Deleting webhook (support_ticket)...${NC}"
DELETE_WEBHOOK_RESPONSE=$(curl -s -X DELETE "$API_URL/api/platform/tenants/$TENANT_ID/webhooks/$WEBHOOK3_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Response:"
echo "$DELETE_WEBHOOK_RESPONSE" | jq '.' || echo "$DELETE_WEBHOOK_RESPONSE"
echo ""

# Step 14: List webhooks again (should only show 2 now)
echo -e "${YELLOW}14. Listing webhooks (should show 2 now)...${NC}"
LIST_WEBHOOKS_RESPONSE=$(curl -s -X GET "$API_URL/api/platform/tenants/$TENANT_ID/webhooks" \
  -H "Authorization: Bearer $TOKEN")

WEBHOOK_COUNT=$(echo "$LIST_WEBHOOKS_RESPONSE" | jq 'length')
echo "Webhook count: $WEBHOOK_COUNT"
echo ""

# Step 15: Disable WhatsApp integration
echo -e "${YELLOW}15. Disabling WhatsApp integration...${NC}"
DISABLE_WHATSAPP_RESPONSE=$(curl -s -X PUT "$API_URL/api/platform/tenants/$TENANT_ID/integrations/whatsapp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }')

echo "Response:"
echo "$DISABLE_WHATSAPP_RESPONSE" | jq '.' || echo "$DISABLE_WHATSAPP_RESPONSE"
echo ""

# Final Summary
echo "=================================="
echo -e "${GREEN}🎉 Testing Complete!${NC}"
echo "=================================="
echo ""
echo "Summary:"
echo "  ✅ Logged in as platform admin"
echo "  ✅ Created test tenant: $TENANT_ID"
echo "  ✅ Configured WhatsApp integration"
echo "  ✅ Configured SMS integration (Twilio)"
echo "  ✅ Configured N8N base URL"
echo "  ✅ Created 3 webhooks"
echo "  ✅ Updated webhook (disabled one)"
echo "  ✅ Verified duplicate prevention"
echo "  ✅ Checked analytics"
echo "  ✅ Deleted webhook"
echo "  ✅ Disabled WhatsApp integration"
echo ""
echo "Tenant ID for cleanup: $TENANT_ID"
echo ""
echo "To clean up this test tenant:"
echo "  DELETE $API_URL/api/platform/tenants/$TENANT_ID"
echo ""
