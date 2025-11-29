import { storage } from '../storage';
import { decrypt } from '../encryption';

/**
 * Webhook Service
 * Handles calling N8N webhooks with retry logic and analytics tracking
 */

export interface WebhookCallOptions {
  webhookId: string;
  payload: any;
  timeout?: number; // milliseconds, default 30000 (30s)
  maxRetries?: number; // default 3
  retryDelay?: number; // milliseconds between retries, default 1000
}

export interface WebhookCallResult {
  success: boolean;
  statusCode?: number;
  responseBody?: any;
  responseTime: number; // milliseconds
  errorMessage?: string;
  attemptNumber: number;
}

/**
 * Call an N8N webhook with retry logic and analytics tracking
 */
export async function callWebhook(options: WebhookCallOptions): Promise<WebhookCallResult> {
  const { webhookId, payload, timeout = 30000, maxRetries = 3, retryDelay = 1000 } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;
  let attemptNumber = 0;

  // Get webhook details
  const webhook = await storage.getN8nWebhook(webhookId);
  if (!webhook) {
    const result: WebhookCallResult = {
      success: false,
      responseTime: Date.now() - startTime,
      errorMessage: `Webhook not found: ${webhookId}`,
      attemptNumber: 0,
    };

    // Log analytics
    await logWebhookAnalytics(webhookId, payload, result);

    return result;
  }

  // Check if webhook is active
  if (!webhook.isActive) {
    const result: WebhookCallResult = {
      success: false,
      responseTime: Date.now() - startTime,
      errorMessage: `Webhook is disabled: ${webhook.workflowName}`,
      attemptNumber: 0,
    };

    // Log analytics
    await logWebhookAnalytics(webhookId, payload, result);

    return result;
  }

  // Decrypt auth token if present
  let authToken: string | null = null;
  if (webhook.authToken) {
    try {
      authToken = decrypt(webhook.authToken);
    } catch (error) {
      console.error('[Webhook Service] Failed to decrypt auth token:', error);
    }
  }

  // Retry loop
  for (attemptNumber = 1; attemptNumber <= maxRetries; attemptNumber++) {
    try {
      const callStartTime = Date.now();

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Make HTTP request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - callStartTime;

      // Parse response
      let responseBody: any;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      // Check if successful
      const success = response.ok; // 200-299 status codes

      const result: WebhookCallResult = {
        success,
        statusCode: response.status,
        responseBody,
        responseTime,
        errorMessage: success ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        attemptNumber,
      };

      // Update webhook stats
      await storage.incrementWebhookStats(webhookId, success);

      // Log analytics
      await logWebhookAnalytics(webhookId, payload, result);

      // Return immediately if successful
      if (success) {
        return result;
      }

      // Store error for retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        console.log(
          `[Webhook Service] Not retrying webhook ${webhook.workflowName} - client error ${response.status}`,
        );
        return result;
      }

      // Retry on 5xx errors (server errors)
      if (attemptNumber < maxRetries) {
        console.log(
          `[Webhook Service] Retrying webhook ${webhook.workflowName} (attempt ${attemptNumber + 1}/${maxRetries}) after ${retryDelay}ms`,
        );
        await sleep(retryDelay * attemptNumber); // Exponential backoff
      }
    } catch (error: any) {
      lastError = error;
      const responseTime = Date.now() - startTime;

      // Handle timeout
      if (error.name === 'AbortError') {
        const result: WebhookCallResult = {
          success: false,
          responseTime,
          errorMessage: `Request timeout after ${timeout}ms`,
          attemptNumber,
        };

        // Log analytics
        await logWebhookAnalytics(webhookId, payload, result);

        // Update stats
        await storage.incrementWebhookStats(webhookId, false);

        // Retry on timeout
        if (attemptNumber < maxRetries) {
          console.log(
            `[Webhook Service] Retrying webhook ${webhook.workflowName} after timeout (attempt ${attemptNumber + 1}/${maxRetries})`,
          );
          await sleep(retryDelay * attemptNumber);
          continue;
        }

        return result;
      }

      // Handle network errors
      const result: WebhookCallResult = {
        success: false,
        responseTime,
        errorMessage: error.message || 'Network error',
        attemptNumber,
      };

      // Log analytics
      await logWebhookAnalytics(webhookId, payload, result);

      // Update stats
      await storage.incrementWebhookStats(webhookId, false);

      // Retry on network errors
      if (attemptNumber < maxRetries) {
        console.log(
          `[Webhook Service] Retrying webhook ${webhook.workflowName} after network error (attempt ${attemptNumber + 1}/${maxRetries})`,
        );
        await sleep(retryDelay * attemptNumber);
        continue;
      }

      return result;
    }
  }

  // All retries exhausted
  const result: WebhookCallResult = {
    success: false,
    responseTime: Date.now() - startTime,
    errorMessage: lastError?.message || 'All retries exhausted',
    attemptNumber: maxRetries,
  };

  return result;
}

/**
 * Call webhook by workflow name and tenant ID
 */
export async function callWebhookByName(
  tenantId: string,
  workflowName: string,
  payload: any,
  options?: Partial<WebhookCallOptions>,
): Promise<WebhookCallResult> {
  const webhook = await storage.getN8nWebhookByName(tenantId, workflowName);

  if (!webhook) {
    return {
      success: false,
      responseTime: 0,
      errorMessage: `Webhook not found: ${workflowName} for tenant ${tenantId}`,
      attemptNumber: 0,
    };
  }

  return callWebhook({
    webhookId: webhook.id,
    payload,
    ...options,
  });
}

/**
 * Call all active webhooks for a tenant
 */
export async function callAllTenantWebhooks(
  tenantId: string,
  payload: any,
  options?: Partial<WebhookCallOptions>,
): Promise<WebhookCallResult[]> {
  const webhooks = await storage.getActiveN8nWebhooks(tenantId);

  // Call all webhooks in parallel
  const results = await Promise.all(
    webhooks.map((webhook) =>
      callWebhook({
        webhookId: webhook.id,
        payload,
        ...options,
      }),
    ),
  );

  return results;
}

/**
 * Log webhook call to analytics table
 */
async function logWebhookAnalytics(
  webhookId: string,
  requestPayload: any,
  result: WebhookCallResult,
): Promise<void> {
  try {
    // Get webhook to get tenantId
    const webhook = await storage.getN8nWebhook(webhookId);
    if (!webhook) {
      console.error('[Webhook Service] Webhook not found for analytics:', webhookId);
      return;
    }

    await storage.createWebhookAnalytics({
      webhookId,
      tenantId: webhook.tenantId,
      requestPayload,
      responseBody: result.responseBody || null,
      statusCode: result.statusCode || null,
      responseTime: result.responseTime,
      success: result.success,
      errorMessage: result.errorMessage || null,
    });
  } catch (error) {
    console.error('[Webhook Service] Failed to log analytics:', error);
    // Don't throw - analytics logging should not break the main flow
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test webhook connectivity (without logging analytics)
 */
export async function testWebhook(webhookId: string): Promise<{
  success: boolean;
  responseTime: number;
  errorMessage?: string;
}> {
  const startTime = Date.now();

  try {
    const webhook = await storage.getN8nWebhook(webhookId);

    if (!webhook) {
      return {
        success: false,
        responseTime: 0,
        errorMessage: 'Webhook not found',
      };
    }

    // Decrypt auth token if present
    let authToken: string | null = null;
    if (webhook.authToken) {
      try {
        authToken = decrypt(webhook.authToken);
      } catch (error) {
        console.error('[Webhook Service] Failed to decrypt auth token:', error);
      }
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Make test request with minimal payload
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for test

    const response = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ test: true, timestamp: new Date().toISOString() }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        responseTime,
      };
    }

    return {
      success: false,
      responseTime,
      errorMessage: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    if (error.name === 'AbortError') {
      return {
        success: false,
        responseTime,
        errorMessage: 'Request timeout after 5 seconds',
      };
    }

    return {
      success: false,
      responseTime,
      errorMessage: error.message || 'Network error',
    };
  }
}
