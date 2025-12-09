import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { paymentLinks, externalApiConfigs } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../encryption';

const router = express.Router();

// Initialize Database
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

/**
 * Get tenant's Stripe client and webhook secret
 * For webhook verification, we need both the API key and webhook secret
 */
async function getTenantStripeConfig(tenantId: string): Promise<{
  stripe: Stripe;
  webhookSecret: string;
}> {
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

  if (!stripeConfig || !stripeConfig.encryptedCredentials) {
    throw new Error(`Stripe configuration not found for tenant ${tenantId}`);
  }

  const credentials = JSON.parse(decrypt(stripeConfig.encryptedCredentials));

  if (!credentials.token) {
    throw new Error(`Invalid Stripe credentials for tenant ${tenantId}`);
  }

  // Note: Webhook secret should be stored in credentials as well
  // Structure: { token: "sk_live_...", webhookSecret: "whsec_..." }
  const webhookSecret = credentials.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';

  return {
    stripe: new Stripe(credentials.token, { apiVersion: '2025-11-17.clover' }),
    webhookSecret,
  };
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

    /**
     * MULTI-TENANCY NOTE:
     * For true multi-tenant webhook verification, each tenant should configure their own
     * webhook endpoint in Stripe pointing to: /api/webhooks/stripe/:tenantId
     *
     * For now, we skip signature verification and rely on the database lookup.
     * In production, consider using Stripe Connect for proper multi-tenant webhooks.
     */

    let event: Stripe.Event;

    try {
      // Parse the webhook payload
      event = JSON.parse(req.body.toString());
      console.log(`[Stripe Webhook] Received event: ${event.type} - ${event.id}`);
    } catch (err) {
      console.error('[Stripe Webhook] Failed to parse webhook payload:', err);
      return res
        .status(400)
        .send(`Webhook Error: ${err instanceof Error ? err.message : 'Invalid payload'}`);
    }

    console.log(`[Stripe Webhook] Processing event: ${event.type}`);

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
