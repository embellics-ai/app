import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { phorestService } from '../services/phorest';
import { PhorestServiceError, PhorestClientExistsError } from '../services/phorest/errors';
import { requireAuth, requirePlatformAdmin, type AuthenticatedRequest } from '../auth';

const router = Router();

/**
 * Create Client Request Schema
 * Validates incoming requests for client creation
 */
const createClientSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  mobile: z.string().min(1, 'Mobile number is required'),
  email: z.string().email('Invalid email format'),
});

/**
 * POST /api/phorest/clients
 * Create a new client in Phorest
 *
 * Creates a new client in the Phorest salon management system.
 * This endpoint can be called from any channel (Widget, Voice, WhatsApp, n8n workflows).
 *
 * Phone numbers are automatically formatted to Irish format (+353XXXXXXXXX)
 */
router.post('/clients', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = createClientSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { tenantId, firstName, lastName, mobile, email } = validationResult.data;

    console.log('[Phorest API] Creating client:', {
      tenantId,
      firstName,
      lastName,
      email,
    });

    // Call Phorest service to create client
    const client = await phorestService.createClient({
      tenantId,
      firstName,
      lastName,
      mobile,
      email,
    });

    console.log('[Phorest API] Client created successfully:', {
      clientId: client.clientId,
      email: client.email,
    });

    return res.status(201).json({
      success: true,
      client,
    });
  } catch (error) {
    console.error('[Phorest API] Error creating client:', error);

    // Handle Phorest-specific errors
    if (error instanceof PhorestClientExistsError) {
      return res.status(409).json({
        success: false,
        error: 'Client already exists',
        message: error.message,
        details: error.details,
      });
    }

    if (error instanceof PhorestServiceError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.name,
        message: error.message,
        details: error.details,
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * GET /api/phorest/health
 * Health check for Phorest service
 * Returns the operational status of the Phorest integration service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      service: 'phorest',
      status: 'operational',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      service: 'phorest',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/phorest/config/check
 * Check Phorest configuration for a tenant
 *
 * Diagnostic endpoint to check if a tenant has Phorest properly configured.
 * Returns configuration status, business info, and what's missing.
 *
 * ACCESS CONTROL: Platform Admin only
 * Query params: tenantId (required)
 */
router.get(
  '/config/check',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.query.tenantId as string;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId query parameter is required',
        });
      }

      // Check for API configuration
      let hasApiConfig = false;
      let apiConfigDetails = null;
      try {
        const config = await phorestService['getPhorestConfig'](tenantId);
        hasApiConfig = !!config;
        apiConfigDetails = config ? { baseUrl: config.baseUrl } : null;
      } catch (error) {
        hasApiConfig = false;
      }

      // Check for business configuration
      let hasBusiness = false;
      let businessDetails = null;
      try {
        const business = await phorestService['getTenantBusiness'](tenantId);
        hasBusiness = !!business;
        businessDetails = business
          ? {
              businessId: business.businessId,
              businessName: business.businessName,
            }
          : null;
      } catch (error) {
        hasBusiness = false;
      }

      const configured = hasApiConfig && hasBusiness;

      let message = '';
      if (configured) {
        message = '✅ Phorest is fully configured for this tenant';
      } else if (!hasApiConfig && !hasBusiness) {
        message = '❌ Missing both API credentials and business configuration';
      } else if (!hasApiConfig) {
        message = '❌ Missing API credentials in external_api_configs table';
      } else {
        message = '❌ Missing business configuration in tenant_businesses table';
      }

      return res.status(200).json({
        success: true,
        tenantId,
        configured,
        details: {
          hasApiConfig,
          apiConfig: apiConfigDetails,
          hasBusiness,
          business: businessDetails,
        },
        message,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

export default router;
