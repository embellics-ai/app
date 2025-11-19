// Ensure dev email skip is enabled before importing modules that read env at load
process.env.SKIP_EMAIL = 'true';
process.env.NODE_ENV = 'test';

import { describe, it, expect } from 'vitest';
import { inviteUser } from '../../server/services/inviteService';

describe('inviteUser service', () => {
  it('returns sanitized result and does not expose password fields', async () => {
    const inviter = {
      userId: 'test-inviter',
      role: 'owner',
      tenantId: null,
      isPlatformAdmin: true,
      email: 'admin@embellics.com',
    };

    const payload = {
      email: `test-invite-${Date.now()}@example.com`,
      firstName: 'Test',
      lastName: 'Invite',
      role: 'admin',
    };

    const result = await inviteUser(inviter as any, payload as any);

    expect(result).toHaveProperty('invitation');
    const inv = result.invitation;

    // Must include safe metadata
    expect(inv).toHaveProperty('id');
    expect(inv).toHaveProperty('email', payload.email);

    // Must NOT include password fields
    expect(inv).not.toHaveProperty('plainTemporaryPassword');
    expect(inv).not.toHaveProperty('temporaryPassword');
    expect(result).not.toHaveProperty('plainTemporaryPassword');

    // emailSent flag should exist (dev mode skips sending but inviteService should still return a flag)
    expect(result).toHaveProperty('emailSent');
  });
});
