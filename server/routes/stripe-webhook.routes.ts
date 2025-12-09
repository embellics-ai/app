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

// Lazy initialization function for Stripe client
function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  return new Stripe(apiKey, { apiVersion: '2025-11-17.clover' });
}

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler for payment events
 *
 * This endpoint receives webhooks from Stripe when payment events occur.
 * It verifies the webhook signature and processes the event.
 *
 * IMPORTANT: This endpoint must use raw body for signature verification
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('[Stripe Webhook] No signature found');
      return res.status(400).send('No signature');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = getStripeClient().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return res
        .status(400)
        .send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    try {
      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(session);
          break;
        }

        case 'checkout.session.expired': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionExpired(session);
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe Webhook] Payment Intent succeeded: ${paymentIntent.id}`);
          // Additional processing if needed
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe Webhook] Payment Intent failed: ${paymentIntent.id}`);
          // Mark payment as failed if needed
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      // Return 200 to acknowledge receipt
      return res.json({ received: true });
    } catch (error) {
      console.error('[Stripe Webhook] Error processing event:', error);
      return res.status(500).json({
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * Handle successful checkout session
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);

  try {
    // Find payment link by session ID
    const [paymentLink] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.stripeSessionId, session.id));

    if (!paymentLink) {
      console.error(`[Stripe Webhook] Payment link not found for session: ${session.id}`);
      return;
    }

    // Update payment link status
    const [updatedLink] = await db
      .update(paymentLinks)
      .set({
        status: 'completed',
        stripePaymentIntentId: session.payment_intent as string,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentLinks.id, paymentLink.id))
      .returning();

    console.log(`[Stripe Webhook] Payment link ${updatedLink.id} marked as completed`);

    // TODO: Call Phorest API to record purchase
    // This will be implemented in the next step
    if (updatedLink.phorestBookingId) {
      console.log(
        `[Stripe Webhook] TODO: Record purchase in Phorest for booking ${updatedLink.phorestBookingId}`,
      );
      // await recordPhorestPurchase(updatedLink);
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error handling checkout session completed:', error);
    throw error;
  }
}

/**
 * Handle expired checkout session
 */
async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log(`[Stripe Webhook] Checkout session expired: ${session.id}`);

  try {
    // Find payment link by session ID
    const [paymentLink] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.stripeSessionId, session.id));

    if (!paymentLink) {
      console.error(`[Stripe Webhook] Payment link not found for session: ${session.id}`);
      return;
    }

    // Update payment link status to expired
    await db
      .update(paymentLinks)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(eq(paymentLinks.id, paymentLink.id));

    console.log(`[Stripe Webhook] Payment link ${paymentLink.id} marked as expired`);
  } catch (error) {
    console.error('[Stripe Webhook] Error handling checkout session expired:', error);
    throw error;
  }
}

export default router;
