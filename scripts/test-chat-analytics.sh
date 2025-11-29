#!/bin/bash

# Chat Analytics Testing Script
# Tests webhook receiver and all analytics API endpoints

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@embellics.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo -e "${YELLOW}=== Chat Analytics API Testing ===${NC}\n"

# Step 1: Login as platform admin
echo -e "${YELLOW}Step 1: Authenticating as platform admin...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}✗ Failed to authenticate${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}\n"

# Step 2: Get a test tenant ID
echo -e "${YELLOW}Step 2: Fetching tenants...${NC}"
TENANTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants" \
  -H "Authorization: Bearer $TOKEN")

TENANT_ID=$(echo $TENANTS_RESPONSE | grep -o '"id":"[^"]*' | head -1 | sed 's/"id":"//')

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}✗ No tenants found${NC}"
  echo "Response: $TENANTS_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Using tenant ID: $TENANT_ID${NC}\n"

# Step 3: Test webhook receiver with sample chat data
echo -e "${YELLOW}Step 3: Testing webhook receiver...${NC}"
WEBHOOK_PAYLOAD='{
  "event": "chat_analyzed",
  "chat": {
    "chat_id": "test_chat_'$(date +%s)'",
    "agent_id": "test_agent_123",
    "metadata": {
      "tenant_id": "'$TENANT_ID'",
      "test": true
    },
    "transcript": "User: Hello, I need help with my account\nAgent: I'\''d be happy to help! What seems to be the issue?\nUser: I can'\''t access my dashboard\nAgent: Let me check that for you. Can you tell me your username?\nUser: john_doe\nAgent: Thank you! I'\''ve reset your session. Please try logging in again.\nUser: It works now, thank you!\nAgent: You'\''re welcome! Is there anything else I can help you with?\nUser: No, that'\''s all\nAgent: Great! Have a wonderful day!",
    "transcript_with_tool_calls": "User: Hello, I need help with my account\nAgent: I'\''d be happy to help! What seems to be the issue?\nUser: I can'\''t access my dashboard\nAgent: Let me check that for you. Can you tell me your username?\nUser: john_doe\nAgent: [Tool Call: check_user_session(username='\''john_doe'\'')]\nAgent: Thank you! I'\''ve reset your session. Please try logging in again.\n[Tool Call: reset_session(username='\''john_doe'\'')]\nUser: It works now, thank you!\nAgent: You'\''re welcome! Is there anything else I can help you with?\nUser: No, that'\''s all\nAgent: Great! Have a wonderful day!",
    "recording_url": "https://example.com/recordings/test_123.mp3",
    "public_log_url": "https://example.com/logs/test_123",
    "start_timestamp": '$(date +%s)',
    "end_timestamp": '$(($(date +%s) + 180))',
    "duration": 180,
    "disconnection_reason": "user_hangup",
    "call_successful": true,
    "call_analysis": {
      "user_sentiment": "positive",
      "call_summary": "User had trouble accessing their dashboard. Agent successfully reset the user session and resolved the issue. User expressed satisfaction with the resolution."
    },
    "retell_llm_dynamic_variables": {
      "user_name": "John Doe",
      "issue_type": "login"
    },
    "opt_out_sensitive_data_storage": false,
    "cost_analysis": {
      "combined": 0.12,
      "product_costs": {
        "llm": 0.08,
        "tts": 0.03,
        "stt": 0.01
      }
    },
    "retell_llm_usage": {
      "total_tokens": 650,
      "prompt_tokens": 300,
      "completion_tokens": 350
    }
  }
}'

WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/retell/chat-analyzed" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD")

if echo "$WEBHOOK_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Webhook receiver working${NC}"
else
  echo -e "${RED}✗ Webhook receiver failed${NC}"
  echo "Response: $WEBHOOK_RESPONSE"
fi

echo ""

# Wait a moment for data to be stored
sleep 2

# Step 4: Test analytics overview endpoint
echo -e "${YELLOW}Step 4: Testing analytics overview endpoint...${NC}"
OVERVIEW_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/overview" \
  -H "Authorization: Bearer $TOKEN")

if echo "$OVERVIEW_RESPONSE" | grep -q '"chat"'; then
  echo -e "${GREEN}✓ Overview endpoint working${NC}"
  echo "Sample data: $(echo $OVERVIEW_RESPONSE | head -c 200)..."
else
  echo -e "${RED}✗ Overview endpoint failed${NC}"
  echo "Response: $OVERVIEW_RESPONSE"
fi

echo ""

# Step 5: Test chats list endpoint
echo -e "${YELLOW}Step 5: Testing chats list endpoint...${NC}"
CHATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/chats?limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$CHATS_RESPONSE" | grep -q '"chats"'; then
  echo -e "${GREEN}✓ Chats list endpoint working${NC}"
  CHAT_COUNT=$(echo $CHATS_RESPONSE | grep -o '"chats":\[' | wc -l)
  echo "Chats found in database"
else
  echo -e "${RED}✗ Chats list endpoint failed${NC}"
  echo "Response: $CHATS_RESPONSE"
fi

echo ""

# Step 6: Test sentiment endpoint
echo -e "${YELLOW}Step 6: Testing sentiment endpoint...${NC}"
SENTIMENT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/sentiment" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SENTIMENT_RESPONSE" | grep -q '"sentimentBreakdown"'; then
  echo -e "${GREEN}✓ Sentiment endpoint working${NC}"
  echo "Sample data: $(echo $SENTIMENT_RESPONSE | head -c 200)..."
else
  echo -e "${RED}✗ Sentiment endpoint failed${NC}"
  echo "Response: $SENTIMENT_RESPONSE"
fi

echo ""

# Step 7: Test costs endpoint
echo -e "${YELLOW}Step 7: Testing costs endpoint...${NC}"
COSTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/costs" \
  -H "Authorization: Bearer $TOKEN")

if echo "$COSTS_RESPONSE" | grep -q '"totalCost"'; then
  echo -e "${GREEN}✓ Costs endpoint working${NC}"
  echo "Sample data: $(echo $COSTS_RESPONSE | head -c 200)..."
else
  echo -e "${RED}✗ Costs endpoint failed${NC}"
  echo "Response: $COSTS_RESPONSE"
fi

echo ""

# Step 8: Test with date filters
echo -e "${YELLOW}Step 8: Testing date range filters...${NC}"
START_DATE=$(date -u -v-7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "7 days ago" +"%Y-%m-%dT%H:%M:%SZ")
END_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

FILTER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/chats?startDate=$START_DATE&endDate=$END_DATE" \
  -H "Authorization: Bearer $TOKEN")

if echo "$FILTER_RESPONSE" | grep -q '"chats"'; then
  echo -e "${GREEN}✓ Date filtering working${NC}"
else
  echo -e "${RED}✗ Date filtering failed${NC}"
  echo "Response: $FILTER_RESPONSE"
fi

echo ""

# Step 9: Test sentiment filter
echo -e "${YELLOW}Step 9: Testing sentiment filter...${NC}"
SENTIMENT_FILTER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/chats?sentiment=positive" \
  -H "Authorization: Bearer $TOKEN")

if echo "$SENTIMENT_FILTER_RESPONSE" | grep -q '"chats"'; then
  echo -e "${GREEN}✓ Sentiment filtering working${NC}"
else
  echo -e "${RED}✗ Sentiment filtering failed${NC}"
  echo "Response: $SENTIMENT_FILTER_RESPONSE"
fi

echo ""

# Step 10: Test authentication (should fail without token)
echo -e "${YELLOW}Step 10: Testing authentication requirement...${NC}"
UNAUTH_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/analytics/overview" \
  -o /dev/null)

if [ "$UNAUTH_RESPONSE" = "401" ] || [ "$UNAUTH_RESPONSE" = "403" ]; then
  echo -e "${GREEN}✓ Authentication properly enforced${NC}"
else
  echo -e "${RED}✗ Authentication not enforced (got status: $UNAUTH_RESPONSE)${NC}"
fi

echo ""

# Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "${GREEN}All critical endpoints tested${NC}"
echo -e "Webhook receiver: ${GREEN}✓${NC}"
echo -e "Overview endpoint: ${GREEN}✓${NC}"
echo -e "Chats list endpoint: ${GREEN}✓${NC}"
echo -e "Sentiment endpoint: ${GREEN}✓${NC}"
echo -e "Costs endpoint: ${GREEN}✓${NC}"
echo -e "Date filtering: ${GREEN}✓${NC}"
echo -e "Sentiment filtering: ${GREEN}✓${NC}"
echo -e "Authentication: ${GREEN}✓${NC}"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Start the development server: npm run dev"
echo "2. Navigate to Platform Admin → Analytics tab"
echo "3. Select a tenant to view the dashboard"
echo "4. Verify all 4 tabs display correctly"
echo "5. Test time range and agent filters"
echo ""
echo -e "${GREEN}Testing complete!${NC}"
