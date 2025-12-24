/**
 * Retell AI Authentication Middleware
 *
 * Authenticates external API calls from Retell AI voice agents.
 * Requires a custom API key to be sent in the X-API-Key header.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to authenticate external API calls from Retell AI
 * Checks for a custom API key in the request headers
 *
 * Usage:
 *   router.get('/endpoint', requireRetellApiKey, async (req, res) => { ... });
 *
 * Retell AI Configuration:
 *   Add to tool headers: { "X-API-Key": "your-key-from-env" }
 */
export function requireRetellApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.RETELL_INTEGRATION_API_KEY;

  // Check if API key is configured in environment
  if (!expectedApiKey) {
    console.error('[Retell Auth] ❌ RETELL_INTEGRATION_API_KEY not set in environment variables');
    res.status(500).json({
      success: false,
      error: 'Server configuration error',
      message: 'Authentication system not properly configured',
    });
    return;
  }

  // Check if API key was provided in request
  if (!apiKey) {
    console.log('[Retell Auth] ❌ Missing API key in request');
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'API key missing. Include X-API-Key header.',
    });
    return;
  }

  // Validate the API key
  if (apiKey !== expectedApiKey) {
    console.log('[Retell Auth] ❌ Invalid API key provided:', {
      providedKey: apiKey.substring(0, 8) + '...', // Log first 8 chars only
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not valid',
    });
    return;
  }

  // Success - log and continue
  console.log('[Retell Auth] ✓ API key validated successfully');
  next();
}
