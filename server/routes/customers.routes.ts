/**
 * Customer Management Routes
 * Handles clients, leads, and bookings for platform admins and client admins
 * Platform admins can access any tenant's customer data
 * Client admins can only access their own tenant's customer data
 */

import { Router, Response } from 'express';
import { storage } from '../storage';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ============================================
// CLIENT API ENDPOINTS
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/clients
 * Get list of clients for a tenant
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/clients', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status, source, limit, offset } = req.query;

    // Authorization: Platform admin can access any tenant, client admin only their own
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's clients" });
    }

    const filters = {
      status: status as string | undefined,
      source: source as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const clients = await storage.getClientsByTenant(tenantId, filters);
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

/**
 * GET /api/platform/tenants/:tenantId/clients/stats
 * Get client statistics for a tenant
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/clients/stats',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Authorization check
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied to this tenant's data" });
      }

      const stats = await storage.getClientStats(tenantId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching client stats:', error);
      res.status(500).json({ error: 'Failed to fetch client statistics' });
    }
  },
);

/**
 * GET /api/platform/tenants/:tenantId/clients/:clientId
 * Get detailed information for a specific client
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get(
  '/:tenantId/clients/:clientId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, clientId } = req.params;

      // Authorization check
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied to this tenant's data" });
      }

      const client = await storage.getClient(clientId);
      if (!client || client.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Client not found' });
      }

      // Get client's service mappings
      const serviceMappings = await storage.getClientServiceMappings(clientId);

      // Get client's bookings
      const bookings = await storage.getBookingsByClient(clientId);

      // Get booking stats
      const bookingStats = await storage.getClientBookingStats(clientId);

      res.json({
        ...client,
        serviceMappings,
        bookings,
        stats: bookingStats,
      });
    } catch (error) {
      console.error('Error fetching client details:', error);
      res.status(500).json({ error: 'Failed to fetch client details' });
    }
  },
);

/**
 * POST /api/platform/tenants/:tenantId/clients
 * Create a new client
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.post('/:tenantId/clients', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Authorization check
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    const clientData = {
      ...req.body,
      tenantId, // Ensure tenantId from URL is used
    };

    // Check if client with this phone already exists
    const existingClient = await storage.getClientByPhone(tenantId, clientData.phone);
    if (existingClient) {
      return res.status(409).json({
        error: 'Client with this phone number already exists',
        existingClient,
      });
    }

    const client = await storage.createClient(clientData);
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

/**
 * PATCH /api/platform/tenants/:tenantId/clients/:clientId
 * Update client information
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.patch(
  '/:tenantId/clients/:clientId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, clientId } = req.params;

      // Authorization check
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied to this tenant' });
      }

      // Verify client belongs to tenant
      const existingClient = await storage.getClient(clientId);
      if (!existingClient || existingClient.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const updatedClient = await storage.updateClient(clientId, req.body);
      res.json(updatedClient);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Failed to update client' });
    }
  },
);

// ============================================
// BOOKING API ENDPOINTS
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/bookings
 * Get list of bookings for a tenant
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/bookings', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate, status, clientId, limit, offset } = req.query;

    // Authorization check
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's bookings" });
    }

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      status: status as string | undefined,
      clientId: clientId as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const bookings = await storage.getBookingsByTenant(tenantId, filters);
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * POST /api/platform/tenants/:tenantId/bookings
 * Create a new booking
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.post(
  '/:tenantId/bookings',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.params;

      // Authorization check
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied to this tenant' });
      }

      const bookingData = {
        ...req.body,
        tenantId, // Ensure tenantId from URL is used
      };

      // Verify client exists and belongs to tenant
      const client = await storage.getClient(bookingData.clientId);
      if (!client || client.tenantId !== tenantId) {
        return res
          .status(404)
          .json({ error: 'Client not found or does not belong to this tenant' });
      }

      const booking = await storage.createBooking(bookingData);

      // Update client's last booking date
      await storage.updateClient(bookingData.clientId, {
        lastBookingDate: booking.bookingDateTime,
      });

      res.status(201).json(booking);
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  },
);

// ============================================
// LEAD API ENDPOINTS
// ============================================

/**
 * GET /api/platform/tenants/:tenantId/leads
 * Get list of leads for a tenant
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.get('/:tenantId/leads', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { status, assignedAgentId, needsFollowUp, limit, offset } = req.query;

    // Authorization check
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: "Access denied to this tenant's leads" });
    }

    const filters = {
      status: status as string | undefined,
      assignedAgentId: assignedAgentId as string | undefined,
      needsFollowUp: needsFollowUp === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    };

    const leads = await storage.getLeadsByTenant(tenantId, filters);
    res.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/**
 * POST /api/platform/tenants/:tenantId/leads
 * Create a new lead
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.post('/:tenantId/leads', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;

    // Authorization check
    if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    const leadData = {
      ...req.body,
      tenantId, // Ensure tenantId from URL is used
    };

    // Check if lead with this phone already exists
    const existingLead = await storage.getLeadByPhone(tenantId, leadData.phone);
    if (existingLead) {
      return res.status(409).json({
        error: 'Lead with this phone number already exists',
        existingLead,
      });
    }

    const lead = await storage.createLead(leadData);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PATCH /api/platform/tenants/:tenantId/leads/:leadId
 * Update lead information
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.patch(
  '/:tenantId/leads/:leadId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, leadId } = req.params;

      // Authorization check
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied to this tenant' });
      }

      // Verify lead belongs to tenant
      const existingLead = await storage.getLead(leadId);
      if (!existingLead || existingLead.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const updatedLead = await storage.updateLead(leadId, req.body);
      res.json(updatedLead);
    } catch (error) {
      console.error('Error updating lead:', error);
      res.status(500).json({ error: 'Failed to update lead' });
    }
  },
);

export default router;
