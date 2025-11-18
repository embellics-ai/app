import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { MemStorage } from '../../server/storage';
import { generateToken, hashPassword } from '../../server/auth';

// Use isolated storage for each test to prevent state bleed
let testStorage: MemStorage;

describe('Authentication API Tests', () => {
  let app: express.Express;

  beforeEach(async () => {
    // Create fresh storage instance for each test
    testStorage = new MemStorage();
    
    // Replace global storage with test storage
    vi.mock('../../server/storage', () => ({
      storage: testStorage,
      MemStorage,
    }));
    
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login existing user with correct credentials', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);
      
      // Create test user
      const user = await testStorage.createClientUser({
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        tenantId: null,
        role: 'admin',
        isPlatformAdmin: true,
        phoneNumber: null,
        onboardingCompleted: true,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        isPlatformAdmin: true,
      });
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should create user from pending invitation on first login', async () => {
      const tempPassword = 'temp123';
      const hashedTempPassword = await hashPassword(tempPassword);

      // Create pending invitation for client_admin
      const invitation = await testStorage.createUserInvitation({
        email: 'newclient@example.com',
        firstName: 'New',
        lastName: 'Client',
        phoneNumber: '+1234567890',
        temporaryPassword: hashedTempPassword,
        role: 'client_admin',
        tenantId: null,
        invitedBy: 'admin-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        companyName: 'Test Company',
        companyPhone: '+1234567890',
        plainTemporaryPassword: tempPassword,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newclient@example.com',
          password: tempPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toMatchObject({
        email: 'newclient@example.com',
        firstName: 'New',
        lastName: 'Client',
        role: 'client_admin',
        isPlatformAdmin: false,
        onboardingCompleted: false,
      });
      expect(response.body.user.tenantId).toBeTruthy();

      // Verify invitation was marked as accepted
      const updatedInvitation = await testStorage.getUserInvitationByEmail(invitation.email);
      expect(updatedInvitation?.status).toBe('accepted');
    });

    it('should create user from pending invitation for platform admin', async () => {
      const tempPassword = 'temp123';
      const hashedTempPassword = await hashPassword(tempPassword);

      // Create pending invitation for admin
      await storage.createUserInvitation({
        email: 'newadmin@example.com',
        firstName: 'New',
        lastName: 'Admin',
        phoneNumber: null,
        temporaryPassword: hashedTempPassword,
        role: 'admin',
        tenantId: null,
        invitedBy: 'admin-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        plainTemporaryPassword: tempPassword,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newadmin@example.com',
          password: tempPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        email: 'newadmin@example.com',
        role: 'admin',
        isPlatformAdmin: true,
        tenantId: null,
        onboardingCompleted: false,
      });
    });

    it('should reject expired invitation', async () => {
      const tempPassword = 'temp123';
      const hashedTempPassword = await hashPassword(tempPassword);

      // Create expired invitation
      await storage.createUserInvitation({
        email: 'expired@example.com',
        firstName: 'Expired',
        lastName: 'User',
        phoneNumber: null,
        temporaryPassword: hashedTempPassword,
        role: 'client_admin',
        tenantId: null,
        invitedBy: 'admin-id',
        expiresAt: new Date(Date.now() - 1000), // Already expired
        status: 'pending',
        companyName: 'Test Company',
        plainTemporaryPassword: tempPassword,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'expired@example.com',
          password: tempPassword,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/complete-onboarding', () => {
    it('should complete onboarding for client admin with tenantId', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);
      
      // Create tenant
      const tenant = await testStorage.createTenant({
        name: 'Test Company',
        email: 'test@company.com',
        phone: null,
        plan: 'free',
        status: 'active',
      });

      // Create client admin user
      const user = await storage.createClientUser({
        email: 'client@example.com',
        password: hashedPassword,
        firstName: 'Client',
        lastName: 'Admin',
        tenantId: tenant.id,
        role: 'client_admin',
        isPlatformAdmin: false,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin,
      });

      const response = await request(app)
        .post('/api/auth/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });

      // Verify user's onboarding status was updated
      const updatedUser = await testStorage.getClientUser(user.id);
      expect(updatedUser?.onboardingCompleted).toBe(true);
    });

    it('should complete onboarding for platform admin without tenantId', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      // Create platform admin user
      const user = await storage.createClientUser({
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Platform',
        lastName: 'Admin',
        tenantId: null,
        role: 'admin',
        isPlatformAdmin: true,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: null,
        email: user.email,
        role: user.role,
        isPlatformAdmin: true,
      });

      const response = await request(app)
        .post('/api/auth/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });

      // Verify user's onboarding status was updated
      const updatedUser = await testStorage.getClientUser(user.id);
      expect(updatedUser?.onboardingCompleted).toBe(true);
    });

    it('should reject onboarding completion without auth token', async () => {
      const response = await request(app)
        .post('/api/auth/complete-onboarding')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should reject client admin without tenantId', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      // Create client admin WITHOUT tenant (invalid state)
      const user = await storage.createClientUser({
        email: 'invalid@example.com',
        password: hashedPassword,
        firstName: 'Invalid',
        lastName: 'User',
        tenantId: null, // Client admin should have a tenantId
        role: 'client_admin',
        isPlatformAdmin: false,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: null,
        email: user.email,
        role: user.role,
        isPlatformAdmin: false,
      });

      const response = await request(app)
        .post('/api/auth/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password with correct current password', async () => {
      const oldPassword = 'oldpass123';
      const newPassword = 'newpass456';
      const hashedOldPassword = await hashPassword(oldPassword);

      const user = await storage.createClientUser({
        email: 'changepass@example.com',
        password: hashedOldPassword,
        firstName: 'Change',
        lastName: 'Pass',
        tenantId: null,
        role: 'admin',
        isPlatformAdmin: true,
        phoneNumber: null,
        onboardingCompleted: true,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: null,
        email: user.email,
        role: user.role,
        isPlatformAdmin: true,
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: oldPassword,
          newPassword: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
    });

    it('should reject password change with incorrect current password', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      const user = await storage.createClientUser({
        email: 'wrongpass@example.com',
        password: hashedPassword,
        firstName: 'Wrong',
        lastName: 'Pass',
        tenantId: null,
        role: 'admin',
        isPlatformAdmin: true,
        phoneNumber: null,
        onboardingCompleted: true,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: null,
        email: user.email,
        role: user.role,
        isPlatformAdmin: true,
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpass456',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user data with valid token', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      const user = await storage.createClientUser({
        email: 'me@example.com',
        password: hashedPassword,
        firstName: 'Current',
        lastName: 'User',
        tenantId: null,
        role: 'admin',
        isPlatformAdmin: true,
        phoneNumber: null,
        onboardingCompleted: true,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: null,
        email: user.email,
        role: user.role,
        isPlatformAdmin: true,
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        email: 'me@example.com',
        firstName: 'Current',
        lastName: 'User',
        role: 'admin',
        isPlatformAdmin: true,
        onboardingCompleted: true,
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
