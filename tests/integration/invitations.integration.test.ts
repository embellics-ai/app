// Integration test: hit running dev server endpoints to ensure no password fields are returned
process.env.SKIP_EMAIL = 'true';
process.env.NODE_ENV = 'test';

import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerRoutes } from '../../server/routes';
import { generateToken } from '../../server/auth';

// Create a platform admin token using the test SESSION_SECRET
const PLATFORM_TOKEN = generateToken({
  userId: 'test-platform-admin',
  tenantId: null,
  email: 'admin@example.com',
  role: 'owner',
  isPlatformAdmin: true,
});

let app: express.Express;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  // express-ws augments the app with a .ws() method; registerRoutes expects it.
  // Provide a no-op .ws implementation for tests (we don't exercise websockets here).
  (app as any).ws = (path: string, handler: any) => {
    // no-op
  };
  // Register routes directly on the test app instance
  await registerRoutes(app);
});

describe('Invitation endpoints (integration)', () => {
  it('GET /api/platform/invitations does not include password fields', async () => {
    const res = await request(app)
      .get('/api/platform/invitations')
      .set('Authorization', `Bearer ${PLATFORM_TOKEN}`)
      .expect(200);

    const body = res.body;
    expect(Array.isArray(body)).toBe(true);
    for (const inv of body) {
      expect(inv).not.toHaveProperty('temporaryPassword');
      expect(inv).not.toHaveProperty('plainTemporaryPassword');
    }
  });
});
