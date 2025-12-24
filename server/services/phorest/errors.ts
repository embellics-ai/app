/**
 * Phorest Service Error Classes
 *
 * Custom error classes for handling different types of errors
 * in the Phorest API integration.
 */

import { PhorestApiErrorDetails } from './types';

/**
 * Base error class for all Phorest service errors
 */
export class PhorestServiceError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'PhorestServiceError';
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Authentication/Authorization errors (401, 403)
 */
export class PhorestAuthError extends PhorestServiceError {
  constructor(message: string = 'Phorest authentication failed', details?: any) {
    super(message, 401, details);
    this.name = 'PhorestAuthError';
  }
}

/**
 * Validation errors (400)
 */
export class PhorestValidationError extends PhorestServiceError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
    this.name = 'PhorestValidationError';
  }
}

/**
 * Phorest API errors (non-2xx responses)
 */
export class PhorestApiError extends PhorestServiceError {
  public apiDetails: PhorestApiErrorDetails;

  constructor(message: string, apiDetails: PhorestApiErrorDetails) {
    super(message, apiDetails.status, apiDetails);
    this.name = 'PhorestApiError';
    this.apiDetails = apiDetails;
  }
}

/**
 * Configuration errors (missing credentials, invalid config)
 */
export class PhorestConfigError extends PhorestServiceError {
  constructor(message: string, details?: any) {
    super(message, 500, details);
    this.name = 'PhorestConfigError';
  }
}

/**
 * Client already exists error (409)
 */
export class PhorestClientExistsError extends PhorestServiceError {
  constructor(message: string = 'Client already exists in Phorest', details?: any) {
    super(message, 409, details);
    this.name = 'PhorestClientExistsError';
  }
}

/**
 * Network/timeout errors
 */
export class PhorestNetworkError extends PhorestServiceError {
  constructor(message: string = 'Network error communicating with Phorest API', details?: any) {
    super(message, 503, details);
    this.name = 'PhorestNetworkError';
  }
}
