# Booking Lifecycle Implementation

## Overview

Complete implementation of booking lifecycle tracking system to handle the full customer journey from reservation to completion/cancellation.

## Implementation Date

January 15, 2025

## Problem Statement

The system needed to track two distinct events in the booking process:

1. **Reservation**: Customer calls/chats and expresses interest in booking
2. **Confirmation**: Customer pays deposit and booking is confirmed

Previously, there was no way to differentiate between these states or track the complete lifecycle.

## Solution Approach

Implemented **Option A**: Single booking record with status updates

### Status Flow

```
Booking Status:
pending (reserved) → confirmed (deposit paid) → completed / cancelled / no_show

Payment Status:
awaiting_deposit → deposit_paid → paid / refunded / no_payment
```

## Changes Made

### 1. Database Schema Updates

**File**: `shared/schema.ts`

Enhanced bookings table with:

- Updated `status` default to `'pending'` (was `'confirmed'`)
- Updated `paymentStatus` default to `'awaiting_deposit'` (was `'pending'`)
- Added `depositAmount`: Amount of deposit paid
- Added `depositPaidAt`: Timestamp when deposit was paid
- Added lifecycle timestamps:
  - `confirmedAt`: When booking was confirmed (deposit paid)
  - `completedAt`: When service was completed
  - `cancelledAt`: When booking was cancelled
  - `refundedAt`: When refund was processed
- Added cancellation tracking:
  - `cancellationReason`: Why booking was cancelled
  - `refundAmount`: Amount refunded
  - `cancellationNotes`: Additional notes

### 2. Database Migration

**File**: `migrations/0017_add_booking_lifecycle_tracking.sql`

- Altered bookings table to add all new columns
- Updated existing bookings to have proper timestamps
- Added column comments explaining status flow

### 3. Storage Layer Methods

**File**: `server/storage.ts`

Added new methods to IStorage interface and DbStorage class:

```typescript
confirmBooking(bookingId: string, depositAmount?: number): Promise<Booking | undefined>
completeBooking(bookingId: string): Promise<Booking | undefined>
cancelBooking(bookingId: string, reason: string, refundAmount?: number, notes?: string): Promise<Booking | undefined>
markBookingNoShow(bookingId: string): Promise<Booking | undefined>
```

### 4. API Endpoints

**File**: `server/routes/customers.routes.ts`

#### New Unified Endpoints:

1. **POST /api/platform/interactions/track**
   - Purpose: Track customer interaction (inquiry/reservation) without creating Phorest booking
   - Creates/updates client record
   - Optionally creates lead for follow-up
   - Does NOT create booking in Phorest
   - Use case: Customer makes initial inquiry or reserves booking

2. **POST /api/platform/bookings/complete**
   - Purpose: Complete booking flow with Phorest integration
   - Creates booking record in our system
   - Integrates with Phorest to create appointment
   - Updates client status
   - Creates service provider mapping
   - Use case: Customer pays deposit and confirms booking

3. **PATCH /api/platform/tenants/:tenantId/bookings/:bookingId**
   - Purpose: Update booking status throughout lifecycle
   - Supports actions: `confirm`, `complete`, `cancel`, `no_show`
   - Also supports general field updates
   - Use case: Update booking as it progresses through lifecycle

### 5. UI Updates

**File**: `client/src/pages/customer-detail.tsx`

Enhanced booking display with:

- Color-coded status badges:
  - Green: completed
  - Yellow: confirmed
  - Blue: pending
  - Red: cancelled
  - Gray: no_show
- Color-coded payment status badges:
  - Green: paid
  - Yellow: deposit_paid
  - Orange: awaiting_deposit
  - Red: refunded
  - Gray: no_payment
- Proper text formatting (underscores to spaces, title case)

### 6. API Documentation

**File**: `client/src/pages/embellics-config.tsx`

Added comprehensive documentation:

- Booking Lifecycle Management section
- Status flow diagrams
- POST /interactions/track endpoint documentation
- POST /bookings/complete endpoint documentation
- PATCH /bookings/:bookingId endpoint documentation
- Updated integration flow (3-step process)
- Request/response examples with placeholder values

## Integration Points

### Where to Call These Endpoints

1. **Retell AI Webhook Handler** (`server/routes/webhook.routes.ts`)
   - Call POST /interactions/track when customer expresses interest
   - Call POST /bookings/complete when deposit is confirmed

2. **N8N Workflow Handler** (`server/routes/n8n.routes.ts`)
   - Call POST /bookings/complete when workflow creates booking
   - Call PATCH /bookings/:id to update status based on Phorest webhooks

3. **Web Chat Completion**
   - Call POST /interactions/track for inquiries
   - Call POST /bookings/complete for confirmed bookings

4. **WhatsApp Message Handler**
   - Call POST /interactions/track for initial contact
   - Call POST /bookings/complete for confirmed bookings

## Example Usage Flow

### Scenario: Customer calls and books appointment

1. **Customer makes inquiry** (via Retell AI)

   ```typescript
   POST /api/platform/interactions/track
   {
     "tenantId": "tenant_123",
     "phone": "+353871234567",
     "source": "voice",
     "interactionType": "reservation",
     "notes": "Interested in facial treatment"
   }
   ```

   Result: Client created/updated, Lead created with status "interested"

2. **Customer pays deposit** (payment confirmed)

   ```typescript
   POST /api/platform/bookings/complete
   {
     "tenantId": "tenant_123",
     "externalServiceClientId": "external_client_456",
     "externalBusinessId": "K2e7saP77YvkzIa0N-XNW",
     "externalBranchId": "62e7saP77YvkzIa0N-XNW",
     "serviceName": "Premium Facial",
     "amount": 89.00,
     "depositAmount": 20.00,
     "bookingDateTime": "2025-01-20T14:30:00Z",
     "bookingSource": "voice",
     "serviceProviderBookingId": "external_booking_789"
   }
   ```

   Result: Booking created with status="confirmed", paymentStatus="deposit_paid", External service appointment created

   **Alternative: Payment pending (no deposit yet)**

   ```typescript
   POST /api/platform/bookings/complete
   {
     "tenantId": "tenant_123",
     "externalServiceClientId": "external_client_456",
     "externalBusinessId": "K2e7saP77YvkzIa0N-XNW",
     "externalBranchId": "62e7saP77YvkzIa0N-XNW",
     "serviceName": "Premium Facial",
     "amount": 89.00,
     "bookingDateTime": "2025-01-20T14:30:00Z",
     "bookingSource": "voice",
     "serviceProviderBookingId": "external_booking_789"
   }
   ```

   Result: Booking created with status="pending", Create payment link separately, When payment completes via Stripe webhook, booking auto-updates to "confirmed"

3. **Service is completed** (after appointment)
   ```typescript
   PATCH /api/platform/tenants/tenant_123/bookings/booking_xyz
   {
     "action": "complete"
   }
   ```
   Result: Booking updated to status="completed", paymentStatus="paid"

### Scenario: Customer cancels booking

```typescript
PATCH /api/platform/tenants/tenant_123/bookings/booking_xyz
{
  "action": "cancel",
  "reason": "Customer requested cancellation",
  "refundAmount": 20.00,
  "notes": "Full deposit refunded via Stripe"
}
```

Result: Booking updated to status="cancelled", paymentStatus="refunded", timestamps and cancellation details recorded

## Benefits

1. **Complete Lifecycle Tracking**: Track bookings from initial inquiry to final outcome
2. **Clear State Management**: Well-defined status transitions
3. **Financial Tracking**: Separate payment status from booking status
4. **Cancellation Management**: Full audit trail of cancellations and refunds
5. **Flexible Integration**: Can track inquiries separately from confirmed bookings
6. **Single Source of Truth**: One booking record per appointment
7. **Audit Trail**: Timestamps for all major lifecycle events

## Status Definitions

### Booking Status

- **pending**: Customer has expressed interest or reserved slot but not paid deposit
- **confirmed**: Deposit paid, booking confirmed in Phorest
- **completed**: Service was completed successfully
- **cancelled**: Booking was cancelled (by customer or salon)
- **no_show**: Customer didn't show up for appointment

### Payment Status

- **awaiting_deposit**: Waiting for initial deposit payment
- **deposit_paid**: Deposit received, balance pending
- **paid**: Full payment received
- **refunded**: Payment was refunded (full or partial)
- **no_payment**: No payment required or expected

## Next Steps

1. **Run Migration**: Execute migration 0017 in production to add new columns
2. **Update Webhook Handlers**: Add calls to new endpoints in webhook.routes.ts and n8n.routes.ts
3. **Phorest Integration**: Implement TODO sections in POST /bookings/complete for actual Phorest API calls
4. **Testing**: Test complete booking lifecycle with real data
5. **Monitoring**: Add logging and analytics for booking status transitions

## Files Modified

1. `shared/schema.ts` - Enhanced bookings table schema
2. `migrations/0017_add_booking_lifecycle_tracking.sql` - Database migration
3. `server/storage.ts` - Added lifecycle management methods
4. `server/routes/customers.routes.ts` - Added unified endpoints
5. `client/src/pages/customer-detail.tsx` - Enhanced UI with status badges
6. `client/src/pages/embellics-config.tsx` - Updated API documentation

## Technical Notes

- All status fields use lowercase with underscores (e.g., `deposit_paid`, `no_show`)
- UI automatically formats these for display (e.g., "Deposit Paid", "No Show")
- Timestamps are automatically set when status changes
- All updates go through storage layer for consistency
- Tenant isolation maintained across all endpoints
- Authorization checks ensure Platform Admin and Client Admin access control

## Security Considerations

- All endpoints require authentication
- Tenant-level authorization enforced
- No sensitive data exposed in API documentation (uses placeholders)
- Audit trail maintained via timestamps and notes fields
