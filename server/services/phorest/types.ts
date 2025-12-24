/**
 * Phorest Service Type Definitions
 *
 * Type definitions for Phorest API integration including
 * client creation, authentication, and error handling.
 */

import { z } from 'zod';

// ============================================
// Request/Response Types
// ============================================

/**
 * Request payload for creating a new client in Phorest
 */
export interface CreateClientRequest {
  businessId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
}

/**
 * Response from Phorest API after creating a client
 */
export interface CreateClientResponse {
  clientId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  createdAt?: string;
}

/**
 * Phorest API credentials structure (decrypted)
 */
export interface PhorestCredentials {
  username: string;
  password: string;
}

/**
 * External API config from database
 */
export interface ExternalApiConfig {
  tenantId: string;
  serviceName: string;
  displayName: string | null;
  baseUrl: string;
  authType: string;
  encryptedCredentials: string;
  customHeaders: any | null;
  isActive: boolean;
}

/**
 * Tenant business record from database
 */
export interface TenantBusiness {
  id: string;
  tenantId: string;
  serviceName: string;
  businessId: string;
  businessName: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

// ============================================
// Validation Schemas
// ============================================

/**
 * Zod schema for validating create client request
 */
export const createClientRequestSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  mobile: z.string().min(1, 'Mobile number is required'),
  email: z.string().email('Invalid email format'),
});

/**
 * Type inference from validation schema
 */
export type ValidatedCreateClientRequest = z.infer<typeof createClientRequestSchema>;

// ============================================
// Error Response Types
// ============================================

/**
 * Standard error response structure
 */
export interface PhorestErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: any;
}

/**
 * Error details from Phorest API
 */
export interface PhorestApiErrorDetails {
  status: number;
  statusText: string;
  data?: any;
  message?: string;
}
