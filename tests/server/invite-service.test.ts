import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUser, HttpError } from '@server/services/inviteService';
import { storage } from '@server/storage';
import { hashPassword } from '@server/auth';
import { sendInvitationEmail } from '@server/email';

// Mock dependencies
vi.mock('@server/storage', () => ({
  storage: {
    getTenant: vi.fn(),
    getClientUserByEmail: vi.fn(),
    getPendingInvitationByEmail: vi.fn(),
    deleteInvitation: vi.fn(),
    createUserInvitation: vi.fn(),
  },
}));

vi.mock('@server/auth', () => ({
  hashPassword: vi.fn(),
}));

vi.mock('@server/email', () => ({
  sendInvitationEmail: vi.fn(),
}));

vi.mock('crypto', () => {
  const mockRandomBytes = vi.fn(() => ({
    toString: () => 'temphex123',
  }));

  return {
    default: {
      randomBytes: mockRandomBytes,
    },
    randomBytes: mockRandomBytes,
  };
});

describe('InviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hashPassword as any).mockResolvedValue('hashed-password');
    (storage.getClientUserByEmail as any).mockResolvedValue(null);
    (storage.getPendingInvitationByEmail as any).mockResolvedValue(null);
    (sendInvitationEmail as any).mockResolvedValue(undefined);
  });

  describe('inviteUser', () => {
    it('should allow platform admin to invite client_admin', async () => {
      const platformAdmin = {
        userId: 'admin-1',
        role: 'admin',
        tenantId: null,
        isPlatformAdmin: true,
        email: 'admin@platform.com',
      };

      const payload = {
        email: 'client@example.com',
        firstName: 'Client',
        lastName: 'User',
        role: 'client_admin',
        companyName: 'Test Company',
      };

      (storage.createUserInvitation as any).mockResolvedValue({
        id: 'invite-1',
        ...payload,
        status: 'pending',
      });

      const result = await inviteUser(platformAdmin, payload);

      expect(storage.createUserInvitation).toHaveBeenCalled();
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        payload.email,
        payload.firstName,
        payload.lastName,
        expect.any(String),
        payload.role,
      );
    });

    it('should allow client_admin to invite support_staff', async () => {
      const clientAdmin = {
        userId: 'client-1',
        role: 'client_admin',
        tenantId: 'tenant-1',
        isPlatformAdmin: false,
        email: 'client@tenant.com',
      };

      const payload = {
        email: 'support@example.com',
        firstName: 'Support',
        lastName: 'Staff',
        role: 'support_staff',
      };

      (storage.createUserInvitation as any).mockResolvedValue({
        id: 'invite-2',
        ...payload,
        tenantId: 'tenant-1',
        status: 'pending',
      });

      await inviteUser(clientAdmin, payload);

      expect(storage.createUserInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          role: 'support_staff',
        }),
      );
    });

    it('should reject duplicate email', async () => {
      const platformAdmin = {
        userId: 'admin-1',
        role: 'admin',
        tenantId: null,
        isPlatformAdmin: true,
      };

      const payload = {
        email: 'existing@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'client_admin',
        companyName: 'Test Co',
      };

      (storage.getClientUserByEmail as any).mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      await expect(inviteUser(platformAdmin, payload)).rejects.toThrow(HttpError);
      await expect(inviteUser(platformAdmin, payload)).rejects.toThrow('already exists');
    });

    it('should reject client_admin inviting admin role', async () => {
      const clientAdmin = {
        userId: 'client-1',
        role: 'client_admin',
        tenantId: 'tenant-1',
        isPlatformAdmin: false,
      };

      const payload = {
        email: 'admin@example.com',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'admin',
      };

      await expect(inviteUser(clientAdmin, payload)).rejects.toThrow(HttpError);
      await expect(inviteUser(clientAdmin, payload)).rejects.toThrow('cannot create');
    });

    it('should delete existing pending invitation before creating new one', async () => {
      const platformAdmin = {
        userId: 'admin-1',
        role: 'admin',
        tenantId: null,
        isPlatformAdmin: true,
      };

      const payload = {
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'client_admin',
        companyName: 'Test Co',
      };

      (storage.getPendingInvitationByEmail as any).mockResolvedValue({
        id: 'old-invite',
        email: 'user@example.com',
      });

      (storage.createUserInvitation as any).mockResolvedValue({
        id: 'new-invite',
        ...payload,
      });

      await inviteUser(platformAdmin, payload);

      expect(storage.deleteInvitation).toHaveBeenCalledWith('old-invite');
      expect(storage.createUserInvitation).toHaveBeenCalled();
    });

    it('should reject invitation without sufficient privileges', async () => {
      const supportStaff = {
        userId: 'support-1',
        role: 'support_staff',
        tenantId: 'tenant-1',
        isPlatformAdmin: false,
      };

      const payload = {
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'client_admin',
      };

      await expect(inviteUser(supportStaff, payload)).rejects.toThrow(HttpError);
      await expect(inviteUser(supportStaff, payload)).rejects.toThrow('Insufficient privileges');
    });

    it('should require companyName for new client_admin without tenantId', async () => {
      const platformAdmin = {
        userId: 'admin-1',
        role: 'admin',
        tenantId: null,
        isPlatformAdmin: true,
      };

      const payload = {
        email: 'client@example.com',
        firstName: 'Client',
        lastName: 'Admin',
        role: 'client_admin',
        // Missing companyName and tenantId
      };

      await expect(inviteUser(platformAdmin, payload)).rejects.toThrow(HttpError);
      await expect(inviteUser(platformAdmin, payload)).rejects.toThrow('companyName is required');
    });

    it('should use existing tenant when tenantId provided', async () => {
      const platformAdmin = {
        userId: 'admin-1',
        role: 'admin',
        tenantId: null,
        isPlatformAdmin: true,
      };

      const payload = {
        email: 'client@example.com',
        firstName: 'Client',
        lastName: 'Admin',
        role: 'client_admin',
        tenantId: 'existing-tenant',
      };

      (storage.getTenant as any).mockResolvedValue({
        id: 'existing-tenant',
        name: 'Existing Company',
      });

      (storage.createUserInvitation as any).mockResolvedValue({
        id: 'invite-3',
        ...payload,
      });

      await inviteUser(platformAdmin, payload);

      expect(storage.getTenant).toHaveBeenCalledWith('existing-tenant');
      expect(storage.createUserInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'existing-tenant',
        }),
      );
    });
  });

  describe('HttpError', () => {
    it('should create error with status and message', () => {
      const error = new HttpError(403, 'Forbidden');

      expect(error.status).toBe(403);
      expect(error.message).toBe('Forbidden');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HttpError);
    });
  });
});
