import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { paymentLinks } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Initialize Database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Initialize Stripe (lazy initialization to ensure env vars are loaded)
function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  
  return new Stripe(apiKey, {
    apiVersion: '2025-11-17.clover',
  });
}

/**
 * POST /api/payments/create-link
 * Creates a Stripe Checkout session and payment link record
 *
 * Body:
 * {
 *   tenantId: string
 *   amount: number (in euros, e.g., 50.00)
 *   currency?: string (default: 'eur')
 *   customerEmail?: string
 *   customerPhone?: string
 *   customerName?: string
 *   bookingReference: string
 *   phorestBookingId?: string
 *   phorestClientId?: string
 *   description?: string
 *   metadata?: object
 * }
 */
router.post('/create-link', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      amount,
      currency = 'eur',
      customerEmail,
      customerPhone,
      customerName,
      bookingReference,
      phorestBookingId,
      phorestClientId,
      description,
      metadata = {},
    } = req.body;

    // Validation
    if (!tenantId || !amount || !bookingReference) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, amount, bookingReference',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Amount must be greater than 0',
      });
    }

    // Create Stripe Checkout Session
    // Stripe expects amount in cents (smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    const session = await getStripeClient().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: description || 'Booking Payment',
              description: `Booking Reference: ${bookingReference}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/payment/cancelled`,
      customer_email: customerEmail,
      metadata: {
        tenantId,
        bookingReference,
        phorestBookingId: phorestBookingId || '',
        phorestClientId: phorestClientId || '',
        ...metadata,
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
    });

    // Store payment link in database
    const [paymentLink] = await db
      .insert(paymentLinks)
      .values({
        tenantId,
        bookingReference,
        stripeSessionId: session.id,
        amount,
        currency,
        status: 'pending',
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        customerName: customerName || null,
        phorestBookingId: phorestBookingId || null,
        phorestClientId: phorestClientId || null,
        description: description || null,
        metadata: metadata || {},
        expiresAt: new Date(session.expires_at * 1000),
      })
      .returning();

    return res.status(201).json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        stripeUrl: session.url,
        stripeSessionId: session.id,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        status: paymentLink.status,
        expiresAt: paymentLink.expiresAt,
        bookingReference: paymentLink.bookingReference,
      },
    });
  } catch (error) {
    console.error('[Payment Link Creation Error]', error);
    return res.status(500).json({
      error: 'Failed to create payment link',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/payments/:id/status
 * Check payment status by payment link ID
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const paymentLinkId = parseInt(req.params.id, 10);

    if (isNaN(paymentLinkId)) {
      return res.status(400).json({ error: 'Invalid payment link ID' });
    }

    const [paymentLink] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.id, paymentLinkId));

    if (!paymentLink) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    // If payment is still pending, check Stripe for latest status
    if (paymentLink.status === 'pending') {
      try {
        const session = await getStripeClient().checkout.sessions.retrieve(paymentLink.stripeSessionId);

        // Update status if payment was completed
        if (session.payment_status === 'paid') {
          const [updatedLink] = await db
            .update(paymentLinks)
            .set({
              status: 'completed',
              stripePaymentIntentId: session.payment_intent as string,
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(paymentLinks.id, paymentLinkId))
            .returning();

          return res.json({
            success: true,
            paymentLink: updatedLink,
          });
        }
      } catch (stripeError) {
        console.error('[Stripe Session Retrieval Error]', stripeError);
        // Continue with database status if Stripe call fails
      }
    }

    return res.json({
      success: true,
      paymentLink,
    });
  } catch (error) {
    console.error('[Payment Status Check Error]', error);
    return res.status(500).json({
      error: 'Failed to check payment status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/payments/booking/:reference
 * Get payment link by booking reference
 */
router.get('/booking/:reference', async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    const links = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.bookingReference, reference));

    if (links.length === 0) {
      return res.status(404).json({ error: 'No payment links found for this booking' });
    }

    return res.json({
      success: true,
      paymentLinks: links,
    });
  } catch (error) {
    console.error('[Payment Link Lookup Error]', error);
    return res.status(500).json({
      error: 'Failed to lookup payment links',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
