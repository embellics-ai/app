/**
 * Phorest Service
 *
 * Main service class for interacting with Phorest API.
 * Handles client creation with automatic credential retrieval
 * and tenant/business context population.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import { externalApiConfigs, tenantBusinesses } from '../../../shared/schema';
import {
  CreateClientRequest,
  CreateClientResponse,
  PhorestCredentials,
  ExternalApiConfig,
  TenantBusiness,
  createClientRequestSchema,
} from './types';
import {
  PhorestServiceError,
  PhorestAuthError,
  PhorestApiError,
  PhorestConfigError,
  PhorestClientExistsError,
  PhorestNetworkError,
} from './errors';
import {
  decryptPhorestCredentials,
  formatPhoneNumber,
  validateEmail,
  validateName,
  sanitizeInput,
  buildPhorestApiUrl,
  logServiceActivity,
} from './utils';

/**
 * Phorest Service Class
 */
export class PhorestService {
  private db: ReturnType<typeof drizzle>;
  private httpClient: AxiosInstance;

  constructor(databaseUrl?: string) {
    // Initialize database connection
    const pool = new Pool({
      connectionString: databaseUrl || process.env.DATABASE_URL,
    });
    this.db = drizzle(pool);

    // Initialize HTTP client with default config
    this.httpClient = axios.create({
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get Phorest configuration for a tenant
   *
   * @param tenantId - Tenant ID
   * @returns External API config
   * @throws PhorestConfigError if config not found
   */
  private async getPhorestConfig(tenantId: string): Promise<ExternalApiConfig> {
    logServiceActivity('info', 'Retrieving Phorest config', { tenantId });

    const configs = await this.db
      .select()
      .from(externalApiConfigs)
      .where(
        and(
          eq(externalApiConfigs.tenantId, tenantId),
          eq(externalApiConfigs.serviceName, 'phorest_api'),
        ),
      );

    if (!configs || configs.length === 0) {
      throw new PhorestConfigError('Phorest API configuration not found for tenant', { tenantId });
    }

    const config = configs[0];

    if (!config.isActive) {
      throw new PhorestConfigError('Phorest API configuration is not active', { tenantId });
    }

    if (!config.baseUrl) {
      throw new PhorestConfigError('Phorest API base URL not configured', { tenantId });
    }

    return config as ExternalApiConfig;
  }

  /**
   * Get tenant ID from business ID
   *
   * @param businessId - Business ID
   * @returns Tenant ID
   * @throws PhorestConfigError if business not found
   */
  private async getTenantIdFromBusinessId(businessId: string): Promise<string> {
    logServiceActivity('info', 'Looking up tenant ID from business ID', { businessId });

    const businesses = await this.db
      .select()
      .from(tenantBusinesses)
      .where(
        and(
          eq(tenantBusinesses.businessId, businessId),
          eq(tenantBusinesses.serviceName, 'phorest_api'),
        ),
      );

    if (!businesses || businesses.length === 0) {
      throw new PhorestConfigError('Business ID not found in system', { businessId });
    }

    return businesses[0].tenantId;
  }

  /**
   * Get tenant's business ID for Phorest
   *
   * @param tenantId - Tenant ID
   * @returns Tenant business record
   * @throws PhorestConfigError if business not found
   */
  private async getTenantBusiness(tenantId: string): Promise<TenantBusiness> {
    logServiceActivity('info', 'Retrieving tenant business', { tenantId });

    const businesses = await this.db
      .select()
      .from(tenantBusinesses)
      .where(
        and(
          eq(tenantBusinesses.tenantId, tenantId),
          eq(tenantBusinesses.serviceName, 'phorest_api'),
        ),
      );

    if (!businesses || businesses.length === 0) {
      throw new PhorestConfigError('Phorest business not configured for tenant', { tenantId });
    }

    return businesses[0] as TenantBusiness;
  }

  /**
   * Create a new client in Phorest
   *
   * @param request - Create client request with businessId and client details
   * @returns Created client with clientId from Phorest
   * @throws Various PhorestError types based on failure reason
   */
  async createClient(request: CreateClientRequest): Promise<CreateClientResponse> {
    try {
      // Sanitize inputs
      const sanitizedRequest = {
        businessId: sanitizeInput(request.businessId),
        firstName: sanitizeInput(request.firstName),
        lastName: sanitizeInput(request.lastName),
        mobile: sanitizeInput(request.mobile),
        email: sanitizeInput(request.email),
      };

      logServiceActivity('info', 'Creating Phorest client', {
        businessId: sanitizedRequest.businessId,
        firstName: sanitizedRequest.firstName,
        lastName: sanitizedRequest.lastName,
        email: sanitizedRequest.email,
      });

      // Step 1: Lookup tenant ID from business ID
      const tenantId = await this.getTenantIdFromBusinessId(sanitizedRequest.businessId);

      logServiceActivity('info', 'Tenant ID resolved', {
        tenantId,
        businessId: sanitizedRequest.businessId,
      });

      // Step 2: Get Phorest API configuration
      const config = await this.getPhorestConfig(tenantId);

      // Step 3: Decrypt credentials
      const credentials: PhorestCredentials = decryptPhorestCredentials(
        config.encryptedCredentials,
      );

      logServiceActivity('info', 'Credentials decrypted', { username: credentials.username });

      // Step 4: Validate and format input data
      validateName(sanitizedRequest.firstName, 'First name');
      validateName(sanitizedRequest.lastName, 'Last name');
      validateEmail(sanitizedRequest.email);
      const formattedPhone = formatPhoneNumber(sanitizedRequest.mobile);

      // Step 5: Validate complete request with schema
      const validatedRequest = createClientRequestSchema.parse({
        businessId: sanitizedRequest.businessId,
        firstName: sanitizedRequest.firstName,
        lastName: sanitizedRequest.lastName,
        mobile: formattedPhone,
        email: sanitizedRequest.email,
      });

      // Step 6: Build API URL
      const apiUrl = buildPhorestApiUrl(config.baseUrl, tenantId, sanitizedRequest.businessId);

      logServiceActivity('info', 'Calling Phorest API', { url: apiUrl });

      // Step 6: Prepare request payload
      const payload = {
        firstName: validatedRequest.firstName,
        lastName: validatedRequest.lastName,
        mobile: validatedRequest.mobile,
        email: validatedRequest.email,
      };

      // Step 8: Make API request
      const response = await this.httpClient.post(apiUrl, payload, {
        auth: {
          username: credentials.username,
          password: credentials.password,
        },
      });

      logServiceActivity('info', 'Phorest API response received', {
        status: response.status,
        hasClientId: !!response.data?.clientId,
      });

      // Step 9: Validate response
      if (!response.data || !response.data.clientId) {
        throw new PhorestApiError('Phorest API did not return a client ID', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
        });
      }

      // Step 10: Return created client
      const createdClient: CreateClientResponse = {
        clientId: response.data.clientId,
        firstName: validatedRequest.firstName,
        lastName: validatedRequest.lastName,
        mobile: validatedRequest.mobile,
        email: validatedRequest.email,
        createdAt: response.data.createdAt || new Date().toISOString(),
      };

      logServiceActivity('info', 'Client created successfully', {
        clientId: createdClient.clientId,
        email: createdClient.email,
      });

      return createdClient;
    } catch (error) {
      // Handle specific error types
      if (error instanceof PhorestServiceError) {
        logServiceActivity('error', `Phorest service error: ${error.message}`, error.details);
        throw error;
      }

      // Handle Axios errors
      if (axios.isAxiosError(error)) {
        return this.handleAxiosError(error);
      }

      // Handle unexpected errors
      logServiceActivity('error', 'Unexpected error creating client', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new PhorestServiceError('Unexpected error creating client in Phorest', 500, {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle Axios errors and convert to appropriate PhorestError
   *
   * @param error - Axios error
   * @throws Appropriate PhorestError subclass
   */
  private handleAxiosError(error: AxiosError): never {
    logServiceActivity('error', 'Axios error occurred', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });

    if (!error.response) {
      // Network error (no response received)
      throw new PhorestNetworkError('Failed to connect to Phorest API', {
        message: error.message,
        code: error.code,
      });
    }

    const status = error.response.status;
    const data = error.response.data;

    // Handle specific HTTP status codes
    switch (status) {
      case 401:
      case 403:
        throw new PhorestAuthError('Phorest API authentication failed. Check credentials.', {
          status,
          statusText: error.response.statusText,
          data,
        });

      case 409:
        // Client already exists
        throw new PhorestClientExistsError('Client already exists in Phorest', {
          status,
          statusText: error.response.statusText,
          data,
        });

      case 400:
        throw new PhorestApiError('Invalid request to Phorest API', {
          status,
          statusText: error.response.statusText,
          data,
          message:
            typeof data === 'object' && data !== null && 'message' in data
              ? (data as any).message
              : 'Bad request',
        });

      case 404:
        throw new PhorestApiError('Phorest API endpoint not found. Check business ID.', {
          status,
          statusText: error.response.statusText,
          data,
        });

      case 500:
      case 502:
      case 503:
      case 504:
        throw new PhorestApiError('Phorest API server error', {
          status,
          statusText: error.response.statusText,
          data,
        });

      default:
        throw new PhorestApiError(`Phorest API error: ${error.response.statusText}`, {
          status,
          statusText: error.response.statusText,
          data,
        });
    }
  }
}

// Export singleton instance
export const phorestService = new PhorestService();
