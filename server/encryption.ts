import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

if (ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

export function encryptApiKey(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY_BUFFER, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generic encryption function - can be used for any sensitive string
 */
export function encrypt(plaintext: string): string {
  return encryptApiKey(plaintext);
}

/**
 * Generic decryption function - can be used for any encrypted string
 */
export function decrypt(encrypted: string): string {
  return decryptApiKey(encrypted);
}

/**
 * Encrypt sensitive fields within a JSONB object
 * @param data - The object containing sensitive fields
 * @param fieldsToEncrypt - Array of field names to encrypt
 * @returns New object with encrypted fields
 */
export function encryptJSONBFields<T extends Record<string, any>>(
  data: T,
  fieldsToEncrypt: string[],
): T {
  const result: any = { ...data };

  for (const field of fieldsToEncrypt) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field]);
    }
  }

  return result as T;
}

/**
 * Decrypt sensitive fields within a JSONB object
 * @param data - The object containing encrypted fields
 * @param fieldsToDecrypt - Array of field names to decrypt
 * @returns New object with decrypted fields
 */
export function decryptJSONBFields<T extends Record<string, any>>(
  data: T | null | undefined,
  fieldsToDecrypt: string[],
): T | null {
  if (!data) return null;

  const result: any = { ...data };

  for (const field of fieldsToDecrypt) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decrypt(result[field]);
      } catch (error) {
        // If decryption fails, field might not be encrypted yet
        console.warn(`Failed to decrypt field '${field}':`, error);
      }
    }
  }

  return result as T;
}

/**
 * Mask a token for display purposes
 * Shows first 8 and last 4 characters, masks the rest
 * e.g., "sk_live_abc123xyz789..." -> "sk_live_***xyz789"
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return '';
  if (token.length <= 12) return '***';

  const prefix = token.substring(0, 8);
  const suffix = token.substring(token.length - 4);
  return `${prefix}***${suffix}`;
}

/**
 * Mask a long token (like WhatsApp access tokens)
 * Shows first 10 and last 6 characters
 */
export function maskLongToken(token: string | null | undefined): string {
  if (!token) return '';
  if (token.length <= 16) return '***';

  const prefix = token.substring(0, 10);
  const suffix = token.substring(token.length - 6);
  return `${prefix}***${suffix}`;
}

/**
 * Encrypt WhatsApp configuration object
 * Encrypts: accessToken, webhookVerifyToken
 */
export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  phoneNumber?: string;
}

export function encryptWhatsAppConfig(config: WhatsAppConfig): WhatsAppConfig {
  return encryptJSONBFields(config, ['accessToken', 'webhookVerifyToken']);
}

export function decryptWhatsAppConfig(config: WhatsAppConfig | null): WhatsAppConfig | null {
  return decryptJSONBFields(config, ['accessToken', 'webhookVerifyToken']);
}

/**
 * Encrypt SMS configuration object
 * Encrypts: accountSid, authToken
 */
export interface SMSConfig {
  provider: 'twilio' | 'vonage' | 'aws_sns';
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  messagingServiceSid?: string; // Optional for Twilio
}

export function encryptSMSConfig(config: SMSConfig): SMSConfig {
  return encryptJSONBFields(config, ['accountSid', 'authToken']);
}

export function decryptSMSConfig(config: SMSConfig | null): SMSConfig | null {
  return decryptJSONBFields(config, ['accountSid', 'authToken']);
}

/**
 * Mask WhatsApp config for safe display to frontend
 */
export function maskWhatsAppConfig(config: WhatsAppConfig | null): Partial<WhatsAppConfig> | null {
  if (!config) return null;

  return {
    phoneNumberId: config.phoneNumberId,
    businessAccountId: config.businessAccountId,
    accessToken: maskLongToken(config.accessToken),
    webhookVerifyToken: maskToken(config.webhookVerifyToken),
    phoneNumber: config.phoneNumber,
  };
}

/**
 * Mask SMS config for safe display to frontend
 */
export function maskSMSConfig(config: SMSConfig | null): Partial<SMSConfig> | null {
  if (!config) return null;

  return {
    provider: config.provider,
    accountSid: maskToken(config.accountSid),
    authToken: maskToken(config.authToken),
    phoneNumber: config.phoneNumber,
    messagingServiceSid: config.messagingServiceSid,
  };
}
