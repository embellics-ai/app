#!/bin/bash
# Business & Branch Management Testing Script
# Run this after starting the server to test the implementation

BASE_URL="http://localhost:5050"
TENANT_ID="your-tenant-id-here"  # Replace with actual tenant ID
AUTH_TOKEN="your-auth-token-here"  # Replace with actual auth token
N8N_SECRET="${N8N_WEBHOOK_SECRET}"  # From .env.local

echo "🧪 Business & Branch Management API Testing"
echo "==========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if variables are set
if [ "$TENANT_ID" == "your-tenant-id-here" ]; then
  echo -e "${RED}❌ Error: Please set TENANT_ID in the script${NC}"
  exit 1
fi

if [ "$AUTH_TOKEN" == "your-auth-token-here" ]; then
  echo -e "${RED}❌ Error: Please set AUTH_TOKEN in the script${NC}"
  exit 1
fi

echo -e "${YELLOW}Testing with:${NC}"
echo "  Tenant ID: $TENANT_ID"
echo "  Base URL: $BASE_URL"
echo ""

# Test 1: Create Business
echo -e "${YELLOW}Test 1: Create Business${NC}"
echo "POST /api/platform/tenants/$TENANT_ID/businesses"
BUSINESS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "phorest_api",
    "businessId": "Xuq9HTXKLidtKJVE6p8ACA",
    "businessName": "South William Clinic"
  }')

echo "$BUSINESS_RESPONSE" | jq '.'
BUSINESS_DB_ID=$(echo "$BUSINESS_RESPONSE" | jq -r '.id')
echo -e "${GREEN}✓ Business ID: $BUSINESS_DB_ID${NC}"
echo ""

# Test 2: List Businesses
echo -e "${YELLOW}Test 2: List All Businesses${NC}"
echo "GET /api/platform/tenants/$TENANT_ID/businesses"
curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
echo ""

# Test 3: Create First Branch (Primary)
echo -e "${YELLOW}Test 3: Create First Branch (Primary)${NC}"
echo "POST /api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches"
BRANCH1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "KZe7saP777vkzie6N-XNtw",
    "branchName": "Main Clinic",
    "isPrimary": true,
    "isActive": true
  }')

echo "$BRANCH1_RESPONSE" | jq '.'
BRANCH1_DB_ID=$(echo "$BRANCH1_RESPONSE" | jq -r '.id')
echo -e "${GREEN}✓ Branch 1 ID: $BRANCH1_DB_ID${NC}"
echo ""

# Test 4: Create Second Branch
echo -e "${YELLOW}Test 4: Create Second Branch${NC}"
BRANCH2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-2-test-id",
    "branchName": "Secondary Location",
    "isPrimary": false,
    "isActive": true
  }')

echo "$BRANCH2_RESPONSE" | jq '.'
BRANCH2_DB_ID=$(echo "$BRANCH2_RESPONSE" | jq -r '.id')
echo -e "${GREEN}✓ Branch 2 ID: $BRANCH2_DB_ID${NC}"
echo ""

# Test 5: List Branches
echo -e "${YELLOW}Test 5: List All Branches${NC}"
echo "GET /api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches"
curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
echo ""

# Test 6: Test Lookup Endpoint (N8N)
echo -e "${YELLOW}Test 6: Lookup Endpoint (with businesses)${NC}"
echo "GET /api/proxy/lookup?email=..."
TENANT_EMAIL="your-tenant-email"  # Replace with actual tenant email
curl -s -X GET "$BASE_URL/api/proxy/lookup?email=$TENANT_EMAIL" \
  -H "Authorization: Bearer $N8N_SECRET" | jq '.'
echo ""

# Test 7: Update Branch (Set second as primary)
echo -e "${YELLOW}Test 7: Update Branch (Set Second as Primary)${NC}"
echo "PUT /api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches/$BRANCH2_DB_ID"
curl -s -X PUT "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches/$BRANCH2_DB_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isPrimary": true
  }' | jq '.'
echo ""

# Test 8: Verify Primary Changed
echo -e "${YELLOW}Test 8: Verify Primary Branch Changed${NC}"
curl -s -X GET "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches" \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq '.'
echo ""

# Test 9: Deactivate Branch
echo -e "${YELLOW}Test 9: Deactivate Branch${NC}"
curl -s -X PUT "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID/branches/$BRANCH1_DB_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }' | jq '.'
echo ""

# Test 10: Try to create duplicate business (should fail)
echo -e "${YELLOW}Test 10: Try Duplicate Business (should fail)${NC}"
curl -s -X POST "$BASE_URL/api/platform/tenants/$TENANT_ID/businesses" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "phorest_api",
    "businessId": "different-id",
    "businessName": "Duplicate Business"
  }' | jq '.'
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
echo ""
echo -e "${YELLOW}Cleanup (optional):${NC}"
echo "To delete the test business and all branches:"
echo "curl -X DELETE \"$BASE_URL/api/platform/tenants/$TENANT_ID/businesses/$BUSINESS_DB_ID\" \\"
echo "  -H \"Authorization: Bearer $AUTH_TOKEN\""
