/**
 * Phorest Service Utility Functions
 *
 * Helper functions for credential decryption, phone number formatting,
 * and data validation.
 */

import { decrypt } from '../../encryption';
import { PhorestCredentials } from './types';
import { PhorestConfigError, PhorestValidationError } from './errors';

/**
 * Decrypt Phorest credentials from encrypted storage
 *
 * @param encryptedCredentials - Encrypted credentials string from database
 * @returns Decrypted credentials object
 * @throws PhorestConfigError if decryption fails or credentials are invalid
 */
export function decryptPhorestCredentials(encryptedCredentials: string): PhorestCredentials {
  try {
    if (!encryptedCredentials) {
      throw new PhorestConfigError('No encrypted credentials found');
    }

    const decrypted = decrypt(encryptedCredentials);
    const credentials = JSON.parse(decrypted);

    // Validate credentials structure
    if (!credentials.username || !credentials.password) {
      throw new PhorestConfigError('Invalid credentials structure: missing username or password', {
        hasUsername: !!credentials.username,
        hasPassword: !!credentials.password,
      });
    }

    return {
      username: credentials.username,
      password: credentials.password,
    };
  } catch (error) {
    if (error instanceof PhorestConfigError) {
      throw error;
    }
    throw new PhorestConfigError('Failed to decrypt Phorest credentials', {
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Format phone number to Phorest API expected format (+353XXXXXXXXX)
 * Assumes the input is already in format 353XXXXXXXXX
 *
 * @param phone - Phone number in format 353XXXXXXXXX
 * @returns Formatted phone number with + prefix
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all whitespace
  const cleaned = phone.trim();

  // If already has +, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Add + prefix (assumes format is 353XXXXXXXXX)
  return `+${cleaned}`;
}

/**
 * Validate email format
 *
 * @param email - Email address to validate
 * @returns true if valid
 * @throws PhorestValidationError if invalid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    throw new PhorestValidationError(`Invalid email format: ${email}`);
  }

  return true;
}

/**
 * Validate name fields (first name, last name)
 *
 * @param name - Name to validate
 * @param fieldName - Field name for error messages
 * @returns true if valid
 * @throws PhorestValidationError if invalid
 */
export function validateName(name: string, fieldName: string = 'Name'): boolean {
  if (!name || name.trim().length === 0) {
    throw new PhorestValidationError(`${fieldName} cannot be empty`);
  }

  if (name.length > 100) {
    throw new PhorestValidationError(`${fieldName} cannot exceed 100 characters`);
  }

  // Check for invalid characters (optional - adjust based on Phorest requirements)
  if (!/^[a-zA-Z\s\-'\.]+$/.test(name)) {
    throw new PhorestValidationError(
      `${fieldName} contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed.`,
    );
  }

  return true;
}

/**
 * Sanitize string input by trimming whitespace
 *
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input.trim();
}

/**
 * Build Phorest API URL for client creation
 *
 * @param baseUrl - Base URL from config
 * @param businessId - Phorest business ID
 * @returns Full API endpoint URL
 */
export function buildPhorestApiUrl(baseUrl: string, businessId: string): string {
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');

  // Build the URL according to Phorest API format
  // Format: {baseUrl}/api/business/{businessId}/client
  return `${cleanBaseUrl}/api/business/${businessId}/client`;
}

/**
 * Log service activity (can be extended to use a proper logger)
 *
 * @param level - Log level (info, warn, error)
 * @param message - Log message
 * @param data - Additional data to log
 */
export function logServiceActivity(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: any,
): void {
  const timestamp = new Date().toISOString();
  const logData = data ? JSON.stringify(data, null, 2) : '';

  console.log(`[${timestamp}] [Phorest Service] [${level.toUpperCase()}] ${message}`);
  if (logData) {
    console.log(logData);
  }
}
