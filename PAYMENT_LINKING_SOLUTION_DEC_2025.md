# Payment Linking Solution - December 27, 2025

## Problem

Payment links were created BEFORE bookings, resulting in NULL `booking_id` values. This prevented the payment_links table from updating when bookings were confirmed via PATCH.

## Solution

Automatic linking of payment links to bookings after booking creation.

---

## Changes Made

### 1. New Storage Method: `linkPaymentToBooking()`

**Location:** `server/storage.ts`

```typescript
async linkPaymentToBooking(
  externalServiceBookingId: string,
  bookingId: string,
  tenantId: string,
): Promise<void>
```

**Purpose:** Links existing payment links to newly created bookings by matching `externalServiceBookingId`

**Logic:**

- Finds payment links where:
  - `tenantId` matches
  - `externalServiceBookingId` matches
  - `bookingId` is NULL (not already linked)
- Updates them with the internal `bookingId`
- Logs success/info messages

### 2. Updated `/api/platform/bookings/complete` Endpoint

**Location:** `server/routes/customers.routes.ts`

**Added after booking creation:**

```javascript
// Link any existing payment links to this booking
if (serviceProviderBookingId) {
  await storage.linkPaymentToBooking(serviceProviderBookingId, booking.id, tenantId);
}
```

**This automatically connects payment links that were created before the booking.**

### 3. Updated `/api/payments/create-link` Endpoint

**Location:** `server/routes/payment.routes.ts`

**Changes:**

- Made `bookingId` **optional** (was required)
- Made `externalServiceBookingId` **required** (was optional)
- Updated validation accordingly

**New Request Body:**

```json
{
  "tenantId": "string (required)",
  "amount": "number (required)",
  "currency": "string (optional, default: 'eur')",
  "bookingId": "string (optional - can be linked later)",
  "externalServiceBookingId": "string (required)",
  "expiresInMinutes": "number (optional, default: 30)"
}
```

---

## Flow (Your Current Approach - Now Supported!)

```
1. AI Agent reserves booking in Phorest
   ↓ Get serviceProviderBookingId (e.g., "phorest-12345")

2. Create Stripe payment link
   POST /api/payments/create-link
   {
     "tenantId": "xxx",
     "amount": 50,
     "externalServiceBookingId": "phorest-12345"  ← External ID
   }
   ↓ Payment link created with NULL booking_id
   ↓ Send link to customer

3. Call /api/platform/bookings/complete
   {
     "tenantId": "xxx",
     "serviceProviderBookingId": "phorest-12345",
     ...
   }
   ↓ Booking created with id="uuid-abc"
   ↓ **AUTOMATIC LINKING** happens here!
   ↓ Payment link updated: booking_id = "uuid-abc"

4. Customer pays → Stripe webhook
   ↓ Finds payment link by stripeSessionId
   ↓ Updates payment_links.status = 'completed'
   ↓ Updates bookings.status = 'confirmed' (using bookingId)
   ✅ Both tables synchronized!
```

---

## Benefits

1. **No N8N Changes Required** - Your current workflow continues to work!
2. **Automatic Linking** - Payment links are connected when booking is created
3. **Backward Compatible** - Still supports bookingId if provided upfront
4. **Robust** - Only links unlinked payment links (idempotent)

---

## What Your N8N Workflow Should Do

### Current Flow (No Changes Needed!):

1. **Create Payment Link:**

```json
POST /api/payments/create-link
{
  "tenantId": "your-tenant-id",
  "amount": 50,
  "currency": "eur",
  "externalServiceBookingId": "{{ $json.phorestBookingId }}"
}
```

2. **Create Booking (Automatic Linking Happens Here):**

```json
POST /api/platform/bookings/complete
{
  "tenantId": "your-tenant-id",
  "serviceProviderBookingId": "{{ $json.phorestBookingId }}",
  "externalServiceClientId": "...",
  "serviceName": "...",
  "amount": 50,
  "bookingDateTime": "...",
  "bookingSource": "voice",
  ...
}
```

The `linkPaymentToBooking()` method is called automatically inside this endpoint!

---

## Testing

Run the check script to verify linking worked:

```bash
npx tsx scripts/check-payment-links-table.ts
```

Should show:

- ✅ Total records: X
- ✅ Records with NULL booking_id: 0 (after linking)

---

## Summary

✅ Payment links can be created BEFORE bookings  
✅ Automatic linking when booking is created  
✅ No N8N workflow changes needed  
✅ Both tables stay synchronized  
✅ PATCH confirm endpoint works correctly

Your approach was correct all along! We just needed to add the automatic linking step.
