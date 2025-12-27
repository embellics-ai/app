# Payment Links Table Cleanup - December 27, 2025

## Overview

Simplified the `payment_links` table by removing unnecessary columns and renaming Phorest-specific columns to generic names.

## Changes Made

### 1. Schema Changes (`shared/schema.ts`)

**Removed Columns:**

- `bookingReference` - Redundant (bookingId is sufficient)
- `customerEmail` - Already in bookings → clients table
- `customerPhone` - Already in bookings → clients table
- `customerName` - Already in bookings → clients table
- `phorestClientId` - Already in clients table
- `phorestPurchaseId` - Not used
- `description` - Not needed
- `metadata` - Over-engineering
- `expiresAt` - Stripe handles expiration

**Renamed Columns:**

- `phorestBookingId` → `externalServiceBookingId` (generic naming)

**Updated Columns:**

- `bookingId` - Now has proper foreign key constraint with `ON DELETE CASCADE`

**Final Schema:**

```typescript
export const paymentLinks = pgTable('payment_links', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: varchar('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  bookingId: varchar('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }).notNull().unique(),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  amount: real('amount').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('eur'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  externalServiceBookingId: varchar('external_service_booking_id', { length: 255 }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 2. Migration File (`migrations/0023_cleanup_payment_links_table.sql`)

- Drops all unnecessary columns
- Renames `phorest_booking_id` to `external_service_booking_id`
- Adds foreign key constraint to `booking_id`
- Auto-links orphaned payment links to their bookings by matching IDs

### 3. API Changes (`server/routes/payment.routes.ts`)

**POST /api/payments/create-link - Updated Request Body:**

```json
{
  "tenantId": "string (required)",
  "amount": "number (required)",
  "currency": "string (optional, default: 'eur')",
  "bookingId": "string (required)",
  "externalServiceBookingId": "string (optional)",
  "expiresInMinutes": "number (optional, default: 30)"
}
```

**Removed Parameters:**

- customerEmail, customerPhone, customerName
- bookingReference
- phorestBookingId, phorestClientId
- description, metadata

**GET /api/payments/booking/:bookingId - Updated:**

- Changed from `/booking/:reference` to `/booking/:bookingId`
- Now queries by `bookingId` instead of `bookingReference`

### 4. Webhook Updates (`server/routes/stripe-webhook.routes.ts`)

- Updated to use `externalServiceBookingId` instead of `phorestBookingId`
- Generic naming in logs and comments

### 5. Storage Layer (`server/storage.ts`)

- `confirmBooking()` function already updated to link payment_links by bookingId

## Benefits

1. **Simpler Schema** - Only essential columns remain
2. **No Data Duplication** - Customer info stays in clients table
3. **Generic Naming** - Works with any external service (Phorest, Fresha, etc.)
4. **Proper Foreign Keys** - Cascade delete when booking is removed
5. **Required BookingId** - Ensures proper linking from creation
6. **Cleaner API** - Fewer parameters, less confusion

## Breaking Changes

⚠️ **API clients must update to new request format:**

- `bookingId` is now **required** (was optional)
- `bookingReference` removed
- All `phorest*` parameters removed
- Use `externalServiceBookingId` for external service IDs

## Migration Steps

1. **Run migration:** `npm run migrate` or apply `0023_cleanup_payment_links_table.sql`
2. **Update N8N workflows** to pass `bookingId` when creating payment links
3. **Update API clients** to use new request format
4. **Test payment flow** end-to-end

## The Correct Flow

```
1. Create booking in your database
   ↓ Get internal booking.id

2. Reserve booking in external service (Phorest/Fresha)
   ↓ Get external service booking ID

3. Create payment link with BOTH IDs:
   POST /api/payments/create-link
   {
     "bookingId": "internal-uuid",
     "externalServiceBookingId": "phorest-123"
   }
   ↓

4. Customer pays
   ↓

5. Stripe webhook fires
   ↓ Finds payment link by stripeSessionId
   ↓ Updates payment_links.status = 'completed'
   ↓ Updates bookings.status = 'confirmed' (using bookingId)
   ✅ Both tables synchronized!
```

## Next Steps

1. Update N8N workflow to pass `bookingId` when creating payment links
2. Test the complete booking → payment → confirmation flow
3. Verify both tables update correctly
