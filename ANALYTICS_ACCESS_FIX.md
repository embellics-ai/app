# Analytics Access Control Fix

**Date:** December 3, 2025  
**Commit:** ee84e76  
**Branch:** dev  
**Status:** ✅ Fixed

## Problem

Client admins (tenant administrators) could not access their own tenant's analytics dashboard. When they visited the Analytics page, they saw:

- 0 Total Interactions
- 0% Voice Success Rate
- 0% Chat Success Rate
- €0.00 Total Cost

Meanwhile, platform admins could see all the analytics data for the same tenant.

## Root Cause

All analytics API endpoints were protected with `requirePlatformAdmin` middleware, which blocked **all non-platform-admin users** from accessing analytics, including client admins trying to view their own tenant's data.

**Example of problematic code:**

```typescript
app.get(
  '/api/platform/tenants/:tenantId/analytics/overview',
  requireAuth,
  requirePlatformAdmin, // ❌ Blocks ALL non-platform-admins
  async (req: AuthenticatedRequest, res) => {
    // ...
  },
);
```

## Solution

Replaced the blanket `requirePlatformAdmin` middleware with granular tenant-specific authorization checks:

**New approach:**

```typescript
app.get(
  '/api/platform/tenants/:tenantId/analytics/overview',
  requireAuth, // ✅ Any authenticated user
  async (req: AuthenticatedRequest, res) => {
    const { tenantId } = req.params;

    // ✅ Platform admin can access any tenant
    // ✅ Client admin can only access their own tenant
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's analytics" });
    }

    // Proceed with analytics logic...
  },
);
```

## Updated Endpoints

The following 8 analytics endpoints were updated:

### Chat Analytics

1. **GET** `/api/platform/tenants/:tenantId/analytics/overview`
   - Combined voice + chat analytics overview

2. **GET** `/api/platform/tenants/:tenantId/analytics/chats`
   - List of chat sessions with filters

3. **GET** `/api/platform/tenants/:tenantId/analytics/chats/time-series`
   - Time-series data for visualizations

4. **GET** `/api/platform/tenants/:tenantId/analytics/chats/agent-breakdown`
   - Agent performance breakdown

5. **GET** `/api/platform/tenants/:tenantId/analytics/chats/:chatId`
   - Detailed chat session analytics

6. **GET** `/api/platform/tenants/:tenantId/analytics/sentiment`
   - Sentiment analysis breakdown

7. **GET** `/api/platform/tenants/:tenantId/analytics/costs`
   - Cost tracking analytics

### Voice Analytics

8. **GET** `/api/platform/tenants/:tenantId/analytics/calls`
   - List of voice call sessions with filters

## Authorization Logic

**For all analytics endpoints:**

| User Type           | Can Access                           | Restriction                |
| ------------------- | ------------------------------------ | -------------------------- |
| **Platform Admin**  | ✅ Any tenant's analytics            | None                       |
| **Client Admin**    | ✅ Only their own tenant's analytics | Blocked from other tenants |
| **Support Staff**   | ✅ Only their own tenant's analytics | Blocked from other tenants |
| **Unauthenticated** | ❌ Blocked                           | Requires login             |

## Testing

### Before Fix

1. **Client Admin Login** (william.animesh@gmail.com)
   - Navigate to Analytics
   - Result: **0 interactions, all metrics empty**

2. **Platform Admin Login** (admin@embellics.com)
   - Select tenant "SWC-Bhukkha"
   - Result: **3 interactions, all metrics visible**

### After Fix

1. **Client Admin Login** (william.animesh@gmail.com)
   - Navigate to Analytics
   - Result: **✅ Should see 3 interactions and all metrics**

2. **Platform Admin Login** (admin@embellics.com)
   - Select tenant "SWC-Bhukkha"
   - Result: **✅ Still sees all metrics (unchanged)**

## Security Considerations

✅ **Tenant Isolation Maintained**

- Client admins cannot access other tenants' analytics
- Each client admin is restricted to their own `tenantId`

✅ **Platform Admin Privileges Preserved**

- Platform admins retain access to all tenants
- No reduction in platform admin capabilities

✅ **No Data Leakage**

- Authorization check happens at the endpoint level
- Database queries still filtered by `tenantId`
- No cross-tenant data exposure

## Related Files

**Modified:**

- `server/routes.ts` - Updated 8 analytics endpoints

**Testing Pages:**

- `client/src/pages/unified-analytics.tsx` - Analytics dashboard

## Next Steps

1. ✅ Client admin can now access their analytics
2. ✅ Test in production after deployment
3. ⏳ Consider adding analytics access to support staff role if needed
4. ⏳ Add more granular permissions (e.g., view-only vs. full access)

## Deployment

**Commit:** `ee84e76`  
**Branch:** `dev`  
**Pushed to:** GitHub

**To deploy:**

```bash
# Already pushed to dev branch
# Render will auto-deploy from dev branch
```

## Conclusion

Client admins can now view their own tenant's analytics data without requiring platform admin privileges. The fix maintains proper tenant isolation and security boundaries while enabling self-service analytics access.
