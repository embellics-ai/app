import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  assertTenant,
} from '@server/auth';
import { createMockRequest, createMockResponse, mockUsers } from '../test-utils';
import type { AuthenticatedRequest } from '@server/auth';

describe('Server Auth', () => {
  describe('Password Hashing', () => {
    it('should hash passwords', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(40);
    });

    it('should create different hashes for same password', async () => {
      const password = 'Test123!@#';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // Salt should be different
    });

    it('should verify correct password', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test123!@#';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(false);
    });

    it('should handle empty passwords', async () => {
      const hash = await hashPassword('');
      const isValid = await verifyPassword('', hash);

      expect(isValid).toBe(true);
    });
  });

  describe('JWT Token Management', () => {
    it('should generate valid JWT token', () => {
      const payload = mockUsers.tenantOwner;
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify valid token and return payload', () => {
      const payload = mockUsers.tenantOwner;
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
      expect(decoded?.role).toBe(payload.role);
      expect(decoded?.tenantId).toBe(payload.tenantId);
    });

    it('should reject invalid token', () => {
      const decoded = verifyToken('invalid.token.here');
      expect(decoded).toBeNull();
    });

    it('should reject malformed token', () => {
      const decoded = verifyToken('not-a-jwt');
      expect(decoded).toBeNull();
    });

    it('should handle platform admin (null tenantId)', () => {
      const payload = mockUsers.platformAdmin;
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.tenantId).toBeNull();
      expect(decoded?.isPlatformAdmin).toBe(true);
    });

    it('should include all required payload fields', () => {
      const payload = mockUsers.clientAdmin;
      const token = generateToken(payload);
      const decoded = verifyToken(token);

      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('tenantId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('isPlatformAdmin');
    });
  });

  describe('assertTenant', () => {
    it('should return tenantId when valid', () => {
      const req = createMockRequest({
        user: mockUsers.tenantOwner,
      }) as AuthenticatedRequest;

      const tenantId = assertTenant(req);
      expect(tenantId).toBe('tenant-1');
    });

    it('should return null when tenantId is missing', () => {
      const req = createMockRequest({
        user: { ...mockUsers.tenantOwner, tenantId: null },
      }) as AuthenticatedRequest;

      const tenantId = assertTenant(req);
      expect(tenantId).toBeNull();
    });

    it('should return null when tenantId is empty string', () => {
      const req = createMockRequest({
        user: { ...mockUsers.tenantOwner, tenantId: '  ' },
      }) as AuthenticatedRequest;

      const tenantId = assertTenant(req);
      expect(tenantId).toBeNull();
    });

    it('should return null when user is not set', () => {
      const req = createMockRequest() as AuthenticatedRequest;

      const tenantId = assertTenant(req);
      expect(tenantId).toBeNull();
    });

    it('should send 401 response when res is provided and tenantId invalid', () => {
      const req = createMockRequest({
        user: { ...mockUsers.tenantOwner, tenantId: null },
      }) as AuthenticatedRequest;
      const res = createMockResponse();

      const tenantId = assertTenant(req, res);

      expect(tenantId).toBeNull();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token: missing tenant ID' });
    });
  });
});
