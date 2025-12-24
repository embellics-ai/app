#!/bin/bash

# This script updates the Phorest API endpoint to require businessId in the payload
# instead of fetching it from the database

echo "Updating Phorest client creation endpoint..."

# Update the schema in phorest.routes.ts to include businessId
sed -i '' 's/tenantId: z.string().min(1, '\''Tenant ID is required'\''),/tenantId: z.string().min(1, '\''Tenant ID is required'\''),\n  businessId: z.string().min(1, '\''Business ID is required'\''),/' server/routes/phorest.routes.ts

# Update the destructuring to include businessId
sed -i '' 's/const { tenantId, firstName, lastName, mobile, email } = validationResult.data;/const { tenantId, businessId, firstName, lastName, mobile, email } = validationResult.data;/' server/routes/phorest.routes.ts

# Update the console.log to include businessId
sed -i '' 's/tenantId,$/tenantId,\n      businessId,/' server/routes/phorest.routes.ts

# Update the service call to include businessId
sed -i '' 's/tenantId,$/tenantId,\n      businessId,/' server/routes/phorest.routes.ts

# Update the service method signature
sed -i '' 's/request: Omit<CreateClientRequest, '\''tenantId'\'' | '\''businessId'\''> & { tenantId: string },/request: CreateClientRequest,/' server/services/phorest/index.ts

# Remove the getTenantBusiness call
sed -i '' '/Step 1: Get tenant.*business ID/,/logServiceActivity.*Business ID retrieved/d' server/services/phorest/index.ts

echo "✅ Phorest endpoint updated to require businessId in payload"
echo "✅ Removed automatic businessId fetching from database"
