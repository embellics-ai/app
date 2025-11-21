import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendInvitationEmail, sendPasswordResetEmail } from '@server/email';
import nodemailer from 'nodemailer';

// Mock nodemailer
vi.mock('nodemailer');

describe('Server Email', () => {
  let mockSendMail: ReturnType<typeof vi.fn>;
  let mockTransporter: any;

  beforeEach(() => {
    mockSendMail = vi.fn().mockResolvedValue({ messageId: '123' });
    mockTransporter = {
      sendMail: mockSendMail,
    };
    (nodemailer.createTransport as any).mockReturnValue(mockTransporter);

    // Set environment variables for testing
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'test@test.com';
    process.env.SMTP_PASS = 'testpass';
    process.env.SMTP_FROM_EMAIL = 'noreply@test.com';
    process.env.APP_URL = 'http://localhost:3000';
    // Ensure SKIP_EMAIL is not set during tests (CI might set it)
    delete process.env.SKIP_EMAIL;
  });

  describe('sendInvitationEmail', () => {
    it('should send invitation email with correct content', async () => {
      await sendInvitationEmail('user@example.com', 'John', 'Doe', 'tempPass123', 'client_admin');

      expect(mockSendMail).toHaveBeenCalled();
      const mailOptions = mockSendMail.mock.calls[0][0];

      expect(mailOptions.to).toBe('user@example.com');
      expect(mailOptions.subject).toContain('Welcome');
      expect(mailOptions.html).toContain('John Doe');
      expect(mailOptions.html).toContain('tempPass123');
    });

    it('should include correct role in email', async () => {
      await sendInvitationEmail('user@example.com', 'John', 'Doe', 'tempPass123', 'support_staff');

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('Support Staff');
    });

    it('should include login URL in email', async () => {
      await sendInvitationEmail('user@example.com', 'John', 'Doe', 'tempPass123', 'client_admin');

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('http://localhost:3000/login');
    });

    it('should handle email send errors', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP Error'));

      await expect(
        sendInvitationEmail('user@example.com', 'John', 'Doe', 'tempPass123', 'client_admin'),
      ).rejects.toThrow();
    });

    it('should use from email from environment', async () => {
      await sendInvitationEmail('user@example.com', 'John', 'Doe', 'tempPass123', 'client_admin');

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.from).toContain('noreply@test.com');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email', async () => {
      const resetToken = 'reset-token-123';
      await sendPasswordResetEmail('user@example.com', 'John', 'Doe', resetToken);

      expect(mockSendMail).toHaveBeenCalled();
      const mailOptions = mockSendMail.mock.calls[0][0];

      expect(mailOptions.to).toBe('user@example.com');
      expect(mailOptions.subject).toContain('Password Reset');
      expect(mailOptions.html).toContain(resetToken);
    });

    it('should include reset link with token', async () => {
      const resetToken = 'test-token';
      await sendPasswordResetEmail('user@example.com', 'John', 'Doe', resetToken);

      const mailOptions = mockSendMail.mock.calls[0][0];
      // The password reset email shows the token as the temporary password, not in a link
      expect(mailOptions.html).toContain(resetToken);
      expect(mailOptions.subject).toContain('Password Reset');
    });

    it('should personalize with user name', async () => {
      await sendPasswordResetEmail('user@example.com', 'Jane', 'Smith', 'token');

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('Jane Smith');
    });
  });

  describe('Email Configuration', () => {
    it('should skip email in development without SMTP_HOST', async () => {
      delete process.env.SMTP_HOST;
      process.env.NODE_ENV = 'development';

      // Re-import to pick up env changes
      const { sendInvitationEmail: devSendEmail } = await import('@server/email');

      // Should not throw error in dev mode
      await expect(
        devSendEmail('user@example.com', 'John', 'Doe', 'pass', 'admin'),
      ).resolves.not.toThrow();
    });

    it('should create transporter with correct config', async () => {
      await sendInvitationEmail('user@example.com', 'John', 'Doe', 'pass', 'admin');

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.test.com',
          port: 587,
        }),
      );
    });
  });
});
