/**
 * Google Sheets Service Account Authentication
 * Handles JWT generation and access token caching for Google Service Accounts
 */

import { JWT } from 'google-auth-library';

// Cache tokens per service account to avoid regenerating on every request
const tokenCache = new Map<string, { token: string; expiry: number }>();

/**
 * Get access token from Google Service Account credentials
 * Automatically caches and refreshes tokens (valid for ~1 hour)
 *
 * @param serviceAccountJson - Parsed service account JSON object
 * @returns Access token string
 */
export async function getGoogleSheetsAccessToken(serviceAccountJson: any): Promise<string> {
  const cacheKey = serviceAccountJson.client_email;

  // Check cache first
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    console.log('[Google Sheets] Using cached access token');
    return cached.token;
  }

  console.log('[Google Sheets] Generating new access token from service account');

  // Create JWT client
  const jwtClient = new JWT({
    email: serviceAccountJson.client_email,
    key: serviceAccountJson.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets', // Read/write spreadsheets
      // Add more scopes if needed:
      // 'https://www.googleapis.com/auth/drive.readonly', // Read Drive files
      // 'https://www.googleapis.com/auth/drive.file', // Manage files created by this app
    ],
  });

  // Get access token (library handles JWT signing and token exchange)
  const accessToken = await jwtClient.getAccessToken();

  if (!accessToken.token) {
    throw new Error('Failed to get access token from service account');
  }

  // Cache token (Google tokens typically expire in 1 hour)
  // Use 55 minutes to have a 5-minute buffer for safety
  const expiry = Date.now() + 55 * 60 * 1000;
  tokenCache.set(cacheKey, {
    token: accessToken.token,
    expiry,
  });

  console.log('[Google Sheets] Access token generated and cached');

  return accessToken.token;
}

/**
 * Parse and validate service account from encrypted credentials
 *
 * @param encryptedCredentials - Encrypted credentials object containing serviceAccountJson
 * @param decryptFn - Function to decrypt the credentials
 * @returns Parsed service account object
 */
export function parseServiceAccount(
  encryptedCredentials: string,
  decryptFn: (data: string) => string,
): any {
  try {
    const decrypted = decryptFn(encryptedCredentials);
    const credentials = JSON.parse(decrypted);

    // Credentials must be stored as: { serviceAccountJson: "..." }
    if (!credentials.serviceAccountJson) {
      throw new Error(
        'Invalid credentials format: expected serviceAccountJson field. Please reconfigure Google Sheets in Integration Management.',
      );
    }

    const serviceAccount = JSON.parse(credentials.serviceAccountJson);

    // Validate required fields
    if (!serviceAccount.client_email) {
      throw new Error('Service account missing required field: client_email');
    }

    if (!serviceAccount.private_key) {
      throw new Error('Service account missing required field: private_key');
    }

    if (serviceAccount.type !== 'service_account') {
      console.warn('[Google Sheets] Unexpected service account type:', serviceAccount.type);
    }

    return serviceAccount;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid service account JSON format');
    }
    throw new Error(
      `Failed to parse service account: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Clear cached token for a service account (useful for testing or forced refresh)
 *
 * @param clientEmail - Service account email to clear cache for
 */
export function clearTokenCache(clientEmail: string): void {
  tokenCache.delete(clientEmail);
  console.log('[Google Sheets] Token cache cleared for:', clientEmail);
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getTokenCacheStats() {
  return {
    size: tokenCache.size,
    entries: Array.from(tokenCache.entries()).map(([email, data]) => ({
      email,
      expiresIn: Math.max(0, data.expiry - Date.now()),
    })),
  };
}
