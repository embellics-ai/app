import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { paymentLinks, externalApiConfigs, bookings } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../encryption';

const router = express.Router();

// Initialize Database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

/**
 * Get tenant's Stripe API key from External API configs
 * Returns a Stripe client initialized with the tenant's credentials
 */
async function getTenantStripeClient(tenantId: string): Promise<Stripe> {
  // Fetch tenant's Stripe configuration
  const [stripeConfig] = await db
    .select()
    .from(externalApiConfigs)
    .where(
      and(
        eq(externalApiConfigs.tenantId, tenantId),
        eq(externalApiConfigs.serviceName, 'stripe'),
        eq(externalApiConfigs.isActive, true),
      ),
    )
    .limit(1);

  if (!stripeConfig) {
    throw new Error(`No Stripe configuration found for tenant ${tenantId}`);
  }

  if (!stripeConfig.encryptedCredentials) {
    throw new Error(`Stripe credentials not configured for tenant ${tenantId}`);
  }

  // Decrypt and parse credentials
  const credentials = JSON.parse(decrypt(stripeConfig.encryptedCredentials));

  if (!credentials.token) {
    throw new Error(`Invalid Stripe credentials for tenant ${tenantId}`);
  }

  // Return Stripe client with tenant's API key
  return new Stripe(credentials.token, {
    apiVersion: '2025-11-17.clover',
  });
}

/**
 * POST /api/payments/create-link
 * Creates a Stripe Checkout session and payment link record
 *
 * Body:
 * {
 *   tenantId: string (required)
 *   amount: number (required - in euros, e.g., 50.00)
 *   businessId: string (required - internal business UUID for N8N webhook queries)
 *   branchId: string (required - internal branch UUID for N8N webhook queries)
 *   externalServiceBookingId: string (required - external service booking ID like Phorest)
 *   currency?: string (optional - default: 'eur')
 *   bookingId?: string (optional - internal booking ID, can be linked later)
 *   expiresInMinutes?: number (optional - default: 30, min: 30, max: 1440 = 24 hours)
 * }
 */
router.post('/create-link', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      amount,
      currency = 'eur',
      bookingId,
      businessId,
      branchId,
      externalServiceBookingId,
      expiresInMinutes = 30,
    } = req.body;

    // Validation
    if (!tenantId || !amount || !externalServiceBookingId || !businessId || !branchId) {
      return res.status(400).json({
        error:
          'Missing required fields: tenantId, amount, businessId, branchId, externalServiceBookingId',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Amount must be greater than 0',
      });
    }

    // Validate expiry time (min: 30 minutes per Stripe requirement, max: 1440 minutes = 24 hours)
    const expiryMinutes = Math.min(Math.max(expiresInMinutes, 30), 1440);
    const expirySeconds = expiryMinutes * 60;

    // Check if payment link already exists for this externalServiceBookingId
    const [existingLink] = await db
      .select()
      .from(paymentLinks)
      .where(
        and(
          eq(paymentLinks.tenantId, tenantId),
          eq(paymentLinks.externalServiceBookingId, externalServiceBookingId),
        ),
      )
      .limit(1);

    if (existingLink) {
      // Retrieve the actual Stripe checkout URL for the existing session
      try {
        const stripe = await getTenantStripeClient(tenantId);
        const session = await stripe.checkout.sessions.retrieve(existingLink.stripeSessionId);

        // Check if session is expired or already completed
        if (session.status === 'expired') {
          // Session expired, we'll create a new one (fall through)
          console.log(
            `[Payment Link] Existing session expired for booking ${externalServiceBookingId}, creating new one`,
          );
        } else if (session.status === 'complete' || existingLink.status === 'completed') {
          // Already paid
          return res.status(200).json({
            success: true,
            paymentLink: {
              id: existingLink.id,
              stripeUrl: session.url,
              stripeSessionId: existingLink.stripeSessionId,
              amount: existingLink.amount,
              currency: existingLink.currency,
              status: existingLink.status,
              bookingId: existingLink.bookingId,
            },
            message: 'Payment already completed for this booking',
          });
        } else {
          // Session still active, return the existing URL
          return res.status(200).json({
            success: true,
            paymentLink: {
              id: existingLink.id,
              stripeUrl: session.url,
              stripeSessionId: existingLink.stripeSessionId,
              amount: existingLink.amount,
              currency: existingLink.currency,
              status: existingLink.status,
              bookingId: existingLink.bookingId,
            },
            message: 'Payment link already exists for this booking',
          });
        }
      } catch (stripeError) {
        console.error('[Stripe Session Retrieval Error]', stripeError);
        // If we can't retrieve from Stripe, create a new session
        console.log(
          `[Payment Link] Could not retrieve existing session for booking ${externalServiceBookingId}, creating new one`,
        );
      }
    }

    // Get tenant's Stripe client
    const stripe = await getTenantStripeClient(tenantId);

    // Create Stripe Checkout Session
    // Stripe expects amount in cents (smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: 'Booking Deposit Payment',
              description: `Booking ID: ${bookingId || externalServiceBookingId}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL?.replace(/\/$/, '')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL?.replace(/\/$/, '')}/payment/cancelled`,
      metadata: {
        tenantId,
        bookingId: bookingId || '',
        externalServiceBookingId: externalServiceBookingId || '',
      },
      expires_at: Math.floor(Date.now() / 1000) + expirySeconds,
    });

    // Store payment link in database
    const [paymentLink] = await db
      .insert(paymentLinks)
      .values({
        tenantId,
        bookingId,
        businessId,
        branchId,
        stripeSessionId: session.id,
        amount,
        currency,
        status: 'pending',
        externalServiceBookingId: externalServiceBookingId || null,
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
        bookingId: paymentLink.bookingId,
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
        // Get tenant's Stripe client
        const stripe = await getTenantStripeClient(paymentLink.tenantId);
        const session = await stripe.checkout.sessions.retrieve(paymentLink.stripeSessionId);

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
 * GET /api/payments/booking/:bookingId
 * Get payment link by booking ID
 */
router.get('/booking/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    const links = await db.select().from(paymentLinks).where(eq(paymentLinks.bookingId, bookingId));

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
