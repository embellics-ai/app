#!/bin/bash

# Systematic Route Refactoring Audit Script
# Compares each modular route file against original routes.ts

ORIGINAL="/tmp/original_routes.ts"
CURRENT_DIR="/Users/animeshsingh/Documents/Embellics/Embellics-AI/server/routes"
AUDIT_FILE="/Users/animeshsingh/Documents/Embellics/Embellics-AI/REFACTORING_AUDIT.md"

echo "=== Route Refactoring Audit ==="
echo ""
echo "Original file: $ORIGINAL (7248 lines)"
echo "Checking against: $CURRENT_DIR/*.routes.ts"
echo ""

# Function to extract endpoint from original routes.ts
extract_endpoint() {
    local path=$1
    local method=$2
    grep -A 100 "app\.$method('$path'" "$ORIGINAL" | head -100
}

# Analytics Routes
echo "1. Checking analytics.routes.ts..."
echo "   Endpoints: /api/analytics, /api/platform/analytics"
grep "router\.(get|post|put|delete|patch)" "$CURRENT_DIR/analytics.routes.ts" | wc -l
echo ""

# Auth Routes  
echo "2. Checking auth.routes.ts..."
echo "   Endpoints: /api/login, /api/register, /api/logout, etc."
grep "router\.(get|post|put|delete|patch)" "$CURRENT_DIR/auth.routes.ts" | wc -l
echo ""

# Proxy Routes (WhatsApp, SMS, External APIs)
echo "3. Checking proxy.routes.ts..."
echo "   Endpoints: /api/proxy/*, /api/whatsapp/webhook"
grep "router\.(get|post|put|delete|patch)" "$CURRENT_DIR/proxy.routes.ts" | wc -l
echo ""

echo "=== Run detailed diff for specific file ==="
echo "Usage: diff -u <(sed 's/app\./router./g' /tmp/original_routes_section.txt) <(cat server/routes/FILENAME.routes.ts)"
