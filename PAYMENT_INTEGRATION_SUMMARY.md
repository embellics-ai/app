# Stripe Payment Integration - Summary & Next Steps

**Implementation Date:** December 9, 2025  
**Status:** ✅ Core payment system complete, ⏳ Phorest integration pending

---

## ✅ What's Working

### 1. Payment Link Generation

- **Endpoint:** `POST /api/payments/create-link`
- **Status:** ✅ Fully functional
- **Test Result:** Successfully generated payment link for €50
- **Checkout URL:** Working Stripe checkout session created

### 2. Payment Status Tracking

- **Endpoint:** `GET /api/payments/:id/status`
- **Status:** ✅ Fully functional
- **Database:** `payment_links` table storing all payment data

### 3. Webhook Handler

- **Endpoint:** `POST /api/webhooks/stripe`
- **Status:** ✅ Code ready (needs webhook secret for live testing)
- **Events:** Handles `checkout.session.completed` and `checkout.session.expired`

---

## ⏳ What's Pending

### 1. Phorest API Integration

**Status:** Code ready, needs your Phorest credentials to test

**To Test:**

1. Edit `test-phorest-simple.ts`
2. Add your Phorest credentials:
   - Username (format: `global/your-username`)
   - API Password
   - Business ID
   - Branch ID
   - Test Client ID
3. Run: `npx tsx test-phorest-simple.ts`

**Expected Result:**

```json
{
  "purchaseId": "pur_abc123",
  "status": "completed"
}
```

### 2. Stripe Webhook Setup (For Production)

**Status:** Needs webhook endpoint URL

**Steps:**

1. Deploy to production OR use ngrok/localtunnel for testing
2. Go to Stripe Dashboard → Developers → Webhooks
3. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
4. Select events: `checkout.session.completed`, `checkout.session.expired`
5. Copy webhook secret (starts with `whsec_...`)
6. Add to `.env.local`: `STRIPE_WEBHOOK_SECRET='whsec_...'`

**For Local Testing:**

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook secret it outputs
```

---

## 🧪 Testing Checklist

### Payment Link (✅ Tested)

- [x] Create payment link via API
- [x] Verify link generates Stripe checkout URL
- [x] Verify database record created
- [x] Check payment status endpoint

### Stripe Checkout (⏳ Manual test needed)

- [ ] Open payment URL in browser
- [ ] Complete payment with test card `4242 4242 4242 4242`
- [ ] Verify webhook receives event
- [ ] Check database updated to `completed` status

### Phorest Integration (⏳ Credentials needed)

- [ ] Configure `test-phorest-simple.ts` with real credentials
- [ ] Test Create Purchase API
- [ ] Verify purchase appears in Phorest dashboard
- [ ] Integrate into webhook handler
- [ ] Test end-to-end flow

---

## 📁 Files Created/Modified

### New Files

```
migrations/0016_add_payment_links_table.sql
server/routes/payment.routes.ts
server/routes/stripe-webhook.routes.ts
test-payment-link.ts
test-phorest-simple.ts
test-phorest-purchase.ts (advanced version)
STRIPE_PAYMENT_IMPLEMENTATION.md
PHOREST_API_TESTING.md
```

### Modified Files

```
shared/schema.ts - Added paymentLinks table
server/routes/index.ts - Registered payment routes
.env.local - Added Stripe keys
.env.example - Added Stripe key placeholders
package.json - Added stripe & axios dependencies
```

---

## 🚀 Usage Example

### Generate Payment Link

```bash
curl -X POST http://localhost:3000/api/payments/create-link \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "84e33bb8-6a3a-49c0-8ea0-117f2e79bd79",
    "amount": 50.00,
    "currency": "eur",
    "customerEmail": "customer@example.com",
    "customerPhone": "+353851234567",
    "bookingReference": "BOOKING_123",
    "phorestBookingId": "PHOREST_123",
    "phorestClientId": "CLIENT_456",
    "description": "Haircut - 15 Dec 2025"
  }'
```

### Response

```json
{
  "success": true,
  "paymentLink": {
    "id": 2,
    "stripeUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amount": 50.0,
    "status": "pending",
    "expiresAt": "2025-12-09T13:19:23.000Z"
  }
}
```

---

## 💡 Integration Points

### Where to Call Payment Link API

**Option 1: After Phorest Booking Created**

```typescript
// In your booking flow
const phorestBooking = await createPhorestBooking(bookingData);

// Generate payment link
const paymentLink = await fetch('/api/payments/create-link', {
  method: 'POST',
  body: JSON.stringify({
    tenantId: currentTenant.id,
    amount: bookingData.totalPrice,
    phorestBookingId: phorestBooking.id,
    phorestClientId: phorestBooking.clientId,
    bookingReference: phorestBooking.id,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    description: `${bookingData.service} - ${bookingData.dateTime}`,
  }),
});

// Send payment link via SMS/WhatsApp
await sendSMS(customer.phone, `Complete your booking: ${paymentLink.stripeUrl}`);
```

**Option 2: Retell AI Function Call**

```typescript
// In your Retell AI function handler
if (functionName === 'create_payment_link') {
  const paymentLink = await createPaymentLink({
    tenantId: call.tenantId,
    amount: parameters.amount,
    phorestBookingId: parameters.bookingId,
    // ... other fields
  });

  return {
    message: `Payment link sent to ${parameters.customerPhone}`,
    paymentUrl: paymentLink.stripeUrl,
  };
}
```

---

## 🔐 Security Notes

### Test Mode (Current)

- ✅ Using test API keys (`sk_test_...`, `pk_test_...`)
- ✅ No real money can be charged
- ✅ Test cards only (4242 4242 4242 4242)

### Production Mode (Before Going Live)

- [ ] Switch to live keys (`sk_live_...`, `pk_live_...`)
- [ ] Complete Stripe account verification
- [ ] Add bank account for payouts
- [ ] Update webhook endpoint URL
- [ ] Test with small real transaction
- [ ] Set up error monitoring
- [ ] Document manual reconciliation process

---

## 💰 Pricing

### Stripe Fees

| Card Type    | Fee          |
| ------------ | ------------ |
| EU cards     | 1.5% + €0.25 |
| Non-EU cards | 2.9% + €0.30 |

**Example: €50 booking (EU card)**

- Customer pays: €50.00
- Stripe fee: €1.00
- You receive: €49.00

---

## 📞 Next Actions

### Immediate (You need to do)

1. **Test Phorest API:**
   - Get Phorest API credentials
   - Edit `test-phorest-simple.ts`
   - Run test to verify API works
   - Share results

2. **Test Payment Flow (Optional):**
   - Open the payment URL from test
   - Complete payment with test card
   - Verify it works end-to-end

### After Phorest Test Passes

3. **Integrate Phorest:**
   - Add code to webhook handler
   - Test complete flow: payment → Phorest purchase
   - Verify purchase appears in Phorest dashboard

4. **Production Setup:**
   - Set up webhook endpoint (deploy or use Stripe CLI)
   - Add webhook secret to `.env.local`
   - Test webhook events

5. **Integration:**
   - Add payment link generation to booking flow
   - Add SMS/WhatsApp sending
   - Test with real booking scenario

---

## 📚 Documentation

- **Implementation Guide:** `STRIPE_PAYMENT_IMPLEMENTATION.md`
- **Phorest Testing:** `PHOREST_API_TESTING.md`
- **Test Scripts:**
  - `test-payment-link.ts` - Test Stripe payment link generation
  - `test-phorest-simple.ts` - Test Phorest API (needs credentials)
  - `test-phorest-purchase.ts` - Advanced Phorest test

---

## ❓ Questions to Answer

1. **Do you have Phorest API credentials?**
   - Username (format: global/username)
   - Password
   - Business ID
   - Can test immediately

2. **How do you want to trigger payment links?**
   - After booking via chat/WhatsApp?
   - Via Retell AI function call?
   - Manual admin action?

3. **SMS/WhatsApp integration:**
   - Already have SMS provider?
   - Want to use WhatsApp Business API?
   - Or just generate links manually for now?

---

**Status:** Ready for Phorest credentials to continue testing! 🚀

Once you provide Phorest credentials, we can test the Create Purchase API and complete the integration.
