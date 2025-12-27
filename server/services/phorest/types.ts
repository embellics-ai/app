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
 * Request payload for retrieving a client from Phorest
 */
export interface RetrieveClientRequest {
  businessId: string;
  phone: string;
}

/**
 * Response from Phorest API after retrieving a client
 */
export interface RetrieveClientResponse {
  clientId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  createdAt?: string;
}

/**
 * Request payload for retrieving service categories from Phorest
 */
export interface RetrieveServiceCategoriesRequest {
  businessId: string;
  branchId: string;
}

/**
 * Service category item from Phorest API
 */
export interface ServiceCategory {
  categoryId: string;
  categoryName: string;
}

/**
 * Response from Phorest API after retrieving service categories
 */
export interface RetrieveServiceCategoriesResponse {
  businessId: string;
  branchId: string;
  categories: ServiceCategory[];
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
  externalBusinessId: string | null;
  externalServiceName: string | null;
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

/**
 * Zod schema for validating retrieve client request
 */
export const retrieveClientRequestSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  phone: z.string().min(1, 'Phone number is required'),
});

/**
 * Type inference from validation schema
 */
export type ValidatedRetrieveClientRequest = z.infer<typeof retrieveClientRequestSchema>;

/**
 * Zod schema for validating retrieve service categories request
 */
export const retrieveServiceCategoriesRequestSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
});

/**
 * Type inference from validation schema
 */
export type ValidatedRetrieveServiceCategoriesRequest = z.infer<
  typeof retrieveServiceCategoriesRequestSchema
>;

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
