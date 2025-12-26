# Customer Management Integration Guide

**Date:** December 26, 2025  
**Purpose:** Guide for integrating customer tracking with voice/web/whatsapp booking flows

---

## 🎯 Integration Overview

When a customer books through your platform (Voice/Web/WhatsApp), you need to:

1. **Create or update the client record** (track the customer)
2. **Create a booking record** (track the appointment)
3. **Create/update service mappings** (link to Phorest/Fresha IDs)

---

## 📞 Integration Points

### **Where to Call These Endpoints:**

The customer management endpoints should be called from your **booking confirmation logic**, which likely happens in:

1. **Retell AI Call Completion** - When voice booking is confirmed
2. **Chat Widget Booking** - When web chat booking is confirmed
3. **WhatsApp Booking** - When WhatsApp booking is confirmed
4. **N8N Webhook Handlers** - When your workflow processes booking confirmations

---

## 🔌 API Endpoints to Use

### **Base URL Pattern:**

```
POST /api/platform/tenants/:tenantId/clients
POST /api/platform/tenants/:tenantId/bookings
```

### **Authentication:**

All endpoints require authentication. You'll need to:

- Use a **service account token** OR
- Call from **server-side** with proper auth context

---

## 📝 Step-by-Step Integration Flow

### **Scenario: Customer Books via Voice Call**

```javascript
// Step 1: After successful booking in Retell AI webhook handler
// Location: server/routes/n8n.routes.ts or wherever you handle Retell webhooks

async function handleBookingConfirmation(bookingData) {
  const tenantId = bookingData.tenantId; // e.g., "eb40f9f0-e696-4f46-bf00-4c7cf96338cc"
  const customerPhone = bookingData.customerPhone; // e.g., "+353871234567"

  // Step 1: Check if client already exists
  let client = await storage.getClientByPhone(tenantId, customerPhone);

  if (!client) {
    // Create new client
    client = await storage.createClient({
      tenantId: tenantId,
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email, // Can be null
      phone: customerPhone,
      firstInteractionSource: 'voice', // or 'web' or 'whatsapp'
      firstInteractionDate: new Date(),
      firstBookingDate: new Date(),
      status: 'active',
    });
  } else {
    // Update existing client (e.g., update lastBookingDate)
    await storage.updateClient(client.id, {
      lastBookingDate: new Date(),
      status: 'active',
    });
  }

  // Step 2: Create the booking record
  const booking = await storage.createBooking({
    tenantId: tenantId,
    clientId: client.id,
    bookingDate: new Date(bookingData.appointmentDateTime),
    serviceName: bookingData.serviceName, // e.g., "Deep Tissue Massage"
    serviceCategory: bookingData.category, // e.g., "massage"
    duration: bookingData.durationMinutes, // e.g., 60
    staffMember: bookingData.staffName, // e.g., "Emma Thompson"
    amount: bookingData.price, // e.g., 75.00
    currency: 'EUR',
    status: 'confirmed', // or 'pending'
    paymentStatus: 'pending', // or 'paid' if prepaid
    source: 'voice', // or 'web' or 'whatsapp'
    externalBookingId: bookingData.phorestBookingId, // If from Phorest
    notes: bookingData.notes,
  });

  // Step 3: Create service provider mapping (link to Phorest/Fresha)
  if (bookingData.phorestClientId) {
    await storage.createClientServiceMapping({
      clientId: client.id,
      serviceProvider: 'phorest',
      externalClientId: bookingData.phorestClientId,
      businessId: bookingData.phorestBusinessId,
      branchId: bookingData.phorestBranchId,
    });
  }

  return { client, booking };
}
```

---

## 🔗 Integration Points in Your Codebase

### **1. Retell AI Voice Calls**

**File:** `server/routes/webhook.routes.ts` or similar  
**When:** After call ends with successful booking

```typescript
// In your Retell webhook handler
router.post('/retell/call-ended', async (req, res) => {
  const callData = req.body;

  if (callData.bookingConfirmed) {
    // Extract booking details from call transcript or structured data
    const bookingDetails = extractBookingFromCall(callData);

    // Call customer management integration
    await handleBookingConfirmation({
      tenantId: callData.metadata.tenantId,
      customerPhone: callData.customerPhoneNumber,
      firstName: bookingDetails.firstName,
      lastName: bookingDetails.lastName,
      email: bookingDetails.email,
      serviceName: bookingDetails.service,
      appointmentDateTime: bookingDetails.dateTime,
      price: bookingDetails.price,
      durationMinutes: bookingDetails.duration,
      phorestClientId: bookingDetails.phorestClientId, // If you create in Phorest
    });
  }

  res.json({ success: true });
});
```

### **2. Web Chat Widget**

**File:** `server/routes/conversation.routes.ts` or webhook handler  
**When:** Chat ends with booking confirmation

```typescript
// In your chat completion handler
router.post('/chat/booking-confirmed', requireAuth, async (req, res) => {
  const { tenantId } = req.user;
  const bookingData = req.body;

  await handleBookingConfirmation({
    tenantId: tenantId,
    customerPhone: bookingData.phone,
    firstName: bookingData.firstName,
    lastName: bookingData.lastName,
    email: bookingData.email,
    serviceName: bookingData.service,
    appointmentDateTime: bookingData.dateTime,
    price: bookingData.price,
    source: 'web',
  });

  res.json({ success: true });
});
```

### **3. WhatsApp Bookings**

**File:** Where you handle WhatsApp business messages  
**When:** Booking confirmed via WhatsApp conversation

```typescript
// In WhatsApp message handler
async function handleWhatsAppBooking(message, tenantId) {
  const bookingData = parseWhatsAppBooking(message);

  await handleBookingConfirmation({
    tenantId: tenantId,
    customerPhone: message.from, // WhatsApp number
    firstName: bookingData.firstName,
    lastName: bookingData.lastName,
    serviceName: bookingData.service,
    appointmentDateTime: bookingData.dateTime,
    price: bookingData.price,
    source: 'whatsapp',
  });
}
```

### **4. N8N Workflow Integration**

**File:** `server/routes/n8n.routes.ts`  
**Webhook Endpoint:** Your N8N can POST to a new endpoint

```typescript
// New endpoint for N8N to call after processing bookings
router.post('/n8n/booking-created', async (req, res) => {
  const { tenantId, bookingData } = req.body;

  try {
    await handleBookingConfirmation({
      tenantId: tenantId,
      customerPhone: bookingData.phone,
      firstName: bookingData.firstName,
      lastName: bookingData.lastName,
      email: bookingData.email,
      serviceName: bookingData.service,
      appointmentDateTime: bookingData.dateTime,
      price: bookingData.price,
      phorestClientId: bookingData.phorestClientId,
      source: bookingData.source, // 'voice', 'web', or 'whatsapp'
    });

    res.json({ success: true, message: 'Customer tracked' });
  } catch (error) {
    console.error('Error tracking customer:', error);
    res.status(500).json({ error: 'Failed to track customer' });
  }
});
```

---

## 🎨 Using Storage Functions Directly

Since you're in the same codebase, you can use the storage functions directly without HTTP calls:

```typescript
import { storage } from '../storage';

// Check if client exists
const existingClient = await storage.getClientByPhone(tenantId, phone);

// Create new client
const client = await storage.createClient({ ...clientData });

// Update client
await storage.updateClient(clientId, { lastBookingDate: new Date() });

// Create booking
const booking = await storage.createBooking({ ...bookingData });

// Create service mapping
await storage.createClientServiceMapping({ ...mappingData });
```

---

## 🔄 Complete Integration Example

```typescript
/**
 * Universal booking handler that works for all sources
 * Add this to server/routes/customers.routes.ts or create a new service file
 */

interface UnifiedBookingData {
  tenantId: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
  email?: string;
  serviceName: string;
  serviceCategory?: string;
  appointmentDateTime: Date;
  duration?: number;
  staffMember?: string;
  price: number;
  source: 'voice' | 'web' | 'whatsapp';
  phorestClientId?: string;
  phorestBusinessId?: string;
  phorestBranchId?: string;
  phorestBookingId?: string;
  notes?: string;
}

export async function trackCustomerBooking(data: UnifiedBookingData) {
  try {
    // 1. Find or create client
    let client = await storage.getClientByPhone(data.tenantId, data.customerPhone);

    const now = new Date();

    if (!client) {
      // New customer - create client record
      client = await storage.createClient({
        tenantId: data.tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.customerPhone,
        firstInteractionSource: data.source,
        firstInteractionDate: now,
        firstBookingDate: now,
        lastBookingDate: now,
        status: 'active',
      });

      console.log(`[Customer Tracking] New client created: ${client.id}`);
    } else {
      // Existing customer - update last booking date
      await storage.updateClient(client.id, {
        lastBookingDate: now,
        status: 'active',
        // Optionally update email if it was null before
        ...(data.email && !client.email && { email: data.email }),
      });

      console.log(`[Customer Tracking] Updated existing client: ${client.id}`);
    }

    // 2. Create booking record
    const booking = await storage.createBooking({
      tenantId: data.tenantId,
      clientId: client.id,
      bookingDate: data.appointmentDateTime,
      serviceName: data.serviceName,
      serviceCategory: data.serviceCategory || null,
      duration: data.duration || null,
      staffMember: data.staffMember || null,
      amount: data.price,
      currency: 'EUR',
      status: 'confirmed',
      paymentStatus: 'pending',
      source: data.source,
      externalBookingId: data.phorestBookingId || null,
      notes: data.notes || null,
    });

    console.log(`[Customer Tracking] Booking created: ${booking.id}`);

    // 3. Create/update Phorest mapping if provided
    if (data.phorestClientId) {
      const existingMapping = await storage.getClientServiceMappings(client.id);
      const phorestMapping = existingMapping.find(
        (m) => m.serviceProvider === 'phorest' && m.businessId === data.phorestBusinessId,
      );

      if (!phorestMapping) {
        await storage.createClientServiceMapping({
          clientId: client.id,
          serviceProvider: 'phorest',
          externalClientId: data.phorestClientId,
          businessId: data.phorestBusinessId || null,
          branchId: data.phorestBranchId || null,
        });

        console.log(`[Customer Tracking] Phorest mapping created`);
      }
    }

    return {
      success: true,
      clientId: client.id,
      bookingId: booking.id,
      isNewClient: !client.createdAt || client.createdAt === now,
    };
  } catch (error) {
    console.error('[Customer Tracking] Error:', error);
    throw error;
  }
}
```

---

## 🚀 Next Steps

1. **Identify your booking confirmation points** - Where in your code do you know a booking succeeded?
2. **Add the tracking call** - Call `trackCustomerBooking()` at those points
3. **Test with a real booking** - Make a test booking and verify it appears in dashboard
4. **Monitor the logs** - Watch for `[Customer Tracking]` messages
5. **Verify in UI** - Check the Customers page to see the new client and booking

---

## 🔍 Testing the Integration

### **Manual Test via API:**

```bash
# 1. Create a test client
curl -X POST http://localhost:3000/api/platform/tenants/YOUR_TENANT_ID/clients \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Customer",
    "phone": "+353871111111",
    "email": "test@example.com",
    "firstInteractionSource": "voice",
    "firstInteractionDate": "2025-12-26T10:00:00Z",
    "firstBookingDate": "2025-12-26T10:00:00Z",
    "status": "active"
  }'

# 2. Create a booking for that client
curl -X POST http://localhost:3000/api/platform/tenants/YOUR_TENANT_ID/bookings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "CLIENT_ID_FROM_STEP_1",
    "bookingDate": "2025-12-27T14:00:00Z",
    "serviceName": "Deep Tissue Massage",
    "serviceCategory": "massage",
    "duration": 60,
    "staffMember": "Emma Thompson",
    "amount": 75.00,
    "currency": "EUR",
    "status": "confirmed",
    "paymentStatus": "pending",
    "source": "voice"
  }'

# 3. Check the dashboard
# Navigate to http://localhost:3000/customers
# Select your tenant
# You should see the new client with 1 booking
```

---

## 📊 Monitoring Integration

Add logging to track customer creation:

```typescript
// In your booking handlers
console.log('[Booking Confirmed]', {
  tenantId,
  customerPhone,
  service,
  source,
  timestamp: new Date().toISOString(),
});

// After calling trackCustomerBooking
console.log('[Customer Tracked]', {
  clientId,
  bookingId,
  isNewClient,
  timestamp: new Date().toISOString(),
});
```

---

## ❓ Common Questions

### **Q: Do I need to call these endpoints from the frontend?**

**A:** No! These should be called **server-side** when a booking is confirmed. The frontend just views the data.

### **Q: What if the phone number format is different?**

**A:** Normalize phone numbers before storing (e.g., always use E.164 format like +353871234567)

### **Q: What if a customer books without providing their name?**

**A:** You can store "Unknown" or the phone number as firstName until they provide it later

### **Q: Should I track cancelled bookings?**

**A:** Yes! Create the booking record, then update its status to 'cancelled' when needed

### **Q: What about walk-in customers who don't book through the platform?**

**A:** Those should NOT be tracked here. This is specifically for platform-originated bookings.

---

## 🎯 Summary

**To populate the customer database:**

1. Add `trackCustomerBooking()` calls to your webhook handlers
2. Call it after successful booking confirmation
3. Pass customer details, booking details, and source channel
4. The function handles create-or-update logic automatically

**Current state:** Database structure is ready, endpoints are built, just needs integration with your booking flow!
