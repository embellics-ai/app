/**
 * Widget Test Routes
 * Platform admin widget testing with temporary tokens
 */

import { Router, Response } from 'express';
import { storage } from '../storage';
import {
  type AuthenticatedRequest,
  requireAuth,
  requirePlatformAdmin,
} from '../middleware/auth.middleware';
import { randomBytes } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { widgetTestTokens } from './widget.routes';

const router = Router();

// Helper function to escape strings for JavaScript injection
function escapeJsString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * GET /widget-test-page (mounted at /api/platform)
 * Serve widget test page HTML for platform admins
 * Uses temporary 1-hour test tokens for widget authentication
 */
router.get(
  '/widget-test-page',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).send('Tenant ID is required. Please select a tenant to test.');
      }

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId as string);

      if (!tenant) {
        return res.status(404).send('Tenant not found');
      }

      // Get widget configuration for this tenant
      const widgetConfig = await storage.getWidgetConfig(tenantId as string);

      if (!widgetConfig || !widgetConfig.retellAgentId) {
        return res.status(400).send(`
          <html>
            <head><title>Widget Not Configured</title></head>
            <body style="font-family: system-ui; padding: 40px; text-align: center;">
              <h1>⚠️ Widget Not Configured</h1>
              <p>The tenant "${tenant.name}" does not have a widget configured.</p>
              <p>Please configure the Retell Agent ID in the Platform Admin panel first.</p>
              <a href="/widget-test" style="color: #667eea;">← Back to Widget Test</a>
            </body>
          </html>
        `);
      }

      // Read widget-test.html from client/public
      const htmlPath = path.join(process.cwd(), 'client', 'public', 'widget-test.html');
      let htmlContent = await fs.readFile(htmlPath, 'utf-8');

      // Generate a one-time test token for platform admin widget testing
      // This token will be valid for this specific test session (expires in 1 hour)
      const testToken = `test_${randomBytes(32).toString('hex')}`;

      // Store the test token in module-level Map (exported from widget.routes.ts)
      widgetTestTokens.set(testToken, {
        tenantId: tenantId as string,
        createdAt: new Date(),
        createdBy: req.user?.email,
      });

      // Clean up old tokens (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      Array.from(widgetTestTokens.entries()).forEach(([token, data]) => {
        if (data.createdAt < oneHourAgo) {
          widgetTestTokens.delete(token);
        }
      });

      // Inject tenant information and widget script into HTML
      // Use X-Forwarded-Proto if available (for proxies/load balancers like Render)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const widgetScriptUrl = `${protocol}://${req.get('host')}/widget.js`;
      const tenantInfo = `
        <script>
          // Tenant configuration
          window.WIDGET_TEST_CONFIG = {
            tenantId: '${tenantId}',
            tenantName: '${escapeJsString(tenant.name)}',
            agentId: '${widgetConfig.retellAgentId}',
            testMode: true,
          };
          
          // Update page with tenant info
          document.addEventListener('DOMContentLoaded', () => {
            const tenantNameEl = document.getElementById('tenant-name');
            const agentIdEl = document.getElementById('agent-id');
            
            if (tenantNameEl) tenantNameEl.textContent = '${escapeJsString(tenant.name)}';
            if (agentIdEl) agentIdEl.textContent = '${widgetConfig.retellAgentId}';
            
            // Update status after widget loads
            setTimeout(() => {
              const statusEl = document.getElementById('widget-status');
              if (statusEl) {
                statusEl.textContent = '✅ Widget loaded successfully! Look for the chat bubble in the bottom-right corner.';
                statusEl.style.color = '#28a745';
              }
            }, 1000);
          });
        </script>
        
        <!-- Embellics Chat Widget with temporary test token -->
        <script src="${widgetScriptUrl}" data-api-key="${testToken}"></script>
      `;

      // Insert tenant info and scripts before closing </body> tag
      htmlContent = htmlContent.replace('</body>', `${tenantInfo}</body>`);

      // Log access for security audit
      console.log(
        `[Widget Test] Platform admin ${req.user?.email} accessed widget test page for tenant: ${tenant.name} (${tenantId})`,
      );

      // Send HTML with proper content type
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    } catch (error) {
      console.error('[Widget Test] Error serving widget test page:', error);
      res.status(500).json({ error: 'Failed to load widget test page' });
    }
  },
);

export default router;
