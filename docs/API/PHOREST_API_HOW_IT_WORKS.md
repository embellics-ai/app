# Phorest API - How It Actually Works

## The Simple Truth

**Your Phorest credentials are ALREADY stored in the database and are AUTOMATICALLY used by the API!**

No separate configuration page needed. No manual entry required. It just works.

## How to Use the Phorest API

### Step 1: Go to API Documentation

- Navigate to **API Documentation** in the sidebar
- URL: `http://localhost:3000/api-docs`

### Step 2: Select Your Tenant

- Choose a tenant from the dropdown (e.g., "SWC")
- The tenant's ID is automatically used

### Step 3: Test the API

1. Open **POST /api/phorest/clients** endpoint
2. Click "Try it out"
3. Fill in the request body:
   ```json
   {
     "tenantId": "your-tenant-id-from-dropdown",
     "firstName": "John",
     "lastName": "Doe",
     "mobile": "0871234567",
     "email": "john@example.com"
   }
   ```
4. Click "Execute"

### Step 4: It Just Works! ✅

**Behind the scenes, the API automatically:**

1. ✅ Fetches Phorest credentials from `external_api_configs` table
2. ✅ Fetches business ID from `tenant_businesses` table
3. ✅ Decrypts the credentials
4. ✅ Calls Phorest API with your credentials
5. ✅ Returns the result

**You don't need to enter credentials anywhere!**

## What If It Doesn't Work?

If you get error: **"Phorest business not configured for tenant"**

This means that tenant doesn't have Phorest credentials in the database yet. Check:

### Option A: Use the Diagnostic Endpoint

```bash
curl "http://localhost:3000/api/phorest/config/check?tenantId=YOUR_TENANT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response will tell you:

```json
{
  "configured": false,
  "details": {
    "hasApiConfig": false, // Missing from external_api_configs
    "hasBusiness": false // Missing from tenant_businesses
  }
}
```

### Option B: Check in Swagger UI

In API Documentation:

1. Find endpoint: `GET /api/phorest/config/check`
2. Enter `tenantId` parameter
3. Execute
4. See what's missing

## The Database Tables

### Where Credentials Are Stored:

**1. external_api_configs** (Phorest username/password)

```sql
SELECT * FROM external_api_configs
WHERE tenant_id = 'your-tenant-id'
AND service_name = 'phorest_api';
```

**2. tenant_businesses** (Business/Branch info)

```sql
SELECT * FROM tenant_businesses
WHERE tenant_id = 'your-tenant-id'
AND service_name = 'phorest_api';
```

## Code Reference

### How the Phorest Service Uses Credentials

From `server/services/phorest/index.ts`:

```typescript
async createClient(request: { tenantId: string, ... }) {
  // Step 1: Automatically get business ID
  const business = await this.getTenantBusiness(request.tenantId);
  const businessId = business.businessId;

  // Step 2: Automatically get API credentials
  const config = await this.getPhorestConfig(request.tenantId);

  // Step 3: Automatically decrypt credentials
  const credentials = decryptPhorestCredentials(config.encryptedCredentials);

  // Step 4: Call Phorest API
  const response = await axios.post(apiUrl, payload, {
    auth: {
      username: credentials.username,
      password: credentials.password
    }
  });

  return response.data;
}
```

**Notice:** You never pass credentials manually - they're fetched automatically!

## Summary

### What You Do:

1. Select tenant in API Documentation
2. Call POST /api/phorest/clients with tenant ID
3. Done!

### What System Does Automatically:

1. ✅ Fetches credentials from database
2. ✅ Fetches business ID from database
3. ✅ Decrypts credentials
4. ✅ Calls Phorest API
5. ✅ Returns result

### What You DON'T Need:

- ❌ Separate Phorest Config page
- ❌ Manual credential entry
- ❌ Copy/paste credentials
- ❌ Environment variables

## If Credentials Are Missing

You mentioned credentials are already in `external_api_configs` for every tenant. If that's true, then:

**The API should work immediately for all tenants!**

Just:

1. Go to API Documentation
2. Select tenant
3. Call the endpoint
4. It works!

If it doesn't work, the credentials might not be in the database for that specific tenant. Use the diagnostic endpoint to check.

---

**Bottom Line:** Your system is already set up correctly. The API automatically pulls credentials from the database. Just use it! 🎉
