# Testing Phorest Create Purchase API

This guide helps you test if the Phorest API is working correctly before integrating it with Stripe payments.

## 📋 What You Need

Before testing, gather these from your Phorest system:

### 1. API Credentials

- **Username**: Format `global/your-username`
- **Password**: API password (NOT your login password)
- **Where to find**: Phorest Dashboard → Settings → API Access

### 2. Business & Branch IDs

- **Business ID**: Your business identifier in Phorest
- **Branch ID**: Usually the same as Business ID (unless multi-location)
- **Where to find**: Phorest Dashboard → Settings → Business Details

### 3. Test Client ID

- **Client ID**: A real customer ID from your Phorest system
- **Where to find**: Phorest Dashboard → Clients → Select any client → Check URL or ID field

---

## 🧪 How to Test

### Step 1: Configure Test Script

Open `test-phorest-simple.ts` and update these values:

```typescript
const PHOREST_CONFIG = {
  username: 'global/your-username', // e.g., 'global/southwilliamclinic'
  password: 'your-api-password', // Your Phorest API password
  businessId: 'your-business-id', // e.g., 'biz_abc123'
  branchId: 'your-branch-id', // Often same as businessId
  testClientId: 'client-id-123', // Real client from Phorest
};
```

### Step 2: Run Test

```bash
npx tsx test-phorest-simple.ts
```

### Step 3: Check Results

**✅ Success Response:**

```json
{
  "purchaseId": "pur_abc123",
  "clientId": "client-id-123",
  "totalAmount": 5000,
  "status": "completed"
}
```

**❌ Common Errors:**

| Status | Issue                 | Solution                                 |
| ------ | --------------------- | ---------------------------------------- |
| 401    | Authentication failed | Check username format: `global/username` |
| 404    | Endpoint not found    | Verify business/branch IDs               |
| 400    | Bad request           | Ensure client ID exists in Phorest       |
| 500    | Server error          | Check Phorest API status or payload      |

---

## 🔗 Integration with Stripe

Once Phorest API works, integrate it with the Stripe webhook:

### File: `server/routes/stripe-webhook.routes.ts`

Replace the TODO section with:

```typescript
import axios from 'axios';
import { externalApiConfigs } from '../../shared/schema';

async function recordPhorestPurchase(paymentLink: any) {
  console.log(`[Phorest] Recording purchase for payment ${paymentLink.id}`);

  try {
    // Get Phorest config for this tenant
    const [config] = await db
      .select()
      .from(externalApiConfigs)
      .where(eq(externalApiConfigs.tenantId, paymentLink.tenantId))
      .where(eq(externalApiConfigs.serviceName, 'phorest'));

    if (!config) {
      throw new Error('Phorest configuration not found for tenant');
    }

    // Decrypt credentials (implement your decryption logic)
    const credentials = JSON.parse(config.encryptedCredentials || '{}');

    const businessId = credentials.businessId || credentials.business_id;
    const branchId = credentials.branchId || credentials.branch_id || businessId;

    // Create purchase in Phorest
    const purchaseUrl = `${config.baseUrl}/business/${businessId}/branch/${branchId}/purchase`;

    const response = await axios.post(
      purchaseUrl,
      {
        clientId: paymentLink.phorestClientId,
        payment: [
          {
            amount: Math.round(paymentLink.amount * 100), // Convert € to cents
            paymentTypeId: 1, // Card payment
            type: 'debit',
          },
        ],
        items: [
          {
            description: paymentLink.description || 'Online Payment',
            price: Math.round(paymentLink.amount * 100),
            quantity: 1,
          },
        ],
      },
      {
        auth: {
          username: credentials.username,
          password: credentials.password,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    // Update payment link with Phorest purchase ID
    await db
      .update(paymentLinks)
      .set({
        phorestPurchaseId: response.data.purchaseId || response.data.id,
        updatedAt: new Date(),
      })
      .where(eq(paymentLinks.id, paymentLink.id));

    console.log(`[Phorest] Purchase recorded: ${response.data.purchaseId || response.data.id}`);
    return response.data;
  } catch (error) {
    console.error('[Phorest] Failed to record purchase:', error);

    if (axios.isAxiosError(error)) {
      console.error('[Phorest] API Error:', {
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    // Don't throw - payment was successful in Stripe
    // Log error for manual review
    return null;
  }
}

// In handleCheckoutSessionCompleted function, replace:
if (updatedLink.phorestBookingId) {
  console.log(
    `[Stripe Webhook] TODO: Record purchase in Phorest for booking ${updatedLink.phorestBookingId}`,
  );
  // await recordPhorestPurchase(updatedLink);
}

// With:
if (updatedLink.phorestClientId) {
  await recordPhorestPurchase(updatedLink);
}
```

---

## 📊 Complete Flow After Integration

1. **Customer books via chat/WhatsApp**
   - Booking created in Phorest (status: Reserved)
   - Phorest returns booking ID and client ID

2. **Generate payment link**

   ```javascript
   POST /api/payments/create-link
   {
     "tenantId": "...",
     "amount": 50.00,
     "phorestBookingId": "booking_123",
     "phorestClientId": "client_456",  // Important!
     "bookingReference": "booking_123"
   }
   ```

3. **Send link to customer** (SMS/WhatsApp)

4. **Customer pays**
   - Stripe checkout completed
   - Stripe sends webhook to your server

5. **Webhook processes payment**
   - Updates `payment_links` status to 'completed'
   - Calls `recordPhorestPurchase()`
   - Creates purchase in Phorest
   - Links purchase to booking
   - Booking status can be updated to Confirmed

6. **Customer receives confirmation**

---

## 🐛 Troubleshooting

### Test fails with 401 Unauthorized

**Check:**

- Username must be `global/your-username` format
- Password is the API password (not login password)
- Credentials are from Phorest API Access settings

### Test fails with 404 Not Found

**Check:**

- Business ID is correct
- Branch ID is correct (try using same as business ID)
- Using correct base URL for your region:
  - EU: `https://api-gateway-eu.phorest.com/third-party-api-server/api`
  - US: `https://api-gateway-us.phorest.com/third-party-api-server/api`

### Test fails with 400 Bad Request

**Check:**

- Client ID exists in Phorest (use a real customer)
- Payment amount matches item total
- Amount is in cents (5000 = €50.00)
- Payment type ID is valid (1 = card, 2 = cash)

### Purchase created but booking not updated

**Phorest Note:** The Create Purchase API records the payment but doesn't automatically update the booking status. You may need to:

1. Use Phorest Update Booking API separately, OR
2. Manually update booking status in Phorest dashboard, OR
3. Use Phorest webhooks to sync booking status

---

## 📚 Resources

- **Phorest API Docs:** https://developer.phorest.com/reference/createpurchase
- **Phorest API Support:** support@phorest.com
- **Stripe Webhooks:** https://stripe.com/docs/webhooks

---

## ✅ Checklist

Before going live:

- [ ] Test Phorest API with `test-phorest-simple.ts`
- [ ] Verify purchase appears in Phorest dashboard
- [ ] Add Phorest credentials to `external_api_configs` table
- [ ] Integrate `recordPhorestPurchase()` in webhook handler
- [ ] Test complete flow: booking → payment → Phorest purchase
- [ ] Set up error monitoring for failed Phorest calls
- [ ] Document manual process for failed purchases
- [ ] Train staff on reconciliation process

---

**Need help?** Check the inline comments in the test scripts or reach out to Phorest support for API-specific questions.
