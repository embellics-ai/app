/**
 * Proxy Routes
 * Handles proxying of external API requests (WhatsApp, Retell AI, Generic HTTP)
 * Authenticates N8N requests and forwards to external services with encrypted credentials
 */

import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { decrypt, decryptWhatsAppConfig } from '../encryption';

const router = Router();

/**
 * Middleware to validate N8N webhook secret
 * Ensures only authorized N8N instances can call proxy APIs
 */
const validateN8NSecret = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.error('[Proxy] N8N_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Proxy authentication not configured' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (token !== expectedSecret) {
    console.warn('[Proxy] Invalid N8N webhook secret attempted');
    return res.status(401).json({ error: 'Invalid authorization token' });
  }

  next();
};

/**
 * Helper function to get and decrypt WhatsApp access token
 * Fetches from tenant_integrations table
 */
async function getWhatsAppAccessToken(tenantId: string): Promise<string> {
  const integration = await storage.getTenantIntegration(tenantId);

  if (!integration || !integration.whatsappEnabled || !integration.whatsappConfig) {
    throw new Error('WhatsApp integration not configured or disabled');
  }

  // Decrypt the WhatsApp config
  const whatsappConfig = decryptWhatsAppConfig(integration.whatsappConfig as any);

  if (!whatsappConfig || !whatsappConfig.accessToken) {
    throw new Error('WhatsApp access token not found');
  }

  return whatsappConfig.accessToken;
}

/**
 * Helper function to get WhatsApp configuration
 */
async function getWhatsAppConfig(tenantId: string) {
  const integration = await storage.getTenantIntegration(tenantId);

  if (!integration || !integration.whatsappEnabled || !integration.whatsappConfig) {
    throw new Error('WhatsApp integration not configured or disabled');
  }

  const whatsappConfig = decryptWhatsAppConfig(integration.whatsappConfig as any);

  if (!whatsappConfig) {
    throw new Error('WhatsApp configuration not found');
  }

  return whatsappConfig;
}

// ============================================
// WHATSAPP PROXY API ENDPOINTS
// ============================================

/**
 * POST /:tenantId/whatsapp/send
 * Send WhatsApp message
 * Proxies WhatsApp send message requests from N8N
 */
router.post('/:tenantId/whatsapp/send', validateN8NSecret, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const messageData = req.body;

    console.log('[Proxy] WhatsApp send request for tenant:', tenantId);

    // Get decrypted access token from database
    const accessToken = await getWhatsAppAccessToken(tenantId);

    // Get WhatsApp config for phone number ID
    const whatsappConfig = await getWhatsAppConfig(tenantId);
    const phoneNumberId = whatsappConfig.phoneNumberId;

    if (!phoneNumberId) {
      throw new Error('WhatsApp phone number ID not configured');
    }

    // Send message to WhatsApp Business API
    const whatsappUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const response = await fetch(whatsappUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[Proxy] WhatsApp API error:', responseData);
      return res.status(response.status).json({
        error: 'WhatsApp API request failed',
        details: responseData,
      });
    }

    console.log('[Proxy] WhatsApp message sent successfully:', responseData.messages?.[0]?.id);

    res.json(responseData);
  } catch (error) {
    console.error('[Proxy] Error sending WhatsApp message:', error);
    res.status(500).json({
      error: 'Failed to send WhatsApp message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /:tenantId/whatsapp/templates
 * Get WhatsApp message templates
 * Proxies WhatsApp templates request from N8N
 */
router.get(
  '/:tenantId/whatsapp/templates',
  validateN8NSecret,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;

      console.log('[Proxy] WhatsApp templates request for tenant:', tenantId);

      // Get decrypted access token from database
      const accessToken = await getWhatsAppAccessToken(tenantId);

      // Get business account ID from WhatsApp config
      const whatsappConfig = await getWhatsAppConfig(tenantId);
      const businessAccountId = whatsappConfig.businessAccountId;

      if (!businessAccountId) {
        throw new Error('WhatsApp business account ID not configured');
      }

      // Fetch templates from WhatsApp Business API
      const whatsappUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;

      const response = await fetch(whatsappUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[Proxy] WhatsApp API error:', responseData);
        return res.status(response.status).json({
          error: 'WhatsApp API request failed',
          details: responseData,
        });
      }

      console.log(
        '[Proxy] WhatsApp templates fetched successfully:',
        responseData.data?.length || 0,
        'templates',
      );

      res.json(responseData);
    } catch (error) {
      console.error('[Proxy] Error fetching WhatsApp templates:', error);
      res.status(500).json({
        error: 'Failed to fetch WhatsApp templates',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * GET /:tenantId/whatsapp/media/:mediaId
 * Get WhatsApp media (for handling incoming media in webhooks)
 * Proxies WhatsApp media download request from N8N
 */
router.get(
  '/:tenantId/whatsapp/media/:mediaId',
  validateN8NSecret,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, mediaId } = req.params;

      // Validate mediaId to prevent SSRF attacks (must be alphanumeric with dashes/underscores)
      if (!/^[A-Za-z0-9_-]+$/.test(mediaId)) {
        return res.status(400).json({
          error: 'Invalid media ID format',
        });
      }

      console.log('[Proxy] WhatsApp media request for tenant:', tenantId, 'media:', mediaId);

      // Get decrypted access token from database
      const accessToken = await getWhatsAppAccessToken(tenantId);

      // Fetch media URL from WhatsApp Business API
      const whatsappUrl = `https://graph.facebook.com/v21.0/${mediaId}`;

      const response = await fetch(whatsappUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[Proxy] WhatsApp API error:', responseData);
        return res.status(response.status).json({
          error: 'WhatsApp API request failed',
          details: responseData,
        });
      }

      console.log('[Proxy] WhatsApp media URL fetched successfully');

      res.json(responseData);
    } catch (error) {
      console.error('[Proxy] Error fetching WhatsApp media:', error);
      res.status(500).json({
        error: 'Failed to fetch WhatsApp media',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * GET /:tenantId/whatsapp/test
 * Test WhatsApp connection
 * Tests WhatsApp connection by fetching phone number info
 */
router.get('/:tenantId/whatsapp/test', validateN8NSecret, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    console.log('[Proxy] WhatsApp connection test for tenant:', tenantId);

    // Get decrypted access token from database
    const accessToken = await getWhatsAppAccessToken(tenantId);

    // Get phone number ID from WhatsApp config
    const whatsappConfig = await getWhatsAppConfig(tenantId);
    const phoneNumberId = whatsappConfig.phoneNumberId;

    if (!phoneNumberId) {
      throw new Error('WhatsApp phone number ID not configured');
    }

    // Fetch phone number info from WhatsApp Business API
    const whatsappUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}`;

    const response = await fetch(whatsappUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[Proxy] WhatsApp API error:', responseData);
      return res.status(response.status).json({
        error: 'WhatsApp API request failed',
        details: responseData,
        connected: false,
      });
    }

    console.log('[Proxy] WhatsApp connection test successful');

    res.json({
      connected: true,
      phoneNumber: responseData.display_phone_number,
      verifiedName: responseData.verified_name,
      quality: responseData.quality_rating,
    });
  } catch (error) {
    console.error('[Proxy] Error testing WhatsApp connection:', error);
    res.status(500).json({
      connected: false,
      error: 'Failed to test WhatsApp connection',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// RETELL AI PROXY API ENDPOINTS
// ============================================

/**
 * Helper function to get and decrypt Retell API key
 */
async function getRetellApiKey(tenantId: string): Promise<string> {
  const widgetConfig = await storage.getWidgetConfig(tenantId);

  if (!widgetConfig || !widgetConfig.retellApiKey) {
    throw new Error('Retell API key not found or inactive');
  }

  return widgetConfig.retellApiKey; // Already decrypted by storage layer
}

/**
 * POST /:tenantId/retell/create-chat
 * Retell AI API Proxy - Create Chat
 * Proxies Retell AI create chat requests from N8N
 */
router.post(
  '/:tenantId/retell/create-chat',
  validateN8NSecret,
  async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.params;
      const requestData = req.body;

      console.log('[Proxy] Retell create-chat request for tenant:', tenantId);

      // Get decrypted Retell API key from database
      const apiKey = await getRetellApiKey(tenantId);

      // Call Retell AI API
      const retellUrl = 'https://api.retellai.com/create-chat';

      const response = await fetch(retellUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[Proxy] Retell API error:', responseData);
        return res.status(response.status).json({
          error: 'Retell API request failed',
          details: responseData,
        });
      }

      console.log('[Proxy] Retell chat created successfully:', responseData.chat_id);

      res.json(responseData);
    } catch (error) {
      console.error('[Proxy] Error creating Retell chat:', error);
      res.status(500).json({
        error: 'Failed to create Retell chat',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * POST /:tenantId/retell/:endpoint(*)
 * Retell AI API Proxy - Generic endpoint
 * Proxies any Retell AI API request from N8N
 */
router.post(
  '/:tenantId/retell/:endpoint(*)',
  validateN8NSecret,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, endpoint } = req.params;
      const requestData = req.body;

      console.log(`[Proxy] Retell API request for tenant: ${tenantId}, endpoint: ${endpoint}`);

      // Get decrypted Retell API key from database
      const apiKey = await getRetellApiKey(tenantId);

      // Call Retell AI API
      const retellUrl = `https://api.retellai.com/${endpoint}`;

      const response = await fetch(retellUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('[Proxy] Retell API error:', responseData);
        return res.status(response.status).json({
          error: 'Retell API request failed',
          details: responseData,
        });
      }

      console.log(`[Proxy] Retell API ${endpoint} successful`);

      res.json(responseData);
    } catch (error) {
      console.error('[Proxy] Error calling Retell API:', error);
      res.status(500).json({
        error: 'Failed to call Retell API',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// ============================================
// GENERIC HTTP PROXY API ENDPOINTS
// ============================================

/**
 * ALL /:tenantId/http/:serviceName/:endpoint(*)
 * Generic HTTP Proxy
 * Proxies ANY external API request from N8N using UI-configured credentials
 * Supports: GET, POST, PUT, PATCH, DELETE
 * Examples: Google Calendar, Stripe, SendGrid, Custom CRM APIs, etc.
 *
 * Supported auth types:
 * - bearer: Bearer token in Authorization header
 * - api_key: API key in custom header (e.g., X-API-Key)
 * - basic: Basic authentication (username:password)
 * - oauth2: OAuth2 access token (future: auto-refresh)
 * - custom_header: Any custom header (e.g., X-Custom-Auth)
 * - none: No authentication
 */
router.all(
  '/:tenantId/http/:serviceName/:endpoint(*)',
  validateN8NSecret,
  async (req: Request, res: Response) => {
    try {
      const { tenantId, serviceName, endpoint } = req.params;
      const requestData = req.body;
      const httpMethod = req.method; // GET, POST, PUT, PATCH, DELETE, etc.

      console.log(
        `[Proxy] ${httpMethod} request for tenant: ${tenantId}, service: ${serviceName}, endpoint: ${endpoint}`,
      );

      // Get external API configuration from database
      const apiConfig = await storage.getExternalApiConfig(tenantId, serviceName);

      if (!apiConfig || !apiConfig.isActive) {
        console.error('[Proxy] External API configuration not found or inactive:', serviceName);
        return res.status(404).json({
          error: 'External API configuration not found',
          message: `Service '${serviceName}' is not configured for this tenant`,
        });
      }

      // Construct full URL
      const baseUrl = apiConfig.baseUrl.endsWith('/')
        ? apiConfig.baseUrl.slice(0, -1)
        : apiConfig.baseUrl;
      const endpointPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      
      // Preserve query parameters from the original request
      const queryString = Object.keys(req.query).length > 0 
        ? '?' + new URLSearchParams(req.query as any).toString()
        : '';
      
      const fullUrl = `${baseUrl}${endpointPath}${queryString}`;

      console.log(`[Proxy] Calling external API: ${fullUrl}`);
      console.log(`[Proxy] Query parameters:`, req.query);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication headers based on authType
      if (apiConfig.encryptedCredentials) {
        const credentials = JSON.parse(decrypt(apiConfig.encryptedCredentials));

        switch (apiConfig.authType) {
          case 'bearer':
            if (credentials.token) {
              headers['Authorization'] = `Bearer ${credentials.token}`;
            }
            break;

          case 'api_key':
            if (credentials.key && credentials.headerName) {
              headers[credentials.headerName] = credentials.key;
            }
            break;

          case 'basic':
            if (credentials.username && credentials.password) {
              const encodedAuth = Buffer.from(
                `${credentials.username}:${credentials.password}`,
              ).toString('base64');
              headers['Authorization'] = `Basic ${encodedAuth}`;
            }
            break;

          case 'oauth2':
            if (credentials.accessToken) {
              headers['Authorization'] = `Bearer ${credentials.accessToken}`;
              // TODO: Check expiry and refresh if needed
            }
            break;

          case 'custom_header':
            if (credentials.headerName && credentials.headerValue) {
              headers[credentials.headerName] = credentials.headerValue;
            }
            break;

          case 'none':
            // No authentication
            break;

          default:
            console.warn('[Proxy] Unknown auth type:', apiConfig.authType);
        }
      }

      // Add custom headers from configuration
      if (apiConfig.customHeaders) {
        Object.entries(apiConfig.customHeaders as Record<string, string>).forEach(
          ([key, value]) => {
            headers[key] = value;
          },
        );
      }

      // Forward request to external API with the same HTTP method
      const fetchOptions: RequestInit = {
        method: httpMethod,
        headers,
      };

      // Only include body for methods that support it (not GET or HEAD)
      if (httpMethod !== 'GET' && httpMethod !== 'HEAD' && requestData) {
        fetchOptions.body = JSON.stringify(requestData);
      }

      console.log(`[Proxy] Calling ${httpMethod} ${fullUrl}`);

      const response = await fetch(fullUrl, fetchOptions);

      const responseData = await response.json();

      // Update usage statistics
      await storage.incrementExternalApiStats(apiConfig.id, response.ok);

      if (!response.ok) {
        console.error('[Proxy] External API error:', responseData);
        return res.status(response.status).json({
          error: 'External API request failed',
          details: responseData,
          service: serviceName,
        });
      }

      console.log(`[Proxy] External API call successful: ${serviceName}/${endpoint}`);

      res.json(responseData);
    } catch (error) {
      console.error('[Proxy] Error calling external API:', error);
      res.status(500).json({
        error: 'Failed to call external API',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

// ===== WhatsApp Webhook Endpoints =====

/**
 * WhatsApp Webhook Verification (GET)
 * Meta will call this endpoint to verify the webhook
 *
 * GET /api/whatsapp/webhook
 */
router.get('/webhook', async (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[WhatsApp Webhook] Verification request:', {
      mode,
      token: token ? '***' : undefined,
    });

    // Check if a token and mode were sent
    if (mode === 'subscribe' && token) {
      // Verify token matches (you should set WHATSAPP_VERIFY_TOKEN in env)
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'embellics_whatsapp_verify_2025';

      if (token === verifyToken) {
        console.log('[WhatsApp Webhook] Verification successful');
        return res.status(200).send(challenge);
      } else {
        console.error('[WhatsApp Webhook] Verification failed - token mismatch');
        return res.status(403).send('Verification token mismatch');
      }
    }

    res.status(403).send('Missing verification parameters');
  } catch (error) {
    console.error('[WhatsApp Webhook] Verification error:', error);
    res.status(500).send('Verification failed');
  }
});

/**
 * WhatsApp Webhook Handler (POST)
 * Receives messages from Meta WhatsApp Business API
 * Routes to appropriate tenant's N8N workflow
 *
 * POST /api/whatsapp/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    console.log('[WhatsApp Webhook] Received webhook:', JSON.stringify(req.body, null, 2));

    // Meta expects immediate 200 response
    res.status(200).send('EVENT_RECEIVED');

    const { entry } = req.body;
    if (!entry || !Array.isArray(entry)) {
      console.log('[WhatsApp Webhook] No entry data in webhook');
      return;
    }

    // Process each entry
    for (const item of entry) {
      const changes = item.changes;
      if (!changes || !Array.isArray(changes)) continue;

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const metadata = value?.metadata;
        const messages = value?.messages;

        if (!metadata || !messages) continue;

        // Extract phone number ID to identify tenant
        const phoneNumberId = metadata.phone_number_id;
        const displayPhoneNumber = metadata.display_phone_number;

        console.log(
          '[WhatsApp Webhook] Message from phone:',
          displayPhoneNumber,
          'ID:',
          phoneNumberId,
        );

        // Find tenant by phone number ID
        const tenants = await storage.getAllTenants();
        let targetTenant = null;

        for (const tenant of tenants) {
          const integration = await storage.getTenantIntegration(tenant.id);
          if (!integration?.whatsappConfig) continue;

          const config = integration.whatsappConfig as any;
          if (config.phoneNumberId === phoneNumberId) {
            targetTenant = tenant;
            break;
          }
        }

        if (!targetTenant) {
          console.error('[WhatsApp Webhook] No tenant found for phone number ID:', phoneNumberId);
          continue;
        }

        console.log('[WhatsApp Webhook] Routing to tenant:', targetTenant.name, targetTenant.id);

        // Get tenant's N8N webhook configured for WhatsApp messages
        const webhooks = await storage.getWebhooksByEvent(targetTenant.id, 'whatsapp_message');

        if (webhooks.length === 0) {
          console.log('[WhatsApp Webhook] No N8N webhook configured for tenant:', targetTenant.id);
          continue;
        }

        // Forward to each configured N8N webhook
        for (const webhook of webhooks) {
          if (!webhook.isActive) continue;

          console.log('[WhatsApp Webhook] Forwarding to N8N:', webhook.webhookUrl);

          try {
            const n8nResponse = await fetch(webhook.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tenantId: targetTenant.id,
                tenantName: targetTenant.name,
                phoneNumberId,
                displayPhoneNumber,
                messages: value.messages,
                contacts: value.contacts,
                metadata: value.metadata,
                statuses: value.statuses,
                originalPayload: req.body,
              }),
            });

            if (n8nResponse.ok) {
              console.log('[WhatsApp Webhook] Successfully forwarded to N8N');
              await storage.incrementWebhookStats(webhook.id, true);
            } else {
              console.error('[WhatsApp Webhook] N8N webhook failed:', n8nResponse.status);
              await storage.incrementWebhookStats(webhook.id, false);
            }
          } catch (webhookError) {
            console.error('[WhatsApp Webhook] Error forwarding to N8N:', webhookError);
            await storage.incrementWebhookStats(webhook.id, false);
          }
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Webhook] Processing error:', error);
    // Don't send error response - Meta already got 200 OK
  }
});

export default router;
