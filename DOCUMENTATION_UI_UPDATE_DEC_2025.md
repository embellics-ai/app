# Documentation UI Update - December 27, 2025

## Overview

Updated the Embellics Customer Management API Documentation UI to include the new payment link creation endpoint and updated flow.

## Changes Made

### 1. Added New Endpoint Section: "Create Payment Link"

**Location:** `client/src/pages/embellics-config.tsx`

**New Section Includes:**

- **Endpoint:** `POST /api/payments/create-link`
- **Badge:** POST method indicator
- **Copy Button:** For easy endpoint URL copying
- **Collapsible:** Can be expanded/collapsed like other endpoints

### 2. Updated State Management

Added `'create-payment-link'` to the `expandedEndpoints` state management:

```typescript
const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({
  'webhook-clients': false,
  'track-interaction': false,
  'complete-booking': false,
  'update-booking': false,
  'create-payment-link': false, // NEW
});
```

### 3. Documentation Content

#### Request Body Example:

```json
{
  "tenantId": "your-tenant-id",
  "amount": 50.0,
  "currency": "eur",
  "externalServiceBookingId": "phorest_booking_12345",
  "expiresInMinutes": 30
}
```

#### Required Fields:

- `tenantId` - Your tenant ID
- `amount` - Payment amount in euros
- `externalServiceBookingId` - External service's booking ID (NEW - used for auto-linking)

#### Optional Fields:

- `currency` - Currency code (default: 'eur')
- `bookingId` - Internal booking ID (if already exists)
- `expiresInMinutes` - Link expiration time (default: 30)

#### Response Example:

```json
{
  "success": true,
  "paymentLink": {
    "id": 123,
    "stripeUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "stripeSessionId": "cs_test_...",
    "amount": 50.0,
    "currency": "eur",
    "status": "pending",
    "bookingId": null
  }
}
```

### 4. Payment Flow Visualization

Added a 4-step visual flow diagram:

1. **Reserve booking in external service**
   - Create temporary booking in Phorest/Fresha
   - Get `bookingId`

2. **Create payment link**
   - Call `POST /api/payments/create-link` with `externalServiceBookingId`

3. **Create booking in your database**
   - Call `POST /api/platform/bookings/complete` with same `serviceProviderBookingId`
   - ✨ **Payment link auto-links here!**

4. **Customer pays**
   - Stripe webhook automatically updates both tables
   - `payment_links.status = completed`
   - `bookings.status = confirmed`

### 5. Automatic Linking Callout

Added a blue info box highlighting the automatic linking feature:

> 🔗 **Automatic Linking**
>
> When you call `POST /api/platform/bookings/complete` with the same `serviceProviderBookingId`, the payment link will be automatically linked to the booking. No additional steps required!

### 6. Updated Toggle All Functionality

The "Collapse All" / "Expand All" button now includes the new payment link section.

## Key Updates to Existing Sections

### Updated `/api/platform/bookings/complete` Documentation:

**Changed:**

- `serviceProviderBookingId` is now highlighted as **REQUIRED**
- Description updated: "REQUIRED: External booking ID from external service"
- Notes emphasize it's needed for payment tracking

**Response stays the same** - No changes needed as the response structure didn't change.

## Visual Improvements

- ✅ Consistent styling with existing endpoint sections
- ✅ Collapsible design for better UX
- ✅ Color-coded badges for different statuses
- ✅ Step-by-step flow with numbered circles
- ✅ Syntax-highlighted code blocks
- ✅ Info callouts with color-coded backgrounds
- ✅ Copy-to-clipboard functionality

## User Experience

The documentation now clearly shows:

1. How to create payment links BEFORE bookings exist
2. How automatic linking works between payment links and bookings
3. The complete flow from reservation → payment → confirmation
4. That no manual linking step is required

## Location

The new section appears in the Integration Documentation UI, accessible from:

- **Navigation:** Integrations → Integration Documentation
- **URL:** `/integrations`
- **Tab:** Embellics Customer Management API
- **Position:** After "Update Booking Status" section, before "Integration Flow"

## Testing

To verify the updates:

1. Navigate to the Integrations page
2. Go to "Integration Documentation" tab
3. Click "Embellics Customer Management API"
4. Scroll to "Create Payment Link" section
5. Expand to see full documentation
6. Test the "Copy endpoint URL" button

## Notes

- All updates maintain the existing design system
- Responsive and works on all screen sizes
- Dark mode support included
- Consistent with other endpoint documentation
- No breaking changes to existing documentation
