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

// ============================================
// BOOKING LIFECYCLE ENDPOINTS
// ============================================

/**
 * PATCH /api/platform/tenants/:tenantId/bookings/:bookingId
 * Update booking status and details
 * Accessible by: Platform Admin (any tenant) OR Client Admin (own tenant only)
 */
router.patch(
  '/:tenantId/bookings/:bookingId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId, bookingId } = req.params;
      const { action, ...updateData } = req.body;

      // Authorization check
      if (!req.user!.isPlatformAdmin && req.user!.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied to this tenant' });
      }

      // Get existing booking to verify tenant ownership
      const existingBooking = await storage.getBooking(bookingId);
      if (!existingBooking || existingBooking.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      let updatedBooking;

      // Handle specific actions
      if (action === 'confirm') {
        const { depositAmount } = updateData;
        updatedBooking = await storage.confirmBooking(bookingId, depositAmount);
      } else if (action === 'complete') {
        updatedBooking = await storage.completeBooking(bookingId);
      } else if (action === 'cancel') {
        const { reason, refundAmount, notes } = updateData;
        if (!reason) {
          return res.status(400).json({ error: 'Cancellation reason is required' });
        }
        updatedBooking = await storage.cancelBooking(bookingId, reason, refundAmount, notes);
      } else if (action === 'no_show') {
        updatedBooking = await storage.markBookingNoShow(bookingId);
      } else {
        // General update
        updatedBooking = await storage.updateBooking(bookingId, updateData);
      }

      res.json(updatedBooking);
    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  },
);

/**
 * POST /api/platform/interactions/track
 * Track customer interaction (reservation/inquiry) - NO Phorest call
 * Creates/updates client record and optional lead record
 * Used for: Initial contact, reservation inquiry, pre-payment tracking
 */
router.post('/interactions/track', async (req, res: Response) => {
  try {
    const {
      tenantId,
      phone,
      email,
      firstName,
      lastName,
      source, // 'voice', 'web', 'whatsapp'
      sourceDetails, // { callId, chatId, etc }
      interactionType, // 'inquiry', 'reservation', 'callback_request'
      notes,
      serviceInterest, // Optional: what service they inquired about
    } = req.body;

    // Validate required fields
    if (!tenantId || !phone || !source) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, phone, source',
      });
    }

    // Check for existing client by phone
    let client = await storage.getClientByPhone(tenantId, phone);

    if (!client) {
      // Create new client
      client = await storage.createClient({
        tenantId,
        phone,
        email,
        firstName,
        lastName,
        firstInteractionSource: source, // Use correct field name
        status: 'active', // Changed from 'lead' to 'active'
      });
    } else {
      // Update existing client if new information provided
      const updates: any = {};
      if (email && !client.email) updates.email = email;
      if (firstName && !client.firstName) updates.firstName = firstName;
      if (lastName && !client.lastName) updates.lastName = lastName;

      if (Object.keys(updates).length > 0) {
        await storage.updateClient(client.id, updates);
        client = { ...client, ...updates };
      }
    }

    // Create lead record if this is an inquiry/reservation
    let lead = null;
    if (
      interactionType &&
      ['inquiry', 'reservation', 'callback_request'].includes(interactionType)
    ) {
      const existingLead = await storage.getLeadByPhone(tenantId, phone);

      if (existingLead) {
        // Update existing lead
        lead = await storage.updateLead(existingLead.id, {
          status: interactionType === 'reservation' ? 'interested' : 'new',
          notes: notes ? `${existingLead.notes || ''}\n${notes}` : existingLead.notes,
          lastContactedAt: new Date(),
        });
      } else {
        // Create new lead (client is guaranteed to exist here)
        const clientData = client!; // TypeScript assertion
        lead = await storage.createLead({
          tenantId,
          phone,
          email: email || clientData.email,
          firstName: firstName || clientData.firstName,
          lastName: lastName || clientData.lastName,
          status: interactionType === 'reservation' ? 'interested' : 'new',
          source,
          sourceDetails,
          notes,
        });
      }
    }

    res.status(200).json({
      success: true,
      client,
      lead,
      message: client ? 'Interaction tracked successfully' : 'New client and interaction tracked',
    });
  } catch (error) {
    console.error('Error tracking interaction:', error);
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

/**
 * POST /api/platform/bookings/complete
 * Complete booking flow: Create booking + Phorest integration + mapping
 * Used when: Customer pays deposit, booking is confirmed
 */
router.post('/bookings/complete', async (req, res: Response) => {
  try {
    const {
      tenantId,
      clientId,
      businessId,
      branchId,
      serviceName,
      serviceCategory,
      amount,
      currency,
      depositAmount,
      bookingDateTime,
      duration,
      staffMemberName,
      staffMemberId,
      bookingSource,
      bookingSourceDetails,
      // Phorest integration data
      createInPhorest = true,
      phorestClientId, // Optional: if client already exists in Phorest
    } = req.body;

    // Validate required fields
    if (!tenantId || !clientId || !serviceName || !amount || !bookingDateTime || !bookingSource) {
      return res.status(400).json({
        error:
          'Missing required fields: tenantId, clientId, serviceName, amount, bookingDateTime, bookingSource',
      });
    }

    // Get client information
    const client = await storage.getClient(clientId);
    if (!client || client.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Create booking in our system with confirmed status if deposit paid
    const bookingStatus = depositAmount ? 'confirmed' : 'pending';
    const paymentStatus = depositAmount ? 'deposit_paid' : 'awaiting_deposit';

    const booking = await storage.createBooking({
      tenantId,
      clientId,
      businessId,
      branchId,
      serviceName,
      serviceCategory,
      amount,
      currency: currency || 'EUR',
      paymentStatus,
      depositAmount,
      bookingDateTime: new Date(bookingDateTime),
      duration,
      staffMemberName,
      staffMemberId,
      status: bookingStatus,
      serviceProvider: 'phorest_api',
      bookingSource,
      bookingSourceDetails,
    });

    // Update booking with confirmation timestamp if deposit paid
    if (depositAmount) {
      await storage.confirmBooking(booking.id, depositAmount);
    }

    // Update client status to active if this is their first booking
    if (client.status === 'lead') {
      await storage.updateClient(clientId, {
        status: 'active',
        lastBookingDate: booking.bookingDateTime,
      });
    } else {
      await storage.updateClient(clientId, {
        lastBookingDate: booking.bookingDateTime,
      });
    }

    // TODO: Integrate with Phorest API
    // if (createInPhorest) {
    //   const phorestService = new PhorestService();
    //   let phorestClientIdToUse = phorestClientId;
    //
    //   if (!phorestClientIdToUse) {
    //     // Check if client mapping exists
    //     const mapping = await storage.getClientServiceMappings(clientId);
    //     const phorestMapping = mapping.find(m => m.serviceProvider === 'phorest_api');
    //
    //     if (phorestMapping) {
    //       phorestClientIdToUse = phorestMapping.externalClientId;
    //     } else {
    //       // Create client in Phorest
    //       const phorestClient = await phorestService.createClient(tenantId, {
    //         firstName: client.firstName,
    //         lastName: client.lastName,
    //         mobile: client.phone,
    //         email: client.email,
    //       });
    //       phorestClientIdToUse = phorestClient.clientId;
    //
    //       // Create mapping
    //       await storage.createClientServiceMapping({
    //         clientId,
    //         serviceProvider: 'phorest_api',
    //         externalClientId: phorestClientIdToUse,
    //       });
    //     }
    //   }
    //
    //   // Create booking in Phorest
    //   const phorestBooking = await phorestService.createBooking(tenantId, {
    //     clientId: phorestClientIdToUse,
    //     branchId: branchId,
    //     startTime: bookingDateTime,
    //     serviceName: serviceName,
    //     staffId: staffMemberId,
    //   });
    //
    //   // Update our booking with Phorest ID
    //   await storage.updateBooking(booking.id, {
    //     serviceProviderBookingId: phorestBooking.appointmentId,
    //     serviceProviderData: phorestBooking,
    //   });
    // }

    res.status(201).json({
      success: true,
      booking,
      message: 'Booking completed successfully',
    });
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

export default router;
