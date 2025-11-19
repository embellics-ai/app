// Integration test: hit running dev server endpoints to ensure no password fields are returned
process.env.SKIP_EMAIL = 'true';
process.env.NODE_ENV = 'test';
// Provide a platform token for tests (use value from local dev environment)
const PLATFORM_TOKEN =
  process.env.PLATFORM_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODJhMzA0MS02ZGYyLTQzY2ItOWQ0OS1kY2Q2YWExMDBkNzYiLCJ0ZW5hbnRJZCI6bnVsbCwiZW1haWwiOiJhZG1pbkBlbWJlbGxpY3MuY29tIiwicm9sZSI6Im93bmVyIiwiaXNQbGF0Zm9ybUFkbWluIjp0cnVlLCJpYXQiOjE3NjM1NjUxNTIsImV4cCI6MTc2NDE2OTk1Mn0.sFzBgkv5oW8TcJ06oba3x1sj5958mssCSiJRaa2kE3Q';

import { describe, it, expect } from 'vitest';

async function getJson(path: string, token?: string) {
  const res = await fetch(`http://localhost:3000${path}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });
  const body = await res.text();
  let json: any;
  try {
    json = JSON.parse(body || 'null');
  } catch (err) {
    throw new Error(`Invalid JSON from ${path}: ${body}`);
  }
  return { status: res.status, body: json };
}

describe('Invitation endpoints (integration)', () => {
  it('GET /api/platform/invitations does not include password fields', async () => {
    const { status, body } = await getJson('/api/platform/invitations', PLATFORM_TOKEN);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    for (const inv of body) {
      expect(inv).not.toHaveProperty('temporaryPassword');
      expect(inv).not.toHaveProperty('plainTemporaryPassword');
    }
  });
});
