/**
 * Public Tenant Lookup Route
 *
 * Standalone endpoint for external integrations to lookup tenant information.
 * Requires API key authentication for security.
 * This MUST be registered BEFORE authenticated tenant routes to avoid auth middleware.
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { requireRetellApiKey } from '../middleware/retell-auth.middleware';

const router = Router();

/**
 * GET /api/lookup/tenant
 * Look up tenant details by business name or email
 *
 * AUTHENTICATION REQUIRED: X-API-Key header must be provided
 *
 * For external integrations like Retell AI agents, voice systems, and future integrations.
 *
 * Headers:
 * - X-API-Key: API key for authentication (required)
 *
 * Query params:
 * - name: Business/tenant name (case-insensitive)
 * - email: Tenant email
 *
 * Example: GET /api/lookup/tenant?name=SWC
 */
router.get('/tenant', requireRetellApiKey, async (req: Request, res: Response) => {
  try {
    const tenantName = req.query.name as string | undefined;
    const tenantEmail = req.query.email as string | undefined;

    if (!tenantName && !tenantEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Provide either ?name=TenantName or ?email=tenant@example.com',
      });
    }

    console.log('[Public Tenant Lookup] Request:', { tenantName, tenantEmail });

    let tenant;

    if (tenantEmail) {
      tenant = await storage.getTenantByEmail(tenantEmail);
    } else if (tenantName) {
      // Search by name (case-insensitive)
      const allTenants = await storage.getAllTenants();
      tenant = allTenants.find((t) => t.name.toLowerCase() === tenantName.toLowerCase());
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: tenantName
          ? `No tenant found with name: ${tenantName}`
          : `No tenant found with email: ${tenantEmail}`,
      });
    }

    console.log('[Public Tenant Lookup] Tenant found:', tenant.id, tenant.name);

    // Fetch businesses and branches for this tenant
    const businesses = await storage.getTenantBusinessesByTenant(tenant.id);

    // Fetch branches for each business
    const businessesWithBranches = await Promise.all(
      businesses.map(async (business) => {
        const branches = await storage.getTenantBranchesByBusiness(business.id);
        return {
          serviceName: business.serviceName,
          businessId: business.businessId,
          businessName: business.businessName,
          branches: branches.map((branch) => ({
            branchId: branch.branchId,
            branchName: branch.branchName,
            isPrimary: branch.isPrimary,
            isActive: branch.isActive,
          })),
        };
      }),
    );

    res.json({
      success: true,
      tenant: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantEmail: tenant.email,
        businesses: businessesWithBranches,
      },
    });
  } catch (error) {
    console.error('[Public Tenant Lookup] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to lookup tenant',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
