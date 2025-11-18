import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage';
import { generateToken, hashPassword } from '../../server/auth';

describe('Onboarding Flow Tests', () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  describe('Client Admin Onboarding Flow', () => {
    it('should complete full onboarding flow for client admin', async () => {
      const tempPassword = 'temp123';
      const hashedTempPassword = await hashPassword(tempPassword);

      // Step 1: Create invitation
      const invitation = await storage.createUserInvitation({
        email: 'client@newcompany.com',
        firstName: 'Client',
        lastName: 'Admin',
        phoneNumber: '+1234567890',
        temporaryPassword: hashedTempPassword,
        role: 'client_admin',
        tenantId: null,
        invitedBy: 'admin-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        companyName: 'New Company Inc',
        companyPhone: '+1234567890',
        plainTemporaryPassword: tempPassword,
      });

      // Step 2: Login with temporary password (auto-creates user and tenant)
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'client@newcompany.com',
          password: tempPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');
      expect(loginResponse.body.user.onboardingCompleted).toBe(false);
      expect(loginResponse.body.user.tenantId).toBeTruthy();

      const token = loginResponse.body.token;
      const tenantId = loginResponse.body.user.tenantId;
      const userId = loginResponse.body.user.id;

      // Step 3: Create widget config
      const widgetResponse = await request(app)
        .post('/api/widget-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          primaryColor: '#6366f1',
          position: 'bottom-right',
          greeting: 'Hello!',
          placeholder: 'Type here...',
          allowedDomains: [],
        });

      expect(widgetResponse.status).toBe(201);

      // Step 4: Generate API key
      const apiKeyResponse = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'My First API Key',
        });

      expect(apiKeyResponse.status).toBe(201);
      expect(apiKeyResponse.body).toHaveProperty('plainTextKey');

      // Step 5: Complete onboarding
      const completeResponse = await request(app)
        .post('/api/auth/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(completeResponse.status).toBe(200);

      // Verify user status
      const user = await storage.getClientUser(userId);
      expect(user?.onboardingCompleted).toBe(true);

      // Verify tenant was created
      const tenant = await storage.getTenant(tenantId);
      expect(tenant).toBeTruthy();
      expect(tenant?.name).toBe('New Company Inc');
    });

    it('should allow skipping onboarding steps', async () => {
      const tempPassword = 'temp123';
      const hashedTempPassword = await hashPassword(tempPassword);

      // Create invitation
      await storage.createUserInvitation({
        email: 'skip@example.com',
        firstName: 'Skip',
        lastName: 'User',
        phoneNumber: '+1234567890',
        temporaryPassword: hashedTempPassword,
        role: 'client_admin',
        tenantId: null,
        invitedBy: 'admin-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        companyName: 'Skip Company',
        companyPhone: '+1234567890',
        plainTemporaryPassword: tempPassword,
      });

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'skip@example.com',
          password: tempPassword,
        });

      const token = loginResponse.body.token;

      // Skip directly to completing onboarding without widget config or API key
      const completeResponse = await request(app)
        .post('/api/auth/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(completeResponse.status).toBe(200);

      // Verify user can still access the system
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.onboardingCompleted).toBe(true);
    });
  });

  describe('Platform Admin Onboarding Flow', () => {
    it('should complete onboarding for platform admin without tenant', async () => {
      const tempPassword = 'temp123';
      const hashedTempPassword = await hashPassword(tempPassword);

      // Create platform admin invitation
      await storage.createUserInvitation({
        email: 'newadmin@platform.com',
        firstName: 'New',
        lastName: 'Admin',
        phoneNumber: null,
        temporaryPassword: hashedTempPassword,
        role: 'admin',
        tenantId: null,
        invitedBy: 'owner-id',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        plainTemporaryPassword: tempPassword,
      });

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newadmin@platform.com',
          password: tempPassword,
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.isPlatformAdmin).toBe(true);
      expect(loginResponse.body.user.tenantId).toBeNull();

      const token = loginResponse.body.token;

      // Complete onboarding (should work without tenant)
      const completeResponse = await request(app)
        .post('/api/auth/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.success).toBe(true);
    });
  });

  describe('Widget Configuration Tests', () => {
    it('should create widget config for new tenant', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      const tenant = await storage.createTenant({
        name: 'Widget Test Co',
        email: 'widget@test.com',
        phone: null,
        plan: 'free',
        status: 'active',
      });

      const user = await storage.createClientUser({
        email: 'widget@test.com',
        password: hashedPassword,
        firstName: 'Widget',
        lastName: 'User',
        tenantId: tenant.id,
        role: 'client_admin',
        isPlatformAdmin: false,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        isPlatformAdmin: false,
      });

      const response = await request(app)
        .post('/api/widget-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          primaryColor: '#ff0000',
          position: 'bottom-left',
          greeting: 'Welcome!',
          placeholder: 'Ask us anything...',
          allowedDomains: ['example.com'],
        });

      expect(response.status).toBe(201);
      expect(response.body.primaryColor).toBe('#ff0000');
      expect(response.body.position).toBe('bottom-left');
    });

    it('should update existing widget config', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      const tenant = await storage.createTenant({
        name: 'Update Test Co',
        email: 'update@test.com',
        phone: null,
        plan: 'free',
        status: 'active',
      });

      const user = await storage.createClientUser({
        email: 'update@test.com',
        password: hashedPassword,
        firstName: 'Update',
        lastName: 'User',
        tenantId: tenant.id,
        role: 'client_admin',
        isPlatformAdmin: false,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        isPlatformAdmin: false,
      });

      // Create initial config
      await request(app)
        .post('/api/widget-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          primaryColor: '#0000ff',
          position: 'bottom-right',
          greeting: 'Hi',
          placeholder: 'Type...',
          allowedDomains: [],
        });

      // Update config
      const updateResponse = await request(app)
        .patch('/api/widget-config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          primaryColor: '#00ff00',
          greeting: 'Hello there!',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.primaryColor).toBe('#00ff00');
      expect(updateResponse.body.greeting).toBe('Hello there!');
    });
  });

  describe('API Key Generation Tests', () => {
    it('should generate API key for tenant', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      const tenant = await storage.createTenant({
        name: 'API Key Test Co',
        email: 'apikey@test.com',
        phone: null,
        plan: 'free',
        status: 'active',
      });

      const user = await storage.createClientUser({
        email: 'apikey@test.com',
        password: hashedPassword,
        firstName: 'API',
        lastName: 'User',
        tenantId: tenant.id,
        role: 'client_admin',
        isPlatformAdmin: false,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        isPlatformAdmin: false,
      });

      const response = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test API Key',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('plainTextKey');
      expect(response.body.key.name).toBe('Test API Key');
      expect(response.body.key.tenantId).toBe(tenant.id);
    });

    it('should list API keys for tenant', async () => {
      const password = 'password123';
      const hashedPassword = await hashPassword(password);

      const tenant = await storage.createTenant({
        name: 'List Keys Test Co',
        email: 'listkeys@test.com',
        phone: null,
        plan: 'free',
        status: 'active',
      });

      const user = await storage.createClientUser({
        email: 'listkeys@test.com',
        password: hashedPassword,
        firstName: 'List',
        lastName: 'User',
        tenantId: tenant.id,
        role: 'client_admin',
        isPlatformAdmin: false,
        phoneNumber: null,
        onboardingCompleted: false,
      });

      const token = generateToken({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        isPlatformAdmin: false,
      });

      // Create multiple API keys
      await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 1' });

      await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Key 2' });

      // List keys
      const response = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body.some((k: any) => k.name === 'Key 1')).toBe(true);
      expect(response.body.some((k: any) => k.name === 'Key 2')).toBe(true);
    });
  });
});
