/**
 * Customer Management Routes
 * Handles clients, leads, and bookings for platform admins and client admins
 * Platform admins can access any tenant's customer data
 * Client admins can only access their own tenant's customer data
 */

import { Router, Response, Request } from 'express';
import { storage } from '../storage';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { requireRetellApiKey } from '../middleware/retell-auth.middleware';

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
// WEBHOOK/EXTERNAL API ENDPOINTS (Retell AI)
// ============================================

/**
 * POST /api/platform/webhook/clients
 * Create or update a client from external system (Retell AI, N8N, etc.)
 * Accessible by: External systems with valid API key (X-API-Key header)
 */
router.post('/webhook/clients', requireRetellApiKey, async (req: Request, res: Response) => {
  try {
    const requestData = req.body.args || req.body;

    const {
      tenantId,
      firstName,
      lastName,
      phone,
      email,
      firstInteractionSource,
      status = 'active',
      externalServiceName, // e.g., 'phorest_api'
      externalServiceClientId, // External provider's client ID (e.g., Phorest client ID)
    } = requestData;

    // Validate required fields
    if (!tenantId || !firstName || !lastName || !phone || !firstInteractionSource) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['tenantId', 'firstName', 'lastName', 'phone', 'firstInteractionSource'],
      });
    }

    // Check if client with this phone already exists
    const existingClient = await storage.getClientByPhone(tenantId, phone);
    if (existingClient) {
      // Update existing client with new information if provided
      const updates: any = {};
      if (email && !existingClient.email) updates.email = email;
      if (firstName && !existingClient.firstName) updates.firstName = firstName;
      if (lastName && !existingClient.lastName) updates.lastName = lastName;
      if (externalServiceName && !existingClient.externalServiceName) {
        updates.externalServiceName = externalServiceName;
      }
      if (externalServiceClientId && !existingClient.externalServiceClientId) {
        updates.externalServiceClientId = externalServiceClientId;
      }

      if (Object.keys(updates).length > 0) {
        const updatedClient = await storage.updateClient(existingClient.id, updates);
        return res.status(200).json({
          success: true,
          client: updatedClient,
          message: 'Client updated successfully',
          existed: true,
        });
      }

      return res.status(200).json({
        success: true,
        client: existingClient,
        message: 'Client already exists',
        existed: true,
      });
    }

    // Create new client
    const client = await storage.createClient({
      tenantId,
      firstName,
      lastName,
      phone,
      email,
      firstInteractionSource,
      status,
      externalServiceName,
      externalServiceClientId,
    });

    res.status(201).json({
      success: true,
      client,
      message: 'Client created successfully',
      existed: false,
    });
  } catch (error) {
    console.error('Error creating/updating client via webhook:', error);
    res.status(500).json({ error: 'Failed to process client request' });
  }
});

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
 * Authentication: API Key (X-API-Key header) - for webhook/automation access
 */
router.patch(
  '/:tenantId/bookings/:bookingId',
  requireRetellApiKey,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, bookingId } = req.params;
      const { action, ...updateData } = req.body;

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
 * Authentication: API Key (X-API-Key header)
 */
router.post('/interactions/track', requireRetellApiKey, async (req, res: Response) => {
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
 * Complete booking flow: Create booking + External service integration + mapping
 * Used when: Customer pays deposit, booking is confirmed
 * Authentication: API Key (X-API-Key header)
 */
router.post('/bookings/complete', requireRetellApiKey, async (req, res: Response) => {
  try {
    const {
      tenantId,
      externalServiceName = 'external_service_api', // Default to external_service_api
      externalServiceClientId, // External service client ID (required)
      externalBusinessId, // External service business ID (optional, will lookup internal ID)
      externalBranchId, // External service branch ID (optional, will lookup internal ID)
      serviceName,
      amount,
      currency,
      depositAmount,
      bookingDateTime,
      staffMemberId,
      bookingSource,
      bookingSourceDetails,
      serviceProviderBookingId, // REQUIRED: External booking ID from external service
    } = req.body;

    // Validate required fields
    if (
      !tenantId ||
      !externalServiceClientId ||
      !serviceName ||
      !amount ||
      !bookingDateTime ||
      !bookingSource ||
      !serviceProviderBookingId
    ) {
      return res.status(400).json({
        error:
          'Missing required fields: tenantId, externalServiceClientId, serviceName, amount, bookingDateTime, bookingSource, serviceProviderBookingId',
      });
    }

    // Lookup internal client ID using external service client ID
    const client = await storage.getClientByExternalId(
      tenantId,
      externalServiceName,
      externalServiceClientId,
    );

    if (!client) {
      return res.status(404).json({
        error: 'Client not found. Please create the client first using POST /webhook/clients',
      });
    }

    // Lookup internal business ID if external business ID provided
    let internalBusinessId: string | undefined;
    let businessData: any = null;
    if (externalBusinessId) {
      const business = await storage.getBusinessByExternalId(
        tenantId,
        externalServiceName,
        externalBusinessId,
      );
      if (!business) {
        return res.status(404).json({
          error: `Business not found with external ID: ${externalBusinessId}`,
        });
      }
      internalBusinessId = business.id;
      businessData = {
        id: business.id,
        externalBusinessId: business.externalBusinessId,
        businessName: business.businessName,
      };
    }

    // Lookup internal branch ID if external branch ID provided
    let internalBranchId: string | undefined;
    let branchData: any = null;
    if (externalBranchId && internalBusinessId) {
      const branch = await storage.getBranchByExternalId(
        internalBusinessId,
        externalServiceName,
        externalBranchId, // This is the branch_id which already contains the external ID
      );
      if (!branch) {
        return res.status(404).json({
          error: `Branch not found with external ID: ${externalBranchId}`,
        });
      }
      internalBranchId = branch.id;
      branchData = {
        id: branch.id,
        branchId: branch.branchId, // The external branch ID
        branchName: branch.branchName,
      };
    }

    // Create booking in our system with confirmed status if deposit paid
    const bookingStatus = depositAmount ? 'confirmed' : 'pending';
    const paymentStatus = depositAmount ? 'deposit_paid' : 'awaiting_deposit';

    const booking = await storage.createBooking({
      tenantId,
      clientId: client.id, // Use the internal client ID
      businessId: internalBusinessId, // Use the internal business ID (looked up from external ID)
      branchId: internalBranchId, // Use the internal branch ID (looked up from external ID)
      serviceName,
      amount,
      currency: currency || 'EUR',
      paymentStatus,
      depositAmount,
      bookingDateTime: new Date(bookingDateTime),
      staffMemberId,
      status: bookingStatus,
      serviceProvider: externalServiceName,
      serviceProviderBookingId, // Store external booking ID if provided
      bookingSource,
      bookingSourceDetails,
    });

    // Update booking with confirmation timestamp if deposit paid
    if (depositAmount) {
      await storage.confirmBooking(booking.id, depositAmount);
    }

    // Link any existing payment links to this booking
    // This connects payment links created before the booking
    if (serviceProviderBookingId) {
      await storage.linkPaymentToBooking(serviceProviderBookingId, booking.id, tenantId);
    }

    // Update client's firstBookingDate if this is their first booking
    if (!client.firstBookingDate) {
      await storage.updateClient(client.id, {
        firstBookingDate: booking.bookingDateTime,
      });
    }

    // Update client status to active and set lastBookingDate
    if (client.status === 'lead') {
      await storage.updateClient(client.id, {
        status: 'active',
        lastBookingDate: booking.bookingDateTime,
      });
    } else {
      await storage.updateClient(client.id, {
        lastBookingDate: booking.bookingDateTime,
      });
    }

    res.status(201).json({
      success: true,
      booking,
      client: {
        id: client.id,
        externalServiceClientId: client.externalServiceClientId,
      },
      business: businessData,
      branch: branchData,
      message: 'Booking completed successfully',
    });
  } catch (error) {
    console.error('Error completing booking:', error);
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

export default router;
