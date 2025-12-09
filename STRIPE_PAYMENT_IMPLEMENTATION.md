# Stripe Payment Link Implementation Guide

**Status:** ✅ Core Implementation Complete  
**Date:** December 9, 2025  
**Purpose:** Enable post-booking payment links sent via SMS/WhatsApp

---

## 🎯 Overview

This system allows customers to pay for bookings (appointments/services) via Stripe checkout links after booking through chat or WhatsApp. Payments are recorded in both the platform database and Phorest salon management system.

### Flow

```
1. Customer books via chat/WhatsApp
2. Booking created in Phorest (status: Reserved)
3. Generate Stripe payment link
4. Send link via SMS/WhatsApp
5. Customer pays (no login required)
6. Stripe webhook → Update database
7. Record purchase in Phorest
8. Update booking status (Reserved → Confirmed)
```

---

## 📦 What's Been Implemented

### ✅ Completed

1. **Database Schema** (`migrations/0016_add_payment_links_table.sql`)
   - `payment_links` table with full audit trail
   - Tracks Stripe sessions, payment status, Phorest IDs
   - Foreign key to `tenants` table

2. **Drizzle ORM Schema** (`shared/schema.ts`)
   - `paymentLinks` table definition
   - TypeScript types: `PaymentLink`, `InsertPaymentLink`

3. **Payment Link API** (`server/routes/payment.routes.ts`)
   - `POST /api/payments/create-link` - Generate Stripe checkout
   - `GET /api/payments/:id/status` - Check payment status
   - `GET /api/payments/booking/:reference` - Lookup by booking

4. **Stripe Webhook Handler** (`server/routes/stripe-webhook.routes.ts`)
   - `POST /api/webhooks/stripe` - Receive Stripe events
   - Signature verification
   - Handle `checkout.session.completed`, `checkout.session.expired`
   - Updates payment_links table

5. **Environment Configuration** (`.env.local`)
   - `STRIPE_SECRET_KEY` - Test mode key (sk*test*...)
   - `STRIPE_PUBLISHABLE_KEY` - Frontend key (pk*test*...)
   - `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (empty for now)

---

## 🔧 Setup Instructions

### 1. Stripe Dashboard Configuration

#### A. Get Your API Keys (Already Done ✅)

```
Secret Key: sk_test_xxxxxxxxxxxxx (stored in .env.local)
Publishable Key: pk_test_xxxxxxxxxxxxx (stored in .env.local)
```

#### B. Create Webhook Endpoint (TODO)

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter webhook URL:
   - **Development:** `https://yourdomain.com/api/webhooks/stripe` (use ngrok/localtunnel)
   - **Production:** `https://your-production-url.com/api/webhooks/stripe`
4. Select events to listen for:
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
   - ✅ `payment_intent.succeeded` (optional)
   - ✅ `payment_intent.payment_failed` (optional)
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Add to `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET='whsec_xxxxxxxxxxxxx'
   ```

---

## 🚀 API Usage

### Create Payment Link

```bash
POST /api/payments/create-link
Content-Type: application/json

{
  "tenantId": "abc-123-xyz",
  "amount": 50.00,
  "currency": "eur",
  "customerEmail": "customer@example.com",
  "customerPhone": "+353851234567",
  "customerName": "John Smith",
  "bookingReference": "PHOREST_BOOKING_ID_12345",
  "phorestBookingId": "12345",
  "phorestClientId": "67890",
  "description": "Haircut - John Smith - 15 Dec 2025",
  "metadata": {
    "serviceName": "Haircut",
    "staffName": "Sarah",
    "bookingTime": "2025-12-15T10:00:00Z"
  }
}
```

**Response:**

```json
{
  "success": true,
  "paymentLink": {
    "id": 1,
    "stripeUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "stripeSessionId": "cs_test_abc123...",
    "amount": 50.0,
    "currency": "eur",
    "status": "pending",
    "expiresAt": "2025-12-09T11:00:00Z",
    "bookingReference": "PHOREST_BOOKING_ID_12345"
  }
}
```

### Check Payment Status

```bash
GET /api/payments/123/status
```

**Response:**

```json
{
  "success": true,
  "paymentLink": {
    "id": 123,
    "status": "completed",
    "paidAt": "2025-12-09T10:15:00Z",
    "stripePaymentIntentId": "pi_abc123...",
    ...
  }
}
```

### Lookup by Booking Reference

```bash
GET /api/payments/booking/PHOREST_BOOKING_ID_12345
```

---

## 🧪 Testing

### Test Cards (Stripe Test Mode)

| Card Number           | Scenario  |
| --------------------- | --------- |
| `4242 4242 4242 4242` | Success   |
| `4000 0000 0000 0002` | Decline   |
| `4000 0027 6000 3184` | 3D Secure |

**Details:**

- Any future expiry date (e.g., 12/25)
- Any 3-digit CVC (e.g., 123)
- Any postal code

### Local Testing with Stripe CLI

1. **Install Stripe CLI:**

   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login:**

   ```bash
   stripe login
   ```

3. **Forward webhooks to localhost:**

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   This will output a webhook signing secret:

   ```
   whsec_xxxxxxxxxxxxx
   ```

   Add this to `.env.local`:

   ```bash
   STRIPE_WEBHOOK_SECRET='whsec_xxxxxxxxxxxxx'
   ```

4. **Start your dev server:**

   ```bash
   npm run dev
   ```

5. **Test payment flow:**

   ```bash
   # Create payment link
   curl -X POST http://localhost:3000/api/payments/create-link \
     -H "Content-Type: application/json" \
     -d '{
       "tenantId": "your-tenant-id",
       "amount": 50.00,
       "bookingReference": "TEST_BOOKING_123",
       "description": "Test Payment"
     }'

   # Open the returned stripeUrl in browser
   # Complete payment with test card
   # Watch webhook events in terminal
   ```

---

## ⏳ TODO: Phorest Integration

The webhook handler includes a placeholder for recording purchases in Phorest:

```typescript
// File: server/routes/stripe-webhook.routes.ts
// Line ~145

if (updatedLink.phorestBookingId) {
  console.log(
    `[Stripe Webhook] TODO: Record purchase in Phorest for booking ${updatedLink.phorestBookingId}`,
  );
  // await recordPhorestPurchase(updatedLink);
}
```

### Next Step: Implement Phorest Purchase Recording

Create `server/services/phorest.service.ts`:

```typescript
import axios from 'axios';

interface PhorestPurchaseInput {
  businessId: string;
  branchId: string;
  clientId: string;
  amount: number; // in cents
  currency: string;
  description: string;
  paymentType: 'card' | 'cash' | 'other';
}

export async function createPhorestPurchase(input: PhorestPurchaseInput) {
  const response = await axios.post(
    `http://api-gateway-eu.phorest.com/third-party-api-server/api/business/${input.businessId}/branch/${input.branchId}/purchase`,
    {
      clientId: input.clientId,
      payment: [
        {
          amount: input.amount, // Phorest expects cents
          paymentTypeId: 1, // Card payment
          type: 'debit',
        },
      ],
      items: [
        {
          description: input.description,
          price: input.amount,
          quantity: 1,
        },
      ],
    },
    {
      auth: {
        username: process.env.PHOREST_API_USERNAME!,
        password: process.env.PHOREST_API_PASSWORD!,
      },
    },
  );

  return response.data;
}
```

Then call this function in the webhook handler after payment completes.

---

## 📊 Database Schema

### `payment_links` Table

| Column                     | Type          | Description                           |
| -------------------------- | ------------- | ------------------------------------- |
| `id`                       | SERIAL        | Primary key                           |
| `tenant_id`                | VARCHAR(255)  | FK to tenants table                   |
| `booking_reference`        | VARCHAR(255)  | Internal booking ID                   |
| `stripe_session_id`        | VARCHAR(255)  | Stripe checkout session ID (unique)   |
| `stripe_payment_intent_id` | VARCHAR(255)  | Stripe payment intent ID              |
| `amount`                   | DECIMAL(10,2) | Payment amount (e.g., 50.00)          |
| `currency`                 | VARCHAR(3)    | Currency code (default: 'eur')        |
| `status`                   | VARCHAR(50)   | pending, completed, expired, failed   |
| `customer_email`           | VARCHAR(255)  | Customer email                        |
| `customer_phone`           | VARCHAR(50)   | Customer phone                        |
| `customer_name`            | VARCHAR(255)  | Customer name                         |
| `phorest_booking_id`       | VARCHAR(255)  | Phorest booking ID                    |
| `phorest_client_id`        | VARCHAR(255)  | Phorest client ID                     |
| `phorest_purchase_id`      | VARCHAR(255)  | Phorest purchase ID (after recording) |
| `description`              | TEXT          | Payment description                   |
| `metadata`                 | JSONB         | Additional context                    |
| `expires_at`               | TIMESTAMP     | Checkout session expiry               |
| `paid_at`                  | TIMESTAMP     | Payment completion time               |
| `created_at`               | TIMESTAMP     | Record creation time                  |
| `updated_at`               | TIMESTAMP     | Last update time                      |

---

## 🔒 Security Notes

1. **Webhook Signature Verification:** ✅ Implemented
   - All webhook requests are verified using Stripe's signature
   - Prevents unauthorized payment status updates

2. **API Keys:** ✅ Secure
   - Stored in `.env.local` (not committed to git)
   - Test keys only (safe to use during development)

3. **Test Mode:** ✅ Active
   - All keys start with `sk_test_` and `pk_test_`
   - No real money can be charged

4. **Production Checklist:**
   - [ ] Switch to live API keys (sk*live*..., pk*live*...)
   - [ ] Update webhook endpoint URL in Stripe Dashboard
   - [ ] Complete Stripe account verification
   - [ ] Add bank account for payouts
   - [ ] Update `.env.production` with live keys
   - [ ] Test with small real transaction

---

## 📝 Files Created/Modified

### New Files

- `migrations/0016_add_payment_links_table.sql`
- `server/routes/payment.routes.ts`
- `server/routes/stripe-webhook.routes.ts`

### Modified Files

- `shared/schema.ts` - Added paymentLinks table
- `server/routes/index.ts` - Registered payment & webhook routes
- `.env.local` - Added Stripe keys
- `.env.example` - Added Stripe key placeholders

---

## 🐛 Troubleshooting

### Issue: Webhook not receiving events

**Solution:**

1. Check `STRIPE_WEBHOOK_SECRET` is set in `.env.local`
2. Use Stripe CLI to forward webhooks locally
3. Check Stripe Dashboard → Webhooks → Event logs

### Issue: "Invalid API Key"

**Solution:**

1. Verify `STRIPE_SECRET_KEY` starts with `sk_test_`
2. Check `.env.local` is being loaded
3. Restart dev server

### Issue: Payment link expired immediately

**Solution:**

1. Checkout sessions expire after 1 hour by default
2. Check system time is correct
3. Increase expiry: `expires_at: Math.floor(Date.now() / 1000) + 86400` (24h)

---

## 📞 Next Steps

1. **Set up webhook endpoint** (see Setup Instructions above)
2. **Implement Phorest purchase recording** (see TODO section)
3. **Test complete flow with test cards**
4. **Integrate with chat/WhatsApp booking flow**
5. **Add SMS/WhatsApp payment link sending**
6. **Build admin dashboard for payment monitoring**
7. **Go live with real Stripe keys**

---

## 💰 Stripe Fees (Test Mode)

| Region       | Fee Structure |
| ------------ | ------------- |
| EU cards     | 1.5% + €0.25  |
| Non-EU cards | 2.9% + €0.30  |

**Example (€50 booking with EU card):**

- Booking amount: €50.00
- Stripe fee: €1.00 (1.5% + €0.25)
- You receive: €49.00

---

**Questions?** Check the inline comments in the route files or Stripe documentation at https://stripe.com/docs
