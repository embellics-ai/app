# Phorest API Investigation - "Only one type field" Error

## Problem

Getting persistent error: `"Purchase item invalid: Only one type field can be set per purchase item"`

## Attempted Solutions

### Attempt 1: Service ID + Price

```json
{
  "serviceId": "5S0lN-rm7P0ziFDoN_z6ew",
  "price": 5000,
  "quantity": 1
}
```

**Result:** ❌ Same error

### Attempt 2: Service ID only

```json
{
  "serviceId": "5S0lN-rm7P0ziFDoN_z6ew"
}
```

**Result:** ❌ Same error

### Attempt 3: Custom item (description + price)

```json
{
  "description": "Payment - Service",
  "price": 5000,
  "quantity": 1
}
```

**Result:** ❌ Same error

### Attempt 4: Nested service object

```json
{
  "service": {
    "id": "5S0lN-rm7P0ziFDoN_z6ew"
  },
  "staffId": "-HXhgpWuxEPC4AANnBR2FA",
  "quantity": 1
}
```

**Result:** ❌ Same error

## API Details

- **Endpoint:** `POST /business/{businessId}/branch/{branchId}/purchase`
- **Authentication:** Basic Auth (working - no 401 errors)
- **Business ID:** Valid (otherwise would get 404)
- **Client ID:** Valid customer ID

## Possible Causes

1. **API Documentation Mismatch**
   - The public API docs may not reflect the actual API requirements
   - Field names or structure might have changed

2. **Account Configuration**
   - Your Phorest account might need specific settings enabled
   - Purchase API might require special permissions

3. **Service Configuration in Phorest**
   - The service itself might have conflicting "type" settings in Phorest
   - Service might be configured incorrectly in the Phorest dashboard

4. **API Version Issue**
   - Might need to specify API version in headers
   - Endpoint URL structure might be different

## Recommendations

### 1. Contact Phorest Support

**Email:** support@phorest.com or api-support@phorest.com

**What to ask:**

```
Subject: "Only one type field can be set per purchase item" Error

Hello,

I'm trying to use the Create Purchase API endpoint and consistently getting this error:
"Purchase item invalid: Only one type field can be set per purchase item"

Business ID: Xuq9HTXKLidtKJVE6p8ACA
Branch ID: KZe7saP777vkzie6N-XNtw

I've tried multiple payload structures including:
- Just serviceId
- serviceId with quantity
- Custom item with description + price

All return the same error. Could you please provide:
1. A working example payload for creating a purchase
2. The correct field names and structure expected
3. Any account settings that might need to be enabled

Thank you!
```

### 2. Check Phorest Dashboard

- Go to Phorest Dashboard → Services
- Check if the service ID `5S0lN-rm7P0ziFDoN_z6ew` exists
- Verify service configuration (is it active? any special flags?)
- Check if there are any "type" fields set on the service

### 3. Try Phorest Developer Portal

- Check if there's a sandbox/test environment
- Look for code examples in their developer docs
- Check for any API version requirements

### 4. Alternative: Use Phorest Booking API

Instead of Create Purchase, we might need to:

1. Create/update the booking with payment status
2. Let Phorest automatically create the purchase
3. OR use a different endpoint for recording payments

## Workaround for Now

Since the Phorest API isn't cooperating, we can:

1. **Skip Phorest Purchase Recording (Temporary)**
   - Payment still processes through Stripe ✅
   - Store all payment details in our database ✅
   - Manually reconcile with Phorest daily/weekly

2. **Manual Reconciliation Process**
   - Export paid bookings from our database
   - Import/manually enter in Phorest
   - Update our database with Phorest purchase IDs

3. **Alternative Integration**
   - Check if Phorest has webhooks we can subscribe to
   - Use Phorest's native payment methods if available
   - Explore Phorest's other API endpoints (Update Booking status?)

## Next Steps

1. ✅ Stripe payment system is fully functional
2. ⏸️ Phorest purchase API blocked by this error
3. 🔍 **Action Required:** Contact Phorest support with error details
4. 🔄 **Meanwhile:** Use manual reconciliation process
5. 📧 **Follow up:** Once Phorest responds, update webhook handler

---

**The payment link system works perfectly!** The only missing piece is automated Phorest purchase recording, which can be added once we get clarification from Phorest support.
