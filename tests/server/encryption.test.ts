import { describe, it, expect } from 'vitest';
import { encryptApiKey, decryptApiKey } from '@server/encryption';

describe('Server Encryption', () => {
  describe('API Key Encryption', () => {
    it('should encrypt and decrypt API key correctly', () => {
      const apiKey = 'rck_test_1234567890abcdefghijklmnop';
      const encrypted = encryptApiKey(apiKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it('should produce different encrypted values for same input', () => {
      const apiKey = 'rck_test_1234567890abcdefghijklmnop';
      const encrypted1 = encryptApiKey(apiKey);
      const encrypted2 = encryptApiKey(apiKey);

      expect(encrypted1).not.toBe(encrypted2); // Due to random IV
    });

    it('should encrypt short strings', () => {
      const short = 'abc';
      const encrypted = encryptApiKey(short);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(short);
    });

    it('should encrypt long strings', () => {
      const long = 'a'.repeat(1000);
      const encrypted = encryptApiKey(long);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(long);
    });

    it('should handle special characters', () => {
      const special = 'test!@#$%^&*()_+-={}[]|:;<>?,./';
      const encrypted = encryptApiKey(special);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(special);
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界 🚀 émojis';
      const encrypted = encryptApiKey(unicode);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(unicode);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decryptApiKey('invalid')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for malformed encrypted data', () => {
      expect(() => decryptApiKey('part1:part2')).toThrow('Invalid encrypted data format');
    });

    it('should produce encrypted string with correct format', () => {
      const apiKey = 'rck_test_key';
      const encrypted = encryptApiKey(apiKey);
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // IV is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32); // Auth tag is 16 bytes = 32 hex chars
      expect(parts[2].length).toBeGreaterThan(0); // Encrypted content
    });

    it('should handle empty string', () => {
      const empty = '';
      const encrypted = encryptApiKey(empty);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(empty);
    });
  });
});
