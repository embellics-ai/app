/**
 * Main Router Index
 * Registers all modular route handlers
 *
 * REFACTORING STATUS: ✅ Complete migration (Phase 1 + Phase 2)
 *
 * Phase 1 (Already extracted):
 * - ✅ Auth routes: Fully extracted
 * - ✅ Analytics routes: Fully extracted
 * - ✅ Proxy routes: Fully extracted (WhatsApp, Retell, External API)
 * - ✅ Tenant routes: Partially extracted (basic CRUD)
 * - ✅ User routes: Fully extracted (invitations, user management)
 * - ✅ Integration routes: Fully extracted (WhatsApp, SMS, N8N, webhooks)
 *
 * Phase 2 (New extractions):
 * - ✅ Function routes: Retell function proxy
 * - ✅ Webhook routes: Retell webhook receivers
 * - ✅ Conversation routes: Messages and conversations
 * - ✅ Handoff routes: Human agent handoff management
 * - ✅ Widget routes: Public widget embedding
 * - ✅ Misc routes: Widget config, API keys, health check
 */

import type { Express } from 'express';

// Public routes (no auth) - MUST be registered first
import lookupRoutes from './lookup.routes';

// Phase 1 routes
import authRoutes from './auth.routes';
import analyticsRoutes from './analytics.routes';
import proxyRoutes from './proxy.routes';
import tenantRoutes from './tenant.routes';
import userRoutes from './user.routes';
import integrationRoutes from './integration.routes';

// Phase 2 routes
import functionRoutes from './function.routes';
import webhookRoutes from './webhook.routes';
import n8nRoutes from './n8n.routes';
import retellAgentRoutes from './retell-agent.routes';
import conversationRoutes from './conversation.routes';
import handoffRoutes from './handoff.routes';
import widgetRoutes from './widget.routes';
import widgetTestRoutes from './widget-test.routes';
import widgetConfigRoutes from './widget-config.routes';
import paymentRoutes from './payment.routes';
import stripeWebhookRoutes from './stripe-webhook.routes';
import phorestRoutes from './phorest.routes';
import customersRoutes from './customers.routes';

export async function registerModularRoutes(app: Express): Promise<void> {
  // ===== Public Routes (No Auth) - Register FIRST =====

  // Public tenant lookup for external integrations (Retell AI, voice agents, etc.)
  app.use('/api/lookup', lookupRoutes);

  // ===== Phase 1: Extracted Modular Routes =====

  // Authentication routes
  app.use('/api/auth', authRoutes);

  // Analytics routes (fixed for client admin access)
  app.use('/api/platform/tenants', analyticsRoutes);

  // Proxy routes (WhatsApp, Retell AI, External APIs)
  app.use('/api/proxy', proxyRoutes);
  app.use('/api/whatsapp', proxyRoutes); // Also register WhatsApp webhooks at /api/whatsapp

  // Tenant management routes
  app.use('/api/platform/tenants', tenantRoutes);
  app.use('/api/tenants', tenantRoutes); // Also register at /api/tenants for backward compatibility

  // User management routes (Platform Admin)
  app.use('/api/platform', userRoutes);

  // Integration routes (WhatsApp, SMS, N8N, webhooks)
  app.use('/api/platform/tenants', integrationRoutes);

  // Retell agent management routes (sync agents from Retell API)
  app.use('/api/platform/tenants', retellAgentRoutes);

  // ===== Phase 2: New Modular Routes =====

  // Function proxy routes (Retell AI function calls to N8N)
  app.use('/api/functions', functionRoutes);

  // Webhook receiver routes (Retell AI webhooks)
  app.use('/api/retell', webhookRoutes);

  // Dynamic N8N webhook routes (unified handler for all workflows)
  app.use('/api/n8n', n8nRoutes);

  // Conversation and message routes
  app.use('/', conversationRoutes); // Uses /api/messages, /api/conversations

  // Human agent handoff routes
  app.use('/', handoffRoutes); // Uses /api/human-agents, /api/widget-handoffs, /api/handoff

  // Widget embedding routes (public)
  app.use('/', widgetRoutes); // Uses /widget.js, /api/widget/*

  // Widget test page routes (platform admin only)
  app.use('/api/platform', widgetTestRoutes); // Uses /api/platform/widget-test-page

  // Widget configuration routes (client admin)
  app.use('/', widgetConfigRoutes); // Uses /api/widget-config, /api/api-keys, /api/health

  // Payment routes (Stripe integration)
  app.use('/api/payments', paymentRoutes);

  // Stripe webhook routes (MUST come before JSON body parser in main app)
  app.use('/api/webhooks', stripeWebhookRoutes);

  // Phorest API routes (universal client creation endpoint)
  app.use('/api/phorest', phorestRoutes);

  // Customer management routes (clients, leads, bookings)
  app.use('/api/platform', customersRoutes);

  console.log(
    '[Router] ✅ Registered public routes: lookup (tenant lookup for external integrations)',
  );
  console.log(
    '[Router] ✅ Registered Phase 1 routes: auth, analytics, proxy, tenant, user, integration',
  );
  console.log(
    '[Router] ✅ Registered Phase 2 routes: function, webhook, n8n, conversation, handoff, widget, widget-test, widget-config, payment, stripe-webhook, phorest, customers',
  );
  console.log('[Router] ✅ All modular routes registered successfully');
}
