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
import conversationRoutes from './conversation.routes';
import handoffRoutes from './handoff.routes';
import widgetRoutes from './widget.routes';
import miscRoutes from './misc.routes';

export async function registerModularRoutes(app: Express): Promise<void> {
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

  // ===== Phase 2: New Modular Routes =====

  // Function proxy routes (Retell AI function calls to N8N)
  app.use('/api/functions', functionRoutes);

  // Webhook receiver routes (Retell AI webhooks)
  app.use('/api/retell', webhookRoutes);

  // Conversation and message routes
  app.use('/', conversationRoutes); // Uses /api/messages, /api/conversations

  // Human agent handoff routes
  app.use('/', handoffRoutes); // Uses /api/human-agents, /api/widget-handoffs, /api/handoff

  // Widget embedding routes (public)
  app.use('/', widgetRoutes); // Uses /widget.js, /api/widget/*

  // Miscellaneous routes (widget config, API keys, health)
  app.use('/', miscRoutes); // Uses /api/widget-config, /api/api-keys, /api/health

  console.log(
    '[Router] ✅ Registered Phase 1 routes: auth, analytics, proxy, tenant, user, integration',
  );
  console.log(
    '[Router] ✅ Registered Phase 2 routes: function, webhook, conversation, handoff, widget, misc',
  );
  console.log('[Router] ✅ All modular routes registered successfully');
}
