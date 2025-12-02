import type { Express, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import {
  insertMessageSchema,
  insertConversationSchema,
  insertClientUserSchema,
  insertWidgetConfigSchema,
  safeWidgetConfigCreateSchema,
  safeWidgetConfigUpdateSchema,
  insertApiKeySchema,
  insertHumanAgentSchema,
} from '@shared/schema';
import { z } from 'zod';
import Retell from 'retell-sdk';
import { randomBytes, createHash } from 'crypto';
import { sendInvitationEmail, sendPasswordResetEmail } from './email';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import {
  encrypt,
  decrypt,
  encryptWhatsAppConfig,
  decryptWhatsAppConfig,
  encryptSMSConfig,
  decryptSMSConfig,
  maskWhatsAppConfig,
  maskSMSConfig,
  maskToken,
  type WhatsAppConfig,
  type SMSConfig,
} from './encryption';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  type JWTPayload,
  type AuthenticatedRequest,
  requireAuth,
  requirePlatformAdmin,
  requireClientAdmin,
  requireSupportStaff,
  requireClientOrSupport,
  assertTenant,
} from './auth';
import { inviteUser } from './services/inviteService';
import { registerClient, broadcastToTenant } from './websocket';
import type { WebSocket } from 'ws';

/**
 * Escapes a string for safe insertion into a single-quoted JavaScript string literal.
 * Prevents injection attacks by escaping both backslashes and single quotes.
 * @param str - The string to escape
 * @returns The escaped string safe for use in JavaScript code
 */
function escapeJsString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// NOTE: The system uses tenant-specific Retell Agent IDs from widget_configs.retellAgentId
// Platform Admins configure these via: PATCH /api/platform/tenants/:tenantId/retell-api-key
// No hardcoded agent IDs are used - each tenant has their own agent configuration

// In-memory storage for widget test tokens (platform admin only)
interface WidgetTestTokenData {
  tenantId: string;
  createdAt: Date;
  createdBy?: string;
}
const widgetTestTokens = new Map<string, WidgetTestTokenData>();

export async function registerRoutes(app: Express): Promise<void> {
  // SECURITY: Cleanup expired invitation passwords on startup
  try {
    const cleanedCount = await storage.cleanupExpiredInvitationPasswords();
    if (cleanedCount > 0) {
      console.log(
        `[Server Startup] Cleaned up ${cleanedCount} expired plaintext passwords from invitations`,
      );
    }
  } catch (error) {
    console.error('[Server Startup] Failed to cleanup invitation passwords:', error);
  }

  // ===== Authentication Endpoints =====

  // NOTE: This is an invitation-only platform
  // No public registration allowed - users must be invited by platform admins

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const loginSchema = z.object({
        email: z.string().email(),
        password: z.string(),
      });

      const { email, password } = loginSchema.parse(req.body);

      // STEP 1: Check if user already exists
      let user = await storage.getClientUserByEmail(email);

      // STEP 2: If user doesn't exist, check for pending invitation
      if (!user) {
        const pendingInvitation = await storage.getPendingInvitationByEmail(email);

        if (pendingInvitation) {
          // Verify password matches temporary password
          const isValidTempPassword = await verifyPassword(
            password,
            pendingInvitation.temporaryPassword,
          );

          if (!isValidTempPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }

          // STEP 3: Create user account from invitation
          let tenantId: string | null = pendingInvitation.tenantId;

          // For client_admin: Create tenant and widget config if needed
          if (pendingInvitation.role === 'client_admin') {
            // Only create a new tenant if invitation doesn't already have one
            if (!tenantId) {
              if (!pendingInvitation.companyName) {
                console.error('Missing company name in invitation:', pendingInvitation.id);
                return res.status(400).json({
                  error: 'Invalid invitation data. Please contact support.',
                });
              }

              // Create tenant using invitation email as tenant contact
              const newTenant = await storage.createTenant({
                name: pendingInvitation.companyName,
                email: pendingInvitation.email,
                phone: pendingInvitation.companyPhone || null,
                plan: 'free',
                status: 'active',
              });

              tenantId = newTenant.id;
              console.log(`Created new tenant for first client_admin: ${tenantId}`);
            } else {
              console.log(`Using existing tenant from invitation: ${tenantId}`);
            }

            // Create widget config only if one doesn't already exist for this tenant
            const existingWidgetConfig = await storage.getWidgetConfig(tenantId);
            if (!existingWidgetConfig) {
              const companyName = pendingInvitation.companyName || 'Your Company';
              await storage.createWidgetConfig({
                tenantId: tenantId,
                greeting: 'Hi! How can I help you today?',
                retellApiKey: null, // Platform admin will set this later
                retellAgentId: null, // Platform admin will set this later
              });

              console.log(`Created default widget config for tenant: ${tenantId}`);
            } else {
              console.log(`Widget config already exists for tenant: ${tenantId}`);
            }
          }

          // Create user account from invitation (first login using temporary password)
          // Hash the provided temporary password and create the user record.
          const hashedPassword = await hashPassword(password);

          user = await storage.createClientUser({
            email: pendingInvitation.email,
            password: hashedPassword,
            firstName: pendingInvitation.firstName,
            lastName: pendingInvitation.lastName,
            tenantId: tenantId,
            role: pendingInvitation.role,
            isPlatformAdmin:
              pendingInvitation.role === 'owner' || pendingInvitation.role === 'admin',
            phoneNumber: pendingInvitation.phoneNumber || null,
            mustChangePassword: true, // Force password change on first login with temp password
          });

          // Mark the invitation as used and clear plaintext immediately
          await storage.markInvitationUsed(pendingInvitation.id);

          // Mark onboarding as complete for new user
          if (!user.onboardingCompleted) {
            await storage.updateClientUser(user.id, {
              onboardingCompleted: true,
            });
            user.onboardingCompleted = true;
            console.log(`[Login] Marked onboarding complete for new user: ${user.email}`);
          }

          // Auto-create human_agents record for support staff AND client admins on first login
          // This allows client admins to also handle chats for small teams
          if ((user.role === 'support_staff' || user.role === 'client_admin') && user.tenantId) {
            try {
              const agentName =
                user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email!.split('@')[0];

              await storage.createHumanAgent(
                {
                  name: agentName,
                  email: user.email!,
                  status: 'available',
                  activeChats: 0,
                  maxChats: 5,
                },
                user.tenantId,
              );

              console.log(`[Login] Created human agent record for new ${user.role}: ${user.email}`);
            } catch (agentError) {
              console.error('[Login] Failed to create agent record:', agentError);
              // Don't fail login if agent creation fails - just log it
            }
          }

          // Generate JWT token and return same shape as normal login
          const token = generateToken({
            userId: user.id,
            tenantId: user.tenantId,
            email: user.email,
            role: user.role,
            isPlatformAdmin: user.isPlatformAdmin,
          });

          return res.json({
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              tenantId: user.tenantId,
              isPlatformAdmin: user.isPlatformAdmin,
              onboardingCompleted: user.onboardingCompleted,
              mustChangePassword: user.mustChangePassword, // Use dedicated field from database
            },
          });
        }
      }

      // If user still not found after checking invitations, deny access
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password for existing user
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Mark onboarding as complete on successful login (if not already)
      if (!user.onboardingCompleted) {
        await storage.updateClientUser(user.id, {
          onboardingCompleted: true,
        });
        user.onboardingCompleted = true;
        console.log(`[Login] Marked onboarding complete for user: ${user.email}`);
      }

      // Auto-create human_agents record for support staff AND client admins on first login
      // This allows client admins to also handle chats for small teams
      if ((user.role === 'support_staff' || user.role === 'client_admin') && user.tenantId) {
        const agents = await storage.getHumanAgentsByTenant(user.tenantId);
        const agentExists = agents.some((a) => a.email === user.email);

        if (!agentExists) {
          try {
            const agentName =
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email!.split('@')[0];

            await storage.createHumanAgent(
              {
                name: agentName,
                email: user.email!,
                status: 'available',
                activeChats: 0,
                maxChats: 5,
              },
              user.tenantId,
            );

            console.log(`[Login] Created human agent record for ${user.role}: ${user.email}`);
          } catch (agentError) {
            console.error('[Login] Failed to create agent record:', agentError);
            // Don't fail login if agent creation fails - just log it
          }
        } else {
          // Agent exists - ALWAYS update status to 'available' and last_seen on login
          try {
            const agent = agents.find((a) => a.email === user.email);
            if (agent) {
              await storage.updateHumanAgentStatus(agent.id, 'available', user.tenantId);
              await storage.updateAgentLastSeen(agent.id, user.tenantId);
              console.log(
                `[Login] Updated agent status to 'available' and last_seen: ${user.email}`,
              );
            }
          } catch (statusError) {
            console.error('[Login] Failed to update agent status:', statusError);
          }
        }
      }

      // Generate JWT token for existing user
      const token = generateToken({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin,
      });

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          isPlatformAdmin: user.isPlatformAdmin,
          onboardingCompleted: user.onboardingCompleted,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Login failed' });
      }
    }
  });

  // Get current user (uses requireAuth middleware)
  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const isPlatformAdmin = req.user!.isPlatformAdmin;
      const tokenTenantId = req.user!.tenantId;

      // Get fresh user data by ID
      const user = await storage.getClientUser(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found or invalid session' });
      }

      // For platform admins: tenantId can be null
      // For regular users: tenantId must match token
      if (!isPlatformAdmin && user.tenantId !== tokenTenantId) {
        return res.status(401).json({ error: 'Tenant mismatch - invalid session' });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        isPlatformAdmin: user.isPlatformAdmin,
        onboardingCompleted: user.onboardingCompleted,
        mustChangePassword: user.mustChangePassword, // Use dedicated field instead of deriving from onboarding
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  });

  // Heartbeat - update last_seen timestamp to track active sessions
  app.post('/api/auth/heartbeat', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;

      if (
        user &&
        user.tenantId &&
        (user.role === 'support_staff' || user.role === 'client_admin')
      ) {
        const agents = await storage.getHumanAgentsByTenant(user.tenantId);
        const agent = agents.find((a) => a.email === user.email);

        if (agent) {
          // Update last_seen timestamp
          await storage.updateAgentLastSeen(agent.id, user.tenantId);

          // Ensure status is 'available' (update if not already)
          if (agent.status !== 'available') {
            await storage.updateHumanAgentStatus(agent.id, 'available', user.tenantId);
            console.log(`[Heartbeat] Updated ${user.email} status to 'available'`);
          }
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('[Heartbeat] Error:', error);
      res.status(500).json({ error: 'Heartbeat failed' });
    }
  });

  // Logout - update agent status to offline
  app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;
      if (
        user &&
        user.tenantId &&
        (user.role === 'support_staff' || user.role === 'client_admin')
      ) {
        // Get agent record and update status to offline
        const agents = await storage.getHumanAgentsByTenant(user.tenantId);
        const agent = agents.find((a) => a.email === user.email);

        if (agent) {
          await storage.updateHumanAgentStatus(agent.id, 'offline', user.tenantId);
          await storage.updateAgentLastSeen(agent.id, user.tenantId);
          console.log(`[Logout] Updated agent status to 'offline' and last_seen: ${user.email}`);
        }
      }
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('[Logout] Error updating agent status:', error);
      // Don't fail logout even if status update fails
      res.json({ message: 'Logged out successfully' });
    }
  });

  // Complete onboarding (PROTECTED)
  app.post('/api/auth/complete-onboarding', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      const isPlatformAdmin = req.user!.isPlatformAdmin;

      // Platform admins don't have a tenantId - that's okay
      // Client admins and support staff should have a tenantId
      if (!isPlatformAdmin) {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;
      }

      await storage.markOnboardingComplete(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  });

  // Change password (any authenticated user)
  app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;

      const changePasswordSchema = z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(8, 'New password must be at least 8 characters'),
      });

      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      // Get current user
      const user = await storage.getClientUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password and update
      const hashedNewPassword = await hashPassword(newPassword);
      await storage.updateClientUserPassword(userId, hashedNewPassword);

      // Clear mustChangePassword flag (keep onboardingCompleted unchanged - it's managed separately)
      if (user.mustChangePassword) {
        await storage.updateClientUser(userId, { mustChangePassword: false });
      }

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to change password' });
      }
    }
  });

  // ===== Password Reset Routes (User-Initiated) =====

  // Request password reset (Public - user enters email)
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
      });

      const { email } = schema.parse(req.body);

      // Find user by email
      const user = await storage.getClientUserByEmail(email);

      console.log(
        `[Forgot Password] Request for email: ${email}, User found: ${user ? `Yes (ID: ${user.id}, Role: ${user.role})` : 'No'}`,
      );

      // SECURITY: Always return success even if user doesn't exist (prevent email enumeration)
      if (!user) {
        console.log(`[Forgot Password] Email not found: ${email}`);
        return res.json({
          message: 'If an account exists with this email, a password reset link has been sent.',
        });
      }

      // Generate secure random token
      const resetToken = randomBytes(32).toString('hex');
      const tokenHash = await hashPassword(resetToken); // Hash the token before storing
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      // Create password reset token (store hashed token)
      await storage.createPasswordResetToken({
        userId: user.id,
        token: tokenHash,
        expiresAt,
        used: false,
      });

      // Send password reset email
      const baseUrl = process.env.APP_URL || 'http://localhost:5000';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Import and use sendForgotPasswordEmail function
      const { sendForgotPasswordEmail } = await import('./email');

      try {
        await sendForgotPasswordEmail(
          user.email,
          user.firstName || 'User',
          user.lastName || '',
          resetUrl,
        );
        console.log(`[Forgot Password] Reset email sent to: ${email}`);
      } catch (emailError) {
        console.error('[Forgot Password] Failed to send email:', emailError);
        // Still return success to user (don't reveal email sending failures)
      }

      // SECURITY: Always return generic success message
      res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to process password reset request' });
      }
    }
  });

  // Reset password with token (Public)
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8, 'Password must be at least 8 characters'),
      });

      const { token, newPassword } = schema.parse(req.body);

      // Get ALL unexpired, unused reset tokens for verification
      const allTokens = await storage.getAllUnexpiredResetTokens();

      // Find matching token by comparing hashed values
      let matchedToken = null;
      for (const storedToken of allTokens) {
        const isMatch = await verifyPassword(token, storedToken.token);
        if (isMatch) {
          matchedToken = storedToken;
          break;
        }
      }

      if (!matchedToken) {
        return res.status(400).json({
          error: 'Invalid or expired reset link. Please request a new one.',
        });
      }

      // Check if token is already used
      if (matchedToken.used) {
        return res.status(400).json({
          error: 'Invalid or expired reset link. Please request a new one.',
        });
      }

      console.log(`[Reset Password] Token matched for userID: ${matchedToken.userId}`);

      // Mark token as used BEFORE updating password (prevents race conditions)
      await storage.markTokenAsUsedById(matchedToken.id);

      // Hash new password and update user
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateClientUserPassword(matchedToken.userId, hashedPassword);

      // Mark onboarding as complete if it wasn't already (in case of temp password reset)
      const user = await storage.getClientUser(matchedToken.userId);
      if (user) {
        console.log(
          `[Reset Password] User after password update - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, TenantID: ${user.tenantId}`,
        );
        if (!user.onboardingCompleted) {
          await storage.updateClientUser(matchedToken.userId, {
            onboardingCompleted: true,
          });
        }

        // Auto-create human_agents record for support staff AND client admins after password reset
        // This allows client admins to also handle chats for small teams
        if ((user.role === 'support_staff' || user.role === 'client_admin') && user.tenantId) {
          try {
            const agents = await storage.getHumanAgentsByTenant(user.tenantId);
            const agentExists = agents.some((a) => a.email === user.email);

            if (!agentExists) {
              const agentName =
                user.firstName && user.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user.email!.split('@')[0];

              await storage.createHumanAgent(
                {
                  name: agentName,
                  email: user.email!,
                  status: 'available',
                  activeChats: 0,
                  maxChats: 5,
                },
                user.tenantId,
              );

              console.log(
                `[Reset Password] Created human agent record for ${user.role}: ${user.email}`,
              );
            }
          } catch (agentError) {
            console.error('[Reset Password] Failed to create agent record:', agentError);
            // Don't fail password reset if agent creation fails
          }
        }
      }

      console.log(`[Reset Password] Password successfully reset for user: ${matchedToken.userId}`);

      res.json({
        message: 'Password reset successfully. You can now login with your new password.',
      });
    } catch (error) {
      console.error('Reset password error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to reset password' });
      }
    }
  });

  // ===== Platform Admin User Management Routes =====

  // Invite a new user (Platform Admin only)
  // NEW INVITATION FLOW: Creates pending invitation, sends email, user account created on first login
  app.post(
    '/api/platform/invite-user',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Security: Platform admins can only create 'admin' and 'client_admin' roles
        // Support staff cannot be created by platform admins
        const invitationSchema = z.object({
          email: z.string().email(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          role: z.enum(['admin', 'client_admin']),
          // Optional: Invite to existing tenant (for additional admins)
          tenantId: z.string().optional(),
          // Client onboarding fields (required for new client_admin tenants)
          companyName: z.string().optional(),
          companyPhone: z.string().optional(),
        });

        const data = invitationSchema.parse(req.body);

        // Delegate invite creation to centralized invite service
        try {
          const inviter = {
            userId: req.user!.userId,
            role: req.user!.role,
            tenantId: req.user!.tenantId,
            isPlatformAdmin: req.user!.isPlatformAdmin,
            email: req.user!.email,
          };

          const payload = {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            tenantId: data.tenantId ?? null,
            companyName: data.companyName ?? null,
            companyPhone: data.companyPhone ?? null,
          };

          const result = await inviteUser(inviter, payload);

          // Return service result directly (invitation metadata + email flags)
          return res.json(result);
        } catch (serviceErr) {
          console.error('Error creating invitation via inviteService:', serviceErr);
          if (serviceErr instanceof z.ZodError) {
            return res.status(400).json({ error: serviceErr.errors });
          }
          // inviteUser throws HttpError for 4xx cases
          if (serviceErr instanceof Error && (serviceErr as any).status) {
            const s = (serviceErr as any).status;
            return res.status(s).json({ error: serviceErr.message });
          }
          return res.status(500).json({ error: 'Failed to create invitation' });
        }
      } catch (error) {
        console.error('Error inviting user:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to create invitation' });
        }
      }
    },
  );

  // Get all pending invitations (Platform Admin only)
  app.get(
    '/api/platform/invitations/pending',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const invitations = await storage.getPendingInvitations();

        // Return invitation list
        // Note: plainTemporaryPassword is only returned for platform owner (admin@embellics.com)
        const isOwner = req.user!.email === 'admin@embellics.com';

        const sanitizedInvitations = invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          firstName: inv.firstName,
          lastName: inv.lastName,
          role: inv.role,
          status: inv.status,
          companyName: inv.companyName || null,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          lastSentAt: inv.lastSentAt || null,
          // Note: plaintext temporary passwords are no longer returned by the API for security
        }));

        res.json(sanitizedInvitations);
      } catch (error) {
        console.error('Error fetching pending invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
      }
    },
  );

  // Delete a pending invitation (Platform Admin only)
  app.delete(
    '/api/platform/invitations/:invitationId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { invitationId } = req.params;

        console.log(`[Delete Invitation] Deleting invitation: ${invitationId}`);

        // Delete the invitation from database
        await storage.deleteInvitation(invitationId);

        console.log(`[Delete Invitation] ✓ Successfully deleted invitation: ${invitationId}`);

        res.json({ message: 'Invitation deleted successfully' });
      } catch (error) {
        console.error('Error deleting invitation:', error);
        res.status(500).json({ error: 'Failed to delete invitation' });
      }
    },
  );

  // ================== Tenant Routes ==================

  // Get tenant by ID (authenticated users can access their own tenant, platform admins can access any)
  app.get('/api/tenants/:tenantId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { tenantId } = req.params;
      const userId = req.user!.userId;
      const isPlatformAdmin = req.user!.isPlatformAdmin;
      const userTenantId = req.user!.tenantId;

      // Platform admins can access any tenant, regular users can only access their own
      if (!isPlatformAdmin && userTenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Return basic tenant information (no sensitive data like API keys)
      res.json({
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        plan: tenant.plan,
        status: tenant.status,
      });
    } catch (error) {
      console.error('Get tenant error:', error);
      res.status(500).json({ error: 'Failed to fetch tenant information' });
    }
  });

  // ================== Platform Admin Routes ==================

  // Get all users (Platform Admin only)
  // Get all tenants (Platform Admin only)
  app.get(
    '/api/platform/tenants',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenants = await storage.getAllTenants();

        // Get widget configs to check if Retell API key is set
        const tenantsWithApiKeyStatus = await Promise.all(
          tenants.map(async (tenant) => {
            const widgetConfig = await storage.getWidgetConfig(tenant.id);

            // Mask the Retell API key (show prefix + 8 chars after underscore + asterisks)
            let maskedRetellApiKey = null;
            if (widgetConfig?.retellApiKey) {
              // Find the underscore position and show 8 chars after it
              const underscoreIndex = widgetConfig.retellApiKey.indexOf('_');
              if (
                underscoreIndex !== -1 &&
                widgetConfig.retellApiKey.length > underscoreIndex + 8
              ) {
                const visiblePart = widgetConfig.retellApiKey.substring(0, underscoreIndex + 9); // prefix + _ + 8 chars
                maskedRetellApiKey = `${visiblePart}********`;
              } else {
                // Fallback if format is unexpected
                maskedRetellApiKey = `${widgetConfig.retellApiKey.substring(0, 12)}********`;
              }
            }

            // Mask the Agent ID (show prefix + 8 chars after underscore + asterisks)
            let maskedAgentId = null;
            if (widgetConfig?.retellAgentId) {
              // Find the underscore position and show 8 chars after it
              const underscoreIndex = widgetConfig.retellAgentId.indexOf('_');
              if (
                underscoreIndex !== -1 &&
                widgetConfig.retellAgentId.length > underscoreIndex + 8
              ) {
                const visiblePart = widgetConfig.retellAgentId.substring(0, underscoreIndex + 9); // prefix + _ + 8 chars
                maskedAgentId = `${visiblePart}********`;
              } else {
                // Fallback if format is unexpected
                maskedAgentId = `${widgetConfig.retellAgentId.substring(0, 12)}********`;
              }
            }

            // Mask WhatsApp Agent ID if configured
            let maskedWhatsappAgentId = '';
            if (widgetConfig?.whatsappAgentId) {
              const underscoreIndex = widgetConfig.whatsappAgentId.indexOf('_');
              if (
                underscoreIndex !== -1 &&
                widgetConfig.whatsappAgentId.length > underscoreIndex + 8
              ) {
                const visiblePart = widgetConfig.whatsappAgentId.substring(0, underscoreIndex + 9);
                maskedWhatsappAgentId = `${visiblePart}********`;
              } else {
                // Fallback if format is unexpected
                maskedWhatsappAgentId = `${widgetConfig.whatsappAgentId.substring(0, 12)}********`;
              }
            }

            return {
              id: tenant.id,
              name: tenant.name,
              email: tenant.email,
              phone: tenant.phone,
              plan: tenant.plan,
              status: tenant.status,
              hasRetellApiKey: !!widgetConfig?.retellApiKey,
              hasRetellAgentId: !!widgetConfig?.retellAgentId,
              hasWhatsappAgentId: !!widgetConfig?.whatsappAgentId,
              retellApiKey: maskedRetellApiKey, // For backward compatibility
              retellAgentId: widgetConfig?.retellAgentId || null, // Full agent ID for widget testing
              maskedRetellApiKey,
              maskedAgentId,
              maskedWhatsappAgentId,
              createdAt: tenant.createdAt,
            };
          }),
        );

        res.json(tenantsWithApiKeyStatus);
      } catch (error) {
        console.error('Error fetching tenants:', error);
        res.status(500).json({ error: 'Failed to fetch tenants' });
      }
    },
  );

  // Update tenant's Retell API Key (Platform Admin only)
  app.patch(
    '/api/platform/tenants/:tenantId/retell-api-key',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { retellApiKey, retellAgentId, whatsappAgentId } = req.body;

        // Validate Retell API key format if provided
        if (retellApiKey && retellApiKey !== '__KEEP_EXISTING__') {
          if (typeof retellApiKey !== 'string') {
            return res.status(400).json({ error: 'Retell API key must be a string' });
          }

          if (!retellApiKey.trim().startsWith('key_')) {
            return res.status(400).json({
              error: 'Invalid Retell API key format. API keys must start with "key_"',
            });
          }
        }

        // Validate Retell Agent ID format if provided (for widget chat)
        if (retellAgentId) {
          if (typeof retellAgentId !== 'string') {
            return res.status(400).json({ error: 'Retell Agent ID must be a string' });
          }

          if (!retellAgentId.trim().startsWith('agent_')) {
            return res.status(400).json({
              error:
                'Invalid Retell Agent ID format. Agent IDs must start with "agent_". Did you accidentally provide an API key instead?',
            });
          }
        }

        // Validate WhatsApp Agent ID format if provided
        if (whatsappAgentId) {
          if (typeof whatsappAgentId !== 'string') {
            return res.status(400).json({ error: 'WhatsApp Agent ID must be a string' });
          }

          if (!whatsappAgentId.trim().startsWith('agent_')) {
            return res.status(400).json({
              error:
                'Invalid WhatsApp Agent ID format. Agent IDs must start with "agent_". Did you accidentally provide an API key instead?',
            });
          }
        }

        // Check if tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Get or create widget config for this tenant
        let widgetConfig = await storage.getWidgetConfig(tenantId);

        const updateData: any = {};

        // Only update API key if provided and not the sentinel value
        if (retellApiKey && retellApiKey.trim() !== '__KEEP_EXISTING__') {
          updateData.retellApiKey = retellApiKey.trim();
        }

        // Include retellAgentId (widget chat agent) if provided and not empty
        if (retellAgentId && retellAgentId.trim()) {
          updateData.retellAgentId = retellAgentId.trim();
        }

        // Include whatsappAgentId if provided and not empty
        if (whatsappAgentId && whatsappAgentId.trim()) {
          updateData.whatsappAgentId = whatsappAgentId.trim();
        }

        // Check if we have anything to update
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            error: 'No updates provided. Please provide API key, Agent ID, or WhatsApp Agent ID.',
          });
        }

        if (!widgetConfig) {
          // Create a new widget config - must have actual API key
          if (!updateData.retellApiKey) {
            return res
              .status(400)
              .json({ error: 'Retell API key is required for new configuration' });
          }
          widgetConfig = await storage.createWidgetConfig({
            tenantId,
            ...updateData,
          });
        } else {
          // Update existing widget config (only provided fields)
          widgetConfig = await storage.updateWidgetConfig(tenantId, updateData);
        }

        if (!widgetConfig) {
          return res.status(500).json({ error: 'Failed to update Retell API key' });
        }

        res.json({
          message: 'Retell API key updated successfully',
          tenantId,
        });
      } catch (error) {
        console.error('Error updating Retell API key:', error);
        res.status(500).json({ error: 'Failed to update Retell API key' });
      }
    },
  );

  // Delete tenant (Platform Admin only)
  app.delete(
    '/api/platform/tenants/:tenantId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        console.log(`[Delete Tenant] Attempting to delete tenant: ${tenantId}`);

        // Get tenant info before deletion for logging
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Get all client admins for this tenant
        const allUsers = await storage.getAllUsers();
        const tenantClientAdmins = allUsers.filter(
          (user) => user.tenantId === tenantId && user.role === 'client_admin',
        );

        console.log(
          `[Delete Tenant] Found ${tenantClientAdmins.length} client admin(s) in tenant ${tenant.name}`,
        );

        // Delete all client admins (and their support staff) in this tenant
        for (const clientAdmin of tenantClientAdmins) {
          console.log(
            `[Delete Tenant] Deleting client admin and associated data: ${clientAdmin.email}`,
          );
          await storage.deleteClientUser(clientAdmin.id);
        }

        // Delete the tenant itself (cascade deletes widget config, API keys, etc.)
        console.log(`[Delete Tenant] Deleting tenant: ${tenant.name}`);
        await storage.deleteTenant(tenantId);

        console.log(
          `[Delete Tenant] ✓ Successfully deleted tenant: ${tenant.name} and all associated data`,
        );

        res.json({
          message: 'Tenant deleted successfully',
          tenantId,
          tenantName: tenant.name,
        });
      } catch (error) {
        console.error('Error deleting tenant:', error);
        res.status(500).json({ error: 'Failed to delete tenant' });
      }
    },
  );

  app.get(
    '/api/platform/users',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const users = await storage.getAllUsers();

        // Platform admins should only see client_admin users, not support_staff
        const filteredUsers = users.filter(
          (user) => user.role === 'client_admin' || user.role === 'owner' || user.isPlatformAdmin,
        );

        // Don't send password hashes
        const sanitizedUsers = filteredUsers.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          isPlatformAdmin: user.isPlatformAdmin,
          phoneNumber: user.phoneNumber,
          onboardingCompleted: user.onboardingCompleted,
          createdAt: user.createdAt,
        }));

        res.json(sanitizedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
      }
    },
  );

  // Delete client user (Platform Admin only - can only delete client_admin users)
  app.delete(
    '/api/platform/users/:userId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId } = req.params;
        const { securityAnswer } = req.body; // Optional security answer for platform owner protection

        // Get the user to verify they can be deleted
        const userToDelete = await storage.getClientUser(userId);

        if (!userToDelete) {
          return res.status(404).json({ error: 'User not found' });
        }

        // CRITICAL PROTECTION: Platform owner (admin@embellics.com) requires security answer
        // Security Question: "What is the platform owner's secret code?"
        if (userToDelete.email === 'admin@embellics.com') {
          const PLATFORM_OWNER_SECRET_HASH =
            '$2b$10$r7pAnFXszmmfGqk64LIg4uz5iLZTdR0u2golXK5MRNtGO785zhYhe'; // "Embellics2025!"

          if (!securityAnswer) {
            return res.status(403).json({
              error: 'Platform owner account is protected. Security answer required.',
              securityQuestion: "What is the platform owner's secret code?",
            });
          }

          const validSecurityAnswer = await verifyPassword(
            securityAnswer,
            PLATFORM_OWNER_SECRET_HASH,
          );
          if (!validSecurityAnswer) {
            return res.status(403).json({
              error: 'Incorrect security answer. Platform owner account cannot be deleted.',
              securityQuestion: "What is the platform owner's secret code?",
            });
          }

          // Valid security answer provided - allow deletion to proceed
          await storage.deleteClientUser(userId);
          return res.json({
            message: 'Platform owner account deleted successfully',
          });
        }

        // Platform admins can only delete client_admin users (not platform admins)
        if (userToDelete.isPlatformAdmin) {
          return res.status(403).json({ error: 'Cannot delete platform admin users' });
        }

        // Only allow deleting client_admin users
        if (userToDelete.role !== 'client_admin' && userToDelete.role !== 'owner') {
          return res.status(403).json({
            error: 'Can only delete client admin users from this endpoint',
          });
        }

        console.log(`[Delete User] Deleting user: ${userToDelete.email} (ID: ${userId})`);

        // Delete the user's tenant if they have one (cascade delete for client admins)
        if (userToDelete.tenantId) {
          console.log(`[Delete User] Deleting associated tenant: ${userToDelete.tenantId}`);
          await storage.deleteTenant(userToDelete.tenantId);
        }

        // Delete the user from database (cascade deletes invitations)
        await storage.deleteClientUser(userId);

        console.log(
          `[Delete User] ✓ Successfully deleted user: ${userToDelete.email}, tenant, and associated invitations`,
        );

        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
      }
    },
  );

  // Reset user password (Platform Owner only - admin@embellics.com)
  app.post(
    '/api/platform/users/:userId/reset-password',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { userId } = req.params;

        // SECURITY: Only platform owner can reset passwords
        if (req.user!.email !== 'admin@embellics.com') {
          return res.status(403).json({ error: 'Only platform owner can reset passwords' });
        }

        const user = await storage.getClientUser(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Generate new temporary password
        const tempPassword = randomBytes(8).toString('hex');
        const hashedPassword = await hashPassword(tempPassword);

        // Update user password and mark onboarding as incomplete (force password change)
        await storage.updateClientUserPassword(userId, hashedPassword);
        await storage.updateClientUser(userId, { onboardingCompleted: false });

        // Send password reset email
        let emailSent = false;
        try {
          await sendPasswordResetEmail(
            user.email,
            user.firstName || 'User',
            user.lastName || '',
            tempPassword,
          );
          console.log(`Password reset email sent to ${user.email}`);
          emailSent = true;
        } catch (emailError) {
          console.error('Failed to send password reset email:', emailError);
          // Don't fail the whole request if email fails
        }

        res.json({
          message: 'Password reset successfully',
          email: user.email,
          emailSent,
        });
      } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
      }
    },
  );

  // Get active invitations (Platform Admin only)
  app.get(
    '/api/platform/invitations',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const invitations = await storage.getActiveInvitations();
        // Sanitize invitations before returning to avoid leaking any password fields
        const sanitizedInvitations = invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          firstName: inv.firstName,
          lastName: inv.lastName,
          role: inv.role,
          status: inv.status,
          tenantId: inv.tenantId ?? null,
          companyName: inv.companyName ?? null,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          lastSentAt: inv.lastSentAt || null,
          invitedBy: inv.invitedBy || null,
        }));

        res.json(sanitizedInvitations);
      } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
      }
    },
  );

  // Cleanup expired invitation passwords (Platform Admin only)
  app.post(
    '/api/platform/invitations/cleanup-passwords',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const cleanedCount = await storage.cleanupExpiredInvitationPasswords();
        console.log(`[Password Cleanup] Cleaned up ${cleanedCount} expired plaintext passwords`);
        res.json({
          message: 'Password cleanup completed',
          cleanedCount,
        });
      } catch (error) {
        console.error('Error cleaning up invitation passwords:', error);
        res.status(500).json({ error: 'Failed to cleanup passwords' });
      }
    },
  );

  // Widget Test Page (Platform Admin only)
  app.get(
    '/api/platform/widget-test-page',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.query;

        if (!tenantId) {
          return res.status(400).send('Tenant ID is required. Please select a tenant to test.');
        }

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId as string);

        if (!tenant) {
          return res.status(404).send('Tenant not found');
        }

        // Get widget configuration for this tenant
        const widgetConfig = await storage.getWidgetConfig(tenantId as string);

        if (!widgetConfig || !widgetConfig.retellAgentId) {
          return res.status(400).send(`
            <html>
              <head><title>Widget Not Configured</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1>⚠️ Widget Not Configured</h1>
                <p>The tenant "${tenant.name}" does not have a widget configured.</p>
                <p>Please configure the Retell Agent ID in the Platform Admin panel first.</p>
                <a href="/widget-test" style="color: #667eea;">← Back to Widget Test</a>
              </body>
            </html>
          `);
        }

        // Get the HTML file path - try multiple locations for dev/prod
        let htmlPath = path.join(__dirname, '../client/public/widget-test.html');

        // If not found, try from project root
        if (!fs.existsSync(htmlPath)) {
          htmlPath = path.join(process.cwd(), 'client/public/widget-test.html');
        }

        // Read the HTML file
        if (!fs.existsSync(htmlPath)) {
          console.error('[Widget Test] HTML file not found. Tried paths:', {
            path1: path.join(__dirname, '../client/public/widget-test.html'),
            path2: path.join(process.cwd(), 'client/public/widget-test.html'),
            __dirname,
            cwd: process.cwd(),
          });
          return res.status(404).send('Widget test page not found');
        }

        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        // Generate a one-time test token for platform admin widget testing
        // This token will be valid for this specific test session
        const testToken = `test_${randomBytes(32).toString('hex')}`;

        // Store the test token in module-level Map
        widgetTestTokens.set(testToken, {
          tenantId: tenantId as string,
          createdAt: new Date(),
          createdBy: req.user?.email,
        });

        // Clean up old tokens (older than 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        Array.from(widgetTestTokens.entries()).forEach(([token, data]) => {
          if (data.createdAt < oneHourAgo) {
            widgetTestTokens.delete(token);
          }
        });

        // Inject tenant information and widget script into HTML
        // Use X-Forwarded-Proto if available (for proxies/load balancers like Render)
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const widgetScriptUrl = `${protocol}://${req.get('host')}/widget.js`;
        const tenantInfo = `
          <script>
            // Tenant configuration
            window.WIDGET_TEST_CONFIG = {
              tenantId: '${tenantId}',
              tenantName: '${escapeJsString(tenant.name)}',
              agentId: '${widgetConfig.retellAgentId}',
              testMode: true,
            };
            
            // Update page with tenant info
            document.addEventListener('DOMContentLoaded', () => {
              const tenantNameEl = document.getElementById('tenant-name');
              const agentIdEl = document.getElementById('agent-id');
              
              if (tenantNameEl) tenantNameEl.textContent = '${escapeJsString(tenant.name)}';
              if (agentIdEl) agentIdEl.textContent = '${widgetConfig.retellAgentId}';
              
              // Update status after widget loads
              setTimeout(() => {
                const statusEl = document.getElementById('widget-status');
                if (statusEl) {
                  statusEl.textContent = '✅ Widget loaded successfully! Look for the chat bubble in the bottom-right corner.';
                  statusEl.style.color = '#28a745';
                }
              }, 1000);
            });
          </script>
          
          <!-- Embellics Chat Widget -->
          <script src="${widgetScriptUrl}" data-api-key="${testToken}"></script>
        `;

        // Insert tenant info and scripts before closing </body> tag
        htmlContent = htmlContent.replace('</body>', `${tenantInfo}</body>`);

        // Log access for security audit
        console.log(
          `[Widget Test] Platform admin ${req.user?.email} accessed widget test page for tenant: ${tenant.name} (${tenantId})`,
        );

        // Send HTML with proper content type
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
      } catch (error) {
        console.error('Error serving widget test page:', error);
        res.status(500).send('Failed to load widget test page');
      }
    },
  );

  // Update user role (Platform Admin only)
  app.patch(
    '/api/users/:id/role',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { id } = req.params;
        const updateSchema = z.object({
          role: z.enum(['owner', 'admin', 'client_admin', 'support_staff']),
          isPlatformAdmin: z.boolean().optional(),
        });

        const data = updateSchema.parse(req.body);
        await storage.updateUserRole(id, data.role, data.isPlatformAdmin ?? false);

        res.json({ success: true, message: 'User role updated successfully' });
      } catch (error) {
        console.error('Error updating user role:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to update user role' });
        }
      }
    },
  );

  // ===== Platform Admin - Tenant Integrations Management =====

  // Get integration configuration for a tenant
  app.get(
    '/api/platform/tenants/:tenantId/integrations',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Get integration config
        const integration = await storage.getTenantIntegration(tenantId);

        if (!integration) {
          // Return empty/default config if not yet configured
          return res.json({
            tenantId,
            whatsappEnabled: false,
            whatsappConfig: null,
            smsEnabled: false,
            smsConfig: null,
            n8nBaseUrl: null,
          });
        }

        // Decrypt and mask sensitive fields before sending to frontend
        const maskedIntegration = {
          id: integration.id,
          tenantId: integration.tenantId,
          n8nBaseUrl: integration.n8nBaseUrl,
          n8nApiKey: integration.n8nApiKey ? maskToken(integration.n8nApiKey) : null,
          whatsappEnabled: integration.whatsappEnabled,
          whatsappConfig: integration.whatsappConfig
            ? maskWhatsAppConfig(decryptWhatsAppConfig(integration.whatsappConfig as any))
            : null,
          smsEnabled: integration.smsEnabled,
          smsConfig: integration.smsConfig
            ? maskSMSConfig(decryptSMSConfig(integration.smsConfig as any))
            : null,
          updatedAt: integration.updatedAt,
          createdAt: integration.createdAt,
        };

        res.json(maskedIntegration);
      } catch (error) {
        console.error('Error fetching tenant integrations:', error);
        res.status(500).json({ error: 'Failed to fetch integration configuration' });
      }
    },
  );

  // Update WhatsApp configuration for a tenant
  app.put(
    '/api/platform/tenants/:tenantId/integrations/whatsapp',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Validate WhatsApp config
        const whatsappConfigSchema = z.object({
          enabled: z.boolean(),
          phoneNumberId: z.string().min(1).optional(),
          businessAccountId: z.string().min(1).optional(),
          accessToken: z.string().min(1).optional(),
          webhookVerifyToken: z.string().min(1).optional(),
          phoneNumber: z.string().optional(),
        });

        const data = whatsappConfigSchema.parse(req.body);

        // Get or create integration config
        let integration = await storage.getTenantIntegration(tenantId);

        if (!data.enabled) {
          // Disable WhatsApp
          if (integration) {
            await storage.updateTenantIntegration(tenantId, {
              whatsappEnabled: false,
              whatsappConfig: null,
              updatedBy: req.user!.userId,
            });
          } else {
            await storage.createTenantIntegration({
              tenantId,
              whatsappEnabled: false,
              whatsappConfig: null,
              createdBy: req.user!.userId,
              updatedBy: req.user!.userId,
            });
          }
          return res.json({ success: true, message: 'WhatsApp integration disabled' });
        }

        // Validate required fields when enabling
        if (
          !data.phoneNumberId ||
          !data.businessAccountId ||
          !data.accessToken ||
          !data.webhookVerifyToken
        ) {
          return res.status(400).json({
            error: 'All WhatsApp fields are required when enabling integration',
          });
        }

        // Create WhatsApp config object
        const whatsappConfig: WhatsAppConfig = {
          phoneNumberId: data.phoneNumberId,
          businessAccountId: data.businessAccountId,
          accessToken: data.accessToken,
          webhookVerifyToken: data.webhookVerifyToken,
          phoneNumber: data.phoneNumber,
        };

        // Encrypt sensitive fields
        const encryptedConfig = encryptWhatsAppConfig(whatsappConfig);

        if (integration) {
          // Update existing
          await storage.updateTenantIntegration(tenantId, {
            whatsappEnabled: true,
            whatsappConfig: encryptedConfig as any,
            updatedBy: req.user!.userId,
          });
        } else {
          // Create new
          await storage.createTenantIntegration({
            tenantId,
            whatsappEnabled: true,
            whatsappConfig: encryptedConfig as any,
            createdBy: req.user!.userId,
            updatedBy: req.user!.userId,
          });
        }

        res.json({ success: true, message: 'WhatsApp integration configured successfully' });
      } catch (error) {
        console.error('Error configuring WhatsApp integration:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to configure WhatsApp integration' });
        }
      }
    },
  );

  // Update SMS configuration for a tenant
  app.put(
    '/api/platform/tenants/:tenantId/integrations/sms',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Validate SMS config
        const smsConfigSchema = z.object({
          enabled: z.boolean(),
          provider: z.enum(['twilio', 'vonage', 'aws_sns']).optional(),
          accountSid: z.string().min(1).optional(),
          authToken: z.string().min(1).optional(),
          phoneNumber: z.string().min(1).optional(),
          messagingServiceSid: z.string().optional(),
        });

        const data = smsConfigSchema.parse(req.body);

        // Get or create integration config
        let integration = await storage.getTenantIntegration(tenantId);

        if (!data.enabled) {
          // Disable SMS
          if (integration) {
            await storage.updateTenantIntegration(tenantId, {
              smsEnabled: false,
              smsConfig: null,
              updatedBy: req.user!.userId,
            });
          } else {
            await storage.createTenantIntegration({
              tenantId,
              smsEnabled: false,
              smsConfig: null,
              createdBy: req.user!.userId,
              updatedBy: req.user!.userId,
            });
          }
          return res.json({ success: true, message: 'SMS integration disabled' });
        }

        // Validate required fields when enabling
        if (!data.provider || !data.accountSid || !data.authToken || !data.phoneNumber) {
          return res.status(400).json({
            error:
              'Provider, accountSid, authToken, and phoneNumber are required when enabling SMS',
          });
        }

        // Create SMS config object
        const smsConfig: SMSConfig = {
          provider: data.provider,
          accountSid: data.accountSid,
          authToken: data.authToken,
          phoneNumber: data.phoneNumber,
          messagingServiceSid: data.messagingServiceSid,
        };

        // Encrypt sensitive fields
        const encryptedConfig = encryptSMSConfig(smsConfig);

        if (integration) {
          // Update existing
          await storage.updateTenantIntegration(tenantId, {
            smsEnabled: true,
            smsConfig: encryptedConfig as any,
            updatedBy: req.user!.userId,
          });
        } else {
          // Create new
          await storage.createTenantIntegration({
            tenantId,
            smsEnabled: true,
            smsConfig: encryptedConfig as any,
            createdBy: req.user!.userId,
            updatedBy: req.user!.userId,
          });
        }

        res.json({ success: true, message: 'SMS integration configured successfully' });
      } catch (error) {
        console.error('Error configuring SMS integration:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to configure SMS integration' });
        }
      }
    },
  );

  // Update N8N base URL for a tenant
  app.put(
    '/api/platform/tenants/:tenantId/integrations/n8n',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Validate N8N config
        const n8nConfigSchema = z.object({
          baseUrl: z.string().url().optional().nullable(),
          apiKey: z.string().optional().nullable(),
        });

        const data = n8nConfigSchema.parse(req.body);

        // Get or create integration config
        let integration = await storage.getTenantIntegration(tenantId);

        const updates: any = {
          n8nBaseUrl: data.baseUrl || null,
          updatedBy: req.user!.userId,
        };

        // Encrypt API key if provided
        if (data.apiKey) {
          updates.n8nApiKey = encrypt(data.apiKey);
        } else if (data.apiKey === null) {
          updates.n8nApiKey = null;
        }

        if (integration) {
          await storage.updateTenantIntegration(tenantId, updates);
        } else {
          await storage.createTenantIntegration({
            tenantId,
            ...updates,
            createdBy: req.user!.userId,
          });
        }

        res.json({ success: true, message: 'N8N configuration updated successfully' });
      } catch (error) {
        console.error('Error configuring N8N integration:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to configure N8N integration' });
        }
      }
    },
  );

  // Get all N8N webhooks for a tenant
  app.get(
    '/api/platform/tenants/:tenantId/webhooks',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        const webhooks = await storage.getN8nWebhooksByTenant(tenantId);

        // Mask auth tokens
        const maskedWebhooks = webhooks.map((webhook) => ({
          ...webhook,
          authToken: webhook.authToken ? maskToken(webhook.authToken) : null,
        }));

        res.json(maskedWebhooks);
      } catch (error) {
        console.error('Error fetching webhooks:', error);
        res.status(500).json({ error: 'Failed to fetch webhooks' });
      }
    },
  );

  // Create a new N8N webhook
  app.post(
    '/api/platform/tenants/:tenantId/webhooks',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Validate webhook data
        const webhookSchema = z.object({
          workflowName: z.string().min(1),
          webhookUrl: z.string().url(),
          description: z.string().optional(),
          isActive: z.boolean().default(true),
          authToken: z.string().optional(),
          webhookType: z.enum(['event_listener', 'function_call']).default('event_listener'),
          eventType: z.string().optional(),
          functionName: z.string().optional(),
          responseTimeout: z.number().min(1000).max(30000).optional(),
          retryOnFailure: z.boolean().optional(),
        });

        const data = webhookSchema.parse(req.body);

        // Check for duplicate workflow name
        const existing = await storage.getN8nWebhookByName(tenantId, data.workflowName);
        if (existing) {
          return res.status(400).json({
            error: `Webhook with workflow name "${data.workflowName}" already exists for this tenant`,
          });
        }

        // Encrypt auth token if provided
        const webhookData: any = {
          tenantId,
          workflowName: data.workflowName,
          webhookUrl: data.webhookUrl,
          description: data.description || null,
          isActive: data.isActive,
          authToken: data.authToken ? encrypt(data.authToken) : null,
          webhookType: data.webhookType,
          eventType: data.eventType || null,
          functionName: data.functionName || null,
          responseTimeout: data.responseTimeout || null,
          retryOnFailure: data.retryOnFailure ?? false,
          createdBy: req.user!.userId,
        };

        const webhook = await storage.createN8nWebhook(webhookData);

        res.status(201).json({
          ...webhook,
          authToken: webhook.authToken ? maskToken(webhook.authToken) : null,
        });
      } catch (error) {
        console.error('Error creating webhook:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to create webhook' });
        }
      }
    },
  );

  // Update an N8N webhook
  app.put(
    '/api/platform/tenants/:tenantId/webhooks/:webhookId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId, webhookId } = req.params;

        // Verify webhook exists and belongs to tenant
        const webhook = await storage.getN8nWebhook(webhookId);
        if (!webhook || webhook.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Webhook not found' });
        }

        // Validate update data
        const webhookUpdateSchema = z.object({
          workflowName: z.string().min(1).optional(),
          webhookUrl: z.string().url().optional(),
          description: z.string().optional().nullable(),
          isActive: z.boolean().optional(),
          authToken: z.string().optional().nullable(),
          webhookType: z.enum(['event_listener', 'function_call']).optional(),
          eventType: z.string().optional().nullable(),
          functionName: z.string().optional().nullable(),
          responseTimeout: z.number().min(1000).max(30000).optional().nullable(),
          retryOnFailure: z.boolean().optional(),
        });

        const data = webhookUpdateSchema.parse(req.body);

        // Check for duplicate workflow name if changing
        if (data.workflowName && data.workflowName !== webhook.workflowName) {
          const existing = await storage.getN8nWebhookByName(tenantId, data.workflowName);
          if (existing) {
            return res.status(400).json({
              error: `Webhook with workflow name "${data.workflowName}" already exists for this tenant`,
            });
          }
        }

        const updates: any = { ...data };

        // Encrypt auth token if provided
        if (data.authToken !== undefined) {
          updates.authToken = data.authToken ? encrypt(data.authToken) : null;
        }

        const updated = await storage.updateN8nWebhook(webhookId, updates);

        res.json({
          ...updated,
          authToken: updated?.authToken ? maskToken(updated.authToken) : null,
        });
      } catch (error) {
        console.error('Error updating webhook:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to update webhook' });
        }
      }
    },
  );

  // Delete an N8N webhook
  app.delete(
    '/api/platform/tenants/:tenantId/webhooks/:webhookId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId, webhookId } = req.params;

        // Verify webhook exists and belongs to tenant
        const webhook = await storage.getN8nWebhook(webhookId);
        if (!webhook || webhook.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Webhook not found' });
        }

        await storage.deleteN8nWebhook(webhookId, tenantId);

        res.json({ success: true, message: 'Webhook deleted successfully' });
      } catch (error) {
        console.error('Error deleting webhook:', error);
        res.status(500).json({ error: 'Failed to delete webhook' });
      }
    },
  );

  // Get webhook analytics summary for a tenant
  app.get(
    '/api/platform/tenants/:tenantId/webhooks/analytics/summary',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate } = req.query;

        // Verify tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const summary = await storage.getWebhookAnalyticsSummary(tenantId, start, end);

        res.json(summary);
      } catch (error) {
        console.error('Error fetching webhook analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
      }
    },
  );

  // Get detailed analytics for a specific webhook
  app.get(
    '/api/platform/tenants/:tenantId/webhooks/:webhookId/analytics',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId, webhookId } = req.params;
        const { limit } = req.query;

        // Verify webhook exists and belongs to tenant
        const webhook = await storage.getN8nWebhook(webhookId);
        if (!webhook || webhook.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Webhook not found' });
        }

        const analytics = await storage.getWebhookAnalytics(
          webhookId,
          limit ? parseInt(limit as string) : undefined,
        );

        res.json(analytics);
      } catch (error) {
        console.error('Error fetching webhook analytics:', error);
        res.status(500).json({ error: 'Failed to fetch webhook analytics' });
      }
    },
  );

  // ============================================
  // RETELL AI FUNCTION PROXY
  // ============================================

  /**
   * Function Proxy Endpoint
   * Routes Retell AI custom function calls to tenant-specific N8N workflows
   * Public endpoint - no auth, but requires valid agent_id in request
   *
   * Usage: Configure in Retell agent as custom function URL:
   * https://your-domain.com/api/functions/{functionName}
   */
  app.post('/api/functions/:functionName', async (req, res) => {
    const startTime = Date.now();
    const { functionName } = req.params;

    try {
      console.log('[Function Proxy] Function called:', functionName);
      console.log('[Function Proxy] Request body:', JSON.stringify(req.body, null, 2));

      // Extract agent_id from request (Retell sends this in the function call)
      const { agent_id, call_id, args } = req.body;

      if (!agent_id) {
        console.error('[Function Proxy] Missing agent_id in request');
        return res.status(400).json({
          error: 'agent_id is required',
          message: 'Retell must send agent_id with function calls',
        });
      }

      // Lookup tenant from agent configuration
      const widgetConfig = await storage.getWidgetConfigByAgentId(agent_id);
      if (!widgetConfig) {
        console.error('[Function Proxy] No widget config found for agent_id:', agent_id);
        return res.status(404).json({
          error: 'Agent not found',
          message: 'No configuration found for this agent',
        });
      }

      const tenantId = widgetConfig.tenantId;
      console.log('[Function Proxy] Resolved tenant:', tenantId);

      // Get tenant details for enrichment
      const tenant = await storage.getTenant(tenantId);

      // Lookup N8N webhook configured for this function
      const webhook = await storage.getWebhookByFunction(tenantId, functionName);
      if (!webhook) {
        console.error(
          '[Function Proxy] No webhook configured for function:',
          functionName,
          'tenant:',
          tenantId,
        );
        return res.status(404).json({
          error: 'Function not configured',
          message: `No N8N webhook configured for function: ${functionName}`,
        });
      }

      console.log('[Function Proxy] Routing to workflow:', webhook.workflowName);

      // Enrich payload with tenant context for N8N
      const enrichedPayload = {
        function: functionName,
        tenant: {
          id: tenantId,
          name: tenant?.name || 'Unknown',
        },
        call: {
          id: call_id,
          agent_id: agent_id,
        },
        args: args || {},
        timestamp: new Date().toISOString(),
        originalPayload: req.body,
      };

      // Set up request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add auth token if configured
      if (webhook.authToken) {
        headers['Authorization'] = `Bearer ${webhook.authToken}`;
      }

      // Forward to N8N with timeout
      const timeout = webhook.responseTimeout || 10000; // Default 10s
      console.log('[Function Proxy] Forwarding with timeout (ms):', timeout);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(enrichedPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        console.log('[Function Proxy] Response received in (ms):', duration);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Function Proxy] N8N returned status:', response.status, errorText);
          await storage.incrementWebhookStats(webhook.id, false);

          return res.status(response.status).json({
            error: 'Function execution failed',
            message: errorText || `N8N webhook returned ${response.status}`,
          });
        }

        // Parse N8N response
        const n8nResponse = await response.json();
        console.log('[Function Proxy] N8N response:', JSON.stringify(n8nResponse, null, 2));

        // Update success statistics
        await storage.incrementWebhookStats(webhook.id, true);

        // Return N8N response to Retell
        // N8N should return the data in the format Retell expects for the function
        res.json(n8nResponse);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (fetchError.name === 'AbortError') {
          console.error('[Function Proxy] Timeout after (ms):', duration);
          await storage.incrementWebhookStats(webhook.id, false);

          return res.status(504).json({
            error: 'Function timeout',
            message: `N8N workflow did not respond within ${timeout}ms`,
          });
        }

        console.error('[Function Proxy] Fetch error:', fetchError.message);
        await storage.incrementWebhookStats(webhook.id, false);

        return res.status(502).json({
          error: 'Function execution error',
          message: fetchError.message,
        });
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('[Function Proxy] Error after (ms):', duration, error);

      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

  // ============================================
  // RETELL AI WEBHOOKS
  // ============================================

  /**
   * Retell AI Chat Analyzed Webhook
   * Receives chat_analyzed events from Retell AI and stores analytics
   * Public endpoint - no authentication, but signature verification
   */
  app.post('/api/retell/chat-analyzed', async (req, res) => {
    try {
      const signature = req.headers['x-retell-signature'] as string;

      // TODO: Implement signature verification
      // For now, we'll accept all requests (add verification in production)
      // const isValid = verifyRetellSignature(req.body, signature, process.env.RETELL_WEBHOOK_SECRET);
      // if (!isValid) {
      //   return res.status(401).json({ error: 'Invalid signature' });
      // }

      const payload = req.body;

      // Retell sends data nested under "chat" object
      const chat = payload.chat || payload;

      // Extract data from Retell's chat_analyzed event
      const startTimestamp = chat.start_timestamp ? new Date(chat.start_timestamp) : null;
      const endTimestamp = chat.end_timestamp ? new Date(chat.end_timestamp) : null;

      // Calculate duration in seconds if not provided by Retell
      let duration = chat.duration || null;
      if (!duration && startTimestamp && endTimestamp) {
        duration = Math.round((endTimestamp.getTime() - startTimestamp.getTime()) / 1000);
      }

      const chatData = {
        chatId: chat.chat_id,
        agentId: chat.agent_id,
        agentName: chat.agent_name || null,
        agentVersion: chat.agent_version || null,
        chatType: chat.chat_type || null,
        chatStatus: chat.chat_status || null,
        startTimestamp,
        endTimestamp,
        duration,
        messageCount: chat.messages?.length || 0,
        toolCallsCount: chat.tool_calls?.length || 0,
        dynamicVariables: chat.collected_dynamic_variables || chat.dynamic_variables || null,
        userSentiment: chat.chat_analysis?.user_sentiment || null,
        chatSuccessful: chat.chat_analysis?.chat_successful || null,
        combinedCost: chat.cost_analysis?.combined || 0,
        productCosts: chat.cost_analysis?.product_costs || null,
        metadata: {
          whatsapp_user: chat.metadata?.whatsapp_user || null,
          // Add any other metadata fields
          ...chat.metadata,
        },
      };

      // Determine tenant ID from metadata or by looking up the agent configuration
      let tenantId = chat.metadata?.tenant_id || payload.tenant_id;

      if (!tenantId && chatData.agentId) {
        // Try to find tenant by agent ID (useful for WhatsApp and other integrations)
        const widgetConfig = await storage.getWidgetConfigByAgentId(chatData.agentId);
        if (widgetConfig) {
          tenantId = widgetConfig.tenantId;
        }
      }

      if (!tenantId) {
        console.error(
          '[Retell Webhook] Could not determine tenant_id from payload or agent configuration',
        );
        return res.status(400).json({
          error:
            'Could not determine tenant_id. Include tenant_id in metadata or configure agent in system.',
        });
      }

      // Create chat analytics record
      const createdAnalytics = await storage.createChatAnalytics({
        tenantId,
        ...chatData,
      });

      // Optionally store individual messages
      if (payload.messages && Array.isArray(payload.messages)) {
        // This is optional - can be enabled based on requirements
        // for (const message of payload.messages) {
        //   await storage.createChatMessage({
        //     chatAnalyticsId: chatAnalytics.id,
        //     messageId: message.message_id,
        //     role: message.role,
        //     content: message.content,
        //     timestamp: new Date(message.timestamp),
        //     toolCallId: message.tool_call_id || null,
        //     nodeTransition: message.node_transition || null,
        //   });
        // }
      }

      // Forward to tenant-specific N8N webhooks configured for this event
      const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'chat_analyzed');

      if (eventWebhooks.length > 0) {
        console.log(`[Retell Webhook] Forwarding to ${eventWebhooks.length} N8N webhook(s)`);

        // Get tenant name for enrichment
        const tenant = await storage.getTenant(tenantId);

        // Enrich payload with tenant context for N8N
        const enrichedPayload = {
          event: 'chat_analyzed',
          tenant: {
            id: tenantId,
            name: tenant?.name || 'Unknown',
          },
          chat: chatData,
          analytics: {
            id: createdAnalytics.id,
            chatId: createdAnalytics.chatId,
            agentId: createdAnalytics.agentId,
          },
          timestamp: new Date().toISOString(),
          originalPayload: payload,
        };

        // Forward to all configured webhooks (parallel execution)
        const forwardPromises = eventWebhooks.map(async (webhook) => {
          try {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };

            // Add auth token if configured
            if (webhook.authToken) {
              headers['Authorization'] = `Bearer ${webhook.authToken}`;
            }

            const response = await fetch(webhook.webhookUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(enrichedPayload),
              signal: AbortSignal.timeout(30000), // 30s timeout for event listeners
            });

            if (response.ok) {
              console.log(`[Retell Webhook] ✓ Forwarded to ${webhook.workflowName}`);
              await storage.incrementWebhookStats(webhook.id, true);
            } else {
              const errorText = await response.text();
              console.error(
                `[Retell Webhook] ✗ ${webhook.workflowName} returned ${response.status}:`,
                errorText,
              );
              await storage.incrementWebhookStats(webhook.id, false);
            }
          } catch (forwardError: any) {
            console.error(
              `[Retell Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
              forwardError.message,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        });

        // Wait for all forwards to complete (don't block response to Retell)
        await Promise.allSettled(forwardPromises);
      }

      res.status(200).json({ success: true, message: 'Chat analytics stored' });
    } catch (error: any) {
      console.error('[Retell Webhook] Error processing chat_analyzed event:', error);
      res.status(500).json({ error: 'Failed to process chat analytics', details: error.message });
    }
  });

  // Retell AI voice call.ended webhook
  app.post('/api/retell/call-ended', async (req, res) => {
    try {
      const signature = req.headers['x-retell-signature'] as string;

      // TODO: Implement signature verification
      // For now, we'll accept all requests (add verification in production)

      const payload = req.body;

      // DEBUG: Log full payload to understand what Retell sends
      console.log('[Retell Voice Webhook] === FULL PAYLOAD DEBUG ===');
      console.log(JSON.stringify(payload, null, 2));
      console.log('[Retell Voice Webhook] === END PAYLOAD ===');

      // Retell sends data nested under "call" object
      const call = payload.call || payload;

      // Extract data from Retell's call.ended event (mirrors chat structure)
      const startTimestamp = call.start_timestamp ? new Date(call.start_timestamp) : null;
      const endTimestamp = call.end_timestamp ? new Date(call.end_timestamp) : null;

      // Calculate duration in seconds if not provided by Retell
      let duration = call.duration || null;
      if (!duration && startTimestamp && endTimestamp) {
        duration = Math.round((endTimestamp.getTime() - startTimestamp.getTime()) / 1000);
      }

      const callData = {
        callId: call.call_id,
        agentId: call.agent_id,
        agentName: call.agent_name || null,
        agentVersion: call.agent_version || null,
        callType: call.call_type || null,
        callStatus: call.call_status || call.disconnect_reason || null,
        startTimestamp,
        endTimestamp,
        duration,
        messageCount: call.transcript?.length || call.messages?.length || 0,
        toolCallsCount: call.tool_calls?.length || 0,
        dynamicVariables: call.collected_dynamic_variables || call.dynamic_variables || null,
        userSentiment: call.call_analysis?.user_sentiment || null,
        callSuccessful: call.call_analysis?.call_successful || null,
        combinedCost: call.cost_analysis?.combined || 0,
        productCosts: call.cost_analysis?.product_costs || null,
        metadata: {
          disconnect_reason: call.disconnect_reason || null,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
          // Add any other metadata fields
          ...call.metadata,
        },
      };

      // Determine tenant ID from metadata or by looking up the agent configuration
      let tenantId = call.metadata?.tenant_id || payload.tenant_id;

      if (!tenantId && callData.agentId) {
        // Try to find tenant by agent ID
        console.log(
          '[Retell Voice Webhook] No tenant_id in metadata, looking up by agent ID:',
          callData.agentId,
        );
        const widgetConfig = await storage.getWidgetConfigByAgentId(callData.agentId);
        if (widgetConfig) {
          tenantId = widgetConfig.tenantId;
          console.log('[Retell Voice Webhook] Found tenant from agent ID:', tenantId);
        }
      }

      if (!tenantId) {
        console.error(
          '[Retell Voice Webhook] Could not determine tenant_id from payload or agent configuration',
        );
        console.error('[Retell Voice Webhook] Payload metadata:', payload.metadata);
        console.error('[Retell Voice Webhook] Agent ID:', callData.agentId);
        return res.status(400).json({
          error:
            'Could not determine tenant_id. Include tenant_id in metadata or configure agent in system.',
        });
      }

      console.log(
        `[Retell Voice Webhook] Processing voice analytics for tenant ${tenantId}, call ${callData.callId}`,
      );

      console.log('[Retell Voice Webhook] Extracted call data:', {
        callId: callData.callId,
        startTimestamp: callData.startTimestamp,
        endTimestamp: callData.endTimestamp,
        duration: callData.duration,
      });

      // Create voice analytics record
      const createdAnalytics = await storage.createVoiceAnalytics({
        tenantId,
        ...callData,
      });

      console.log('[Retell Voice Webhook] Voice analytics created successfully:', {
        id: createdAnalytics.id,
        tenantId: createdAnalytics.tenantId,
        callId: createdAnalytics.callId,
        agentId: createdAnalytics.agentId,
        startTimestamp: createdAnalytics.startTimestamp,
        endTimestamp: createdAnalytics.endTimestamp,
        duration: createdAnalytics.duration,
      });

      console.log(`[Retell Voice Webhook] Stored voice analytics for call ${callData.callId}`);

      // Forward to tenant-specific N8N webhooks configured for this event
      const eventWebhooks = await storage.getWebhooksByEvent(tenantId, 'call_analyzed');

      if (eventWebhooks.length > 0) {
        console.log(`[Retell Voice Webhook] Forwarding to ${eventWebhooks.length} N8N webhook(s)`);

        // Get tenant name for enrichment
        const tenant = await storage.getTenant(tenantId);

        // Enrich payload with tenant context for N8N
        const enrichedPayload = {
          event: 'call_analyzed',
          tenant: {
            id: tenantId,
            name: tenant?.name || 'Unknown',
          },
          call: callData,
          analytics: {
            id: createdAnalytics.id,
            callId: createdAnalytics.callId,
            agentId: createdAnalytics.agentId,
          },
          timestamp: new Date().toISOString(),
          originalPayload: payload,
        };

        // Forward to all configured webhooks (parallel execution)
        const forwardPromises = eventWebhooks.map(async (webhook) => {
          try {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };

            // Add auth token if configured
            if (webhook.authToken) {
              headers['Authorization'] = `Bearer ${webhook.authToken}`;
            }

            const response = await fetch(webhook.webhookUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(enrichedPayload),
              signal: AbortSignal.timeout(30000), // 30s timeout for event listeners
            });

            if (response.ok) {
              console.log(`[Retell Voice Webhook] ✓ Forwarded to ${webhook.workflowName}`);
              await storage.incrementWebhookStats(webhook.id, true);
            } else {
              const errorText = await response.text();
              console.error(
                `[Retell Voice Webhook] ✗ ${webhook.workflowName} returned ${response.status}:`,
                errorText,
              );
              await storage.incrementWebhookStats(webhook.id, false);
            }
          } catch (forwardError: any) {
            console.error(
              `[Retell Voice Webhook] ✗ Error forwarding to ${webhook.workflowName}:`,
              forwardError.message,
            );
            await storage.incrementWebhookStats(webhook.id, false);
          }
        });

        // Wait for all forwards to complete (don't block response to Retell)
        await Promise.allSettled(forwardPromises);
      }

      res.status(200).json({ success: true, message: 'Voice analytics stored' });
    } catch (error: any) {
      console.error('[Retell Voice Webhook] Error processing call.ended event:', error);
      res.status(500).json({ error: 'Failed to process voice analytics', details: error.message });
    }
  });

  // ============================================
  // CHAT ANALYTICS API ENDPOINTS (Platform Admin)
  // ============================================

  /**
   * Get combined analytics overview (voice + chat)
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/overview',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate, agentId } = req.query;

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          agentId: agentId as string | undefined,
        };

        // Get chat analytics summary
        const chatSummary = await storage.getChatAnalyticsSummary(tenantId, filters);

        // Get voice analytics summary
        const voiceSummary = await storage.getVoiceAnalyticsSummary(tenantId, filters);

        res.json({
          chat: chatSummary,
          voice: voiceSummary,
          combined: {
            totalInteractions: chatSummary.totalChats + voiceSummary.totalCalls,
            totalCost: chatSummary.totalCost + voiceSummary.totalCost,
            averageCost:
              chatSummary.totalChats + voiceSummary.totalCalls > 0
                ? (chatSummary.totalCost + voiceSummary.totalCost) /
                  (chatSummary.totalChats + voiceSummary.totalCalls)
                : 0,
          },
        });
      } catch (error) {
        console.error('Error fetching analytics overview:', error);
        res.status(500).json({ error: 'Failed to fetch analytics overview' });
      }
    },
  );

  /**
   * Get list of chat sessions with filters
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/chats',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate, agentId, sentiment, chatStatus, limit } = req.query;

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          agentId: agentId as string | undefined,
          sentiment: sentiment as string | undefined,
          chatStatus: chatStatus as string | undefined,
          limit: limit ? parseInt(limit as string) : 100,
        };

        const chats = await storage.getChatAnalyticsByTenant(tenantId, filters);

        res.json(chats);
      } catch (error) {
        console.error('Error fetching chat analytics:', error);
        res.status(500).json({ error: 'Failed to fetch chat analytics' });
      }
    },
  );

  /**
   * Get time-series chat analytics for visualizations
   * IMPORTANT: This must come BEFORE the /:chatId route
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/chats/time-series',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate, agentId, groupBy } = req.query;

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          agentId: agentId as string | undefined,
          groupBy: (groupBy as 'hour' | 'day' | 'week') || 'day',
        };

        const timeSeriesData = await storage.getChatAnalyticsTimeSeries(tenantId, filters);

        res.json(timeSeriesData);
      } catch (error) {
        console.error('Error fetching time-series chat analytics:', error);
        res.status(500).json({ error: 'Failed to fetch time-series analytics' });
      }
    },
  );

  /**
   * Get agent breakdown for chat analytics
   * IMPORTANT: This must come BEFORE the /:chatId route
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/chats/agent-breakdown',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate } = req.query;

        console.log('[Analytics Agent Breakdown] Querying for tenant:', tenantId);

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
        };

        const agentBreakdown = await storage.getChatAnalyticsAgentBreakdown(tenantId, filters);

        console.log('[Analytics Agent Breakdown] Returning data:', {
          agentCount: agentBreakdown.length,
        });

        res.json(agentBreakdown);
      } catch (error) {
        console.error('Error fetching agent breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch agent breakdown' });
      }
    },
  );

  /**
   * Get detailed analytics for a specific chat session
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/chats/:chatId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId, chatId } = req.params;

        const chat = await storage.getChatAnalytics(chatId);

        if (!chat || chat.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Chat not found' });
        }

        // Optionally get individual messages
        const messages = await storage.getChatMessages(chatId);

        res.json({
          ...chat,
          messages,
        });
      } catch (error) {
        console.error('Error fetching chat details:', error);
        res.status(500).json({ error: 'Failed to fetch chat details' });
      }
    },
  );

  /**
   * Get sentiment analysis breakdown
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/sentiment',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate, agentId } = req.query;

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          agentId: agentId as string | undefined,
        };

        const summary = await storage.getChatAnalyticsSummary(tenantId, filters);

        res.json({
          sentimentBreakdown: summary.sentimentBreakdown,
          totalChats: summary.totalChats,
          successRate:
            summary.totalChats > 0 ? (summary.successfulChats / summary.totalChats) * 100 : 0,
        });
      } catch (error) {
        console.error('Error fetching sentiment analytics:', error);
        res.status(500).json({ error: 'Failed to fetch sentiment analytics' });
      }
    },
  );

  /**
   * Get cost tracking analytics
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/costs',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate, agentId } = req.query;

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          agentId: agentId as string | undefined,
        };

        const summary = await storage.getChatAnalyticsSummary(tenantId, filters);

        // Get individual chats for cost breakdown by day
        const chats = await storage.getChatAnalyticsByTenant(tenantId, filters);

        // Group costs by day
        const costsByDay: Record<string, number> = {};
        chats.forEach((chat) => {
          if (chat.startTimestamp) {
            const day = chat.startTimestamp.toISOString().split('T')[0];
            costsByDay[day] = (costsByDay[day] || 0) + (chat.combinedCost || 0);
          }
        });

        res.json({
          totalCost: summary.totalCost,
          averageCost: summary.averageCost,
          totalChats: summary.totalChats,
          costsByDay,
        });
      } catch (error) {
        console.error('Error fetching cost analytics:', error);
        res.status(500).json({ error: 'Failed to fetch cost analytics' });
      }
    },
  );

  // ============================================
  // VOICE ANALYTICS API ENDPOINTS (Platform Admin)
  // ============================================

  /**
   * Get list of voice call sessions with filters
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/calls',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;
        const { startDate, endDate, agentId, sentiment, callStatus, limit } = req.query;

        console.log('[Analytics Calls] Querying for tenant:', tenantId);
        console.log('[Analytics Calls] Filters:', {
          startDate,
          endDate,
          agentId,
          sentiment,
          callStatus,
          limit,
        });

        const filters = {
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          agentId: agentId as string | undefined,
          sentiment: sentiment as string | undefined,
          callStatus: callStatus as string | undefined,
          limit: limit ? parseInt(limit as string) : 100,
        };

        const calls = await storage.getVoiceAnalyticsByTenant(tenantId, filters);

        console.log('[Analytics Calls] Found calls:', calls.length);
        if (calls.length > 0) {
          console.log('[Analytics Calls] First call sample:', {
            id: calls[0].id,
            tenantId: calls[0].tenantId,
            callId: calls[0].callId,
            agentId: calls[0].agentId,
          });
        }

        res.json(calls);
      } catch (error) {
        console.error('Error fetching voice analytics:', error);
        res.status(500).json({ error: 'Failed to fetch voice analytics' });
      }
    },
  );

  /**
   * Get detailed analytics for a specific voice call
   */
  app.get(
    '/api/platform/tenants/:tenantId/analytics/calls/:callId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId, callId } = req.params;

        const call = await storage.getVoiceAnalytics(callId);

        if (!call || call.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Call not found' });
        }

        res.json(call);
      } catch (error) {
        console.error('Error fetching call details:', error);
        res.status(500).json({ error: 'Failed to fetch call details' });
      }
    },
  );

  // ===== Client Admin User Management Routes =====

  // Invite support staff (Client Admin only)
  app.post(
    '/api/tenant/invite-member',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Security: Extract tenant ID from authenticated user's context (not request body)
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const invitationSchema = z.object({
          email: z.string().email(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          role: z.enum(['support_staff', 'client_admin']), // Client admins can invite other admins or support staff
        });

        const data = invitationSchema.parse(req.body);

        // Delegate invite creation to centralized invite service (ensures RBAC and consistent behavior)
        try {
          const inviter = {
            userId: req.user!.userId,
            role: req.user!.role,
            tenantId: tenantId,
            isPlatformAdmin: req.user!.isPlatformAdmin,
            email: req.user!.email,
          };

          const payload = {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role,
            // Do NOT set tenantId here; inviteService will enforce inviter's tenant for client_admin
          } as any;

          const result = await inviteUser(inviter, payload);
          return res.json(result);
        } catch (serviceErr) {
          console.error('Error creating tenant invitation via inviteService:', serviceErr);
          if (serviceErr instanceof z.ZodError) {
            return res.status(400).json({ error: serviceErr.errors });
          }
          if (serviceErr instanceof Error && (serviceErr as any).status) {
            return res.status((serviceErr as any).status).json({ error: serviceErr.message });
          }
          return res.status(500).json({ error: 'Failed to create invitation' });
        }
      } catch (error) {
        console.error('Error inviting team member:', error);
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: error.errors });
        } else {
          res.status(500).json({ error: 'Failed to create invitation' });
        }
      }
    },
  );

  // Get tenant team members (Client Admin only)
  app.get(
    '/api/tenant/team',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // Get all users for this tenant
        const allUsers = await storage.getAllUsers();
        const tenantUsers = allUsers.filter((user) => user.tenantId === tenantId);

        // Sanitize response
        const sanitizedUsers = tenantUsers.map((user) => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          phoneNumber: user.phoneNumber,
          onboardingCompleted: user.onboardingCompleted,
          createdAt: user.createdAt,
        }));

        res.json(sanitizedUsers);
      } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ error: 'Failed to fetch team members' });
      }
    },
  );

  // Delete team member (Client Admin only - can only delete staff in their tenant)
  app.delete(
    '/api/tenant/team/:userId',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const { userId } = req.params;

        // Get the user to verify they belong to the same tenant
        const userToDelete = await storage.getClientUser(userId);

        if (!userToDelete) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Security: Client admins can only delete users in their own tenant
        if (userToDelete.tenantId !== tenantId) {
          return res.status(403).json({ error: 'Cannot delete users from other tenants' });
        }

        // Delete the user
        await storage.deleteClientUser(userId);

        res.json({ message: 'Team member deleted successfully' });
      } catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ error: 'Failed to delete team member' });
      }
    },
  );

  // Get pending invitations for this tenant (Client Admin only)
  app.get(
    '/api/tenant/invitations/pending',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // Get all pending invitations
        const allInvitations = await storage.getPendingInvitations();

        // SECURITY: Filter invitations for this tenant AND exclude platform invitations (tenantId = null)
        // Client admins should ONLY see invitations for their own tenant
        const tenantInvitations = allInvitations.filter(
          (inv) => inv.tenantId === tenantId && inv.tenantId !== null,
        );

        // Sanitize response - NEVER expose temporary passwords to client admins
        const sanitizedInvitations = tenantInvitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          firstName: inv.firstName,
          lastName: inv.lastName,
          role: inv.role,
          status: inv.status,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          lastSentAt: inv.lastSentAt || null,
          // NEVER include plainTemporaryPassword for client admins
        }));

        res.json(sanitizedInvitations);
      } catch (error) {
        console.error('Error fetching pending invitations:', error);
        res.status(500).json({ error: 'Failed to fetch invitations' });
      }
    },
  );

  // Delete invitation for this tenant (Client Admin only)
  app.delete(
    '/api/tenant/invitations/:invitationId',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const { invitationId } = req.params;

        console.log(`[Delete Tenant Invitation] Tenant: ${tenantId}, Invitation: ${invitationId}`);

        // Get all pending invitations to validate ownership
        const allInvitations = await storage.getPendingInvitations();
        const invitation = allInvitations.find((inv) => inv.id === invitationId);

        if (!invitation) {
          console.log(`[Delete Tenant Invitation] ✗ Invitation not found: ${invitationId}`);
          return res.status(404).json({ error: 'Invitation not found' });
        }

        // SECURITY: Verify invitation belongs to this tenant
        if (invitation.tenantId !== tenantId) {
          console.log(
            `[Delete Tenant Invitation] ✗ Unauthorized: Invitation belongs to different tenant`,
          );
          return res
            .status(403)
            .json({ error: 'You can only delete invitations from your own tenant' });
        }

        // Delete the invitation from database
        await storage.deleteInvitation(invitationId);

        console.log(
          `[Delete Tenant Invitation] ✓ Successfully deleted invitation: ${invitationId}`,
        );

        res.json({ message: 'Invitation deleted successfully' });
      } catch (error) {
        console.error('Error deleting invitation:', error);
        res.status(500).json({ error: 'Failed to delete invitation' });
      }
    },
  );

  // Accept invitation and set new password
  app.post('/api/auth/accept-invitation', async (req, res) => {
    try {
      const acceptSchema = z.object({
        email: z.string().email(),
        temporaryPassword: z.string(),
        newPassword: z.string().min(6),
      });

      const data = acceptSchema.parse(req.body);

      // Get invitation
      const invitation = await storage.getUserInvitationByEmail(data.email);
      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.status === 'accepted') {
        return res.status(400).json({ error: 'Invitation already used' });
      }

      if (invitation.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invitation expired' });
      }

      // Verify temporary password
      const validPassword = await verifyPassword(
        data.temporaryPassword,
        invitation.temporaryPassword,
      );
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid temporary password' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(data.newPassword);

      // Create user account
      const user = await storage.createClientUser({
        email: invitation.email,
        password: hashedPassword,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        tenantId: invitation.tenantId,
        role: invitation.role,
        isPlatformAdmin: invitation.role === 'owner' || invitation.role === 'admin',
        phoneNumber: invitation.phoneNumber || null,
      });

      // Mark invitation as used
      await storage.markInvitationUsed(invitation.id);

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin,
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          isPlatformAdmin: user.isPlatformAdmin,
        },
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to accept invitation' });
      }
    }
  });

  // Change password for authenticated user
  app.post('/api/auth/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const changePasswordSchema = z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
      });

      const data = changePasswordSchema.parse(req.body);

      // Get the current user
      const user = await storage.getClientUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const validPassword = await verifyPassword(data.currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(data.newPassword);

      // Update password
      await storage.updateClientUserPassword(user.id, hashedPassword);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to change password' });
      }
    }
  });

  // ===== Existing Routes =====

  // Get messages for a conversation (PROTECTED)
  app.get('/api/messages/:conversationId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const { conversationId } = req.params;
      const messages = await storage.getMessagesByConversation(conversationId, tenantId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Create a new message and get AI response (PROTECTED)
  app.post('/api/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const validatedData = insertMessageSchema.parse(req.body);

      // Verify conversation exists and belongs to user's tenant
      const conversation = await storage.getConversation(validatedData.conversationId, tenantId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Save user message (server injects tenantId for security)
      const userMessage = await storage.createMessage(
        {
          ...validatedData,
          senderType: 'user', // Explicitly mark as end-user message
        },
        tenantId,
      );

      // Broadcast user message to all connected clients in this tenant
      broadcastToTenant(tenantId, 'message:created', {
        message: userMessage,
        conversationId: validatedData.conversationId,
      });

      // Get AI response using Retell AI agent
      try {
        const aiResponseContent = await getRetellAgentResponse(
          validatedData.content,
          validatedData.conversationId,
          conversation,
          tenantId,
        );

        const aiMessage = await storage.createMessage(
          {
            conversationId: validatedData.conversationId,
            role: 'assistant',
            content: aiResponseContent,
            senderType: 'ai', // Explicitly mark as AI agent message
          },
          tenantId,
        );

        // Broadcast AI message to all connected clients in this tenant
        broadcastToTenant(tenantId, 'message:created', {
          message: aiMessage,
          conversationId: validatedData.conversationId,
        });

        res.json({ userMessage, aiMessage });
      } catch (aiError) {
        console.error('AI response error:', aiError);
        // Return user message even if AI fails
        res.json({
          userMessage,
          aiMessage: null,
          error: 'AI response unavailable',
        });
      }
    } catch (error) {
      console.error('Error creating message:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create message' });
      }
    }
  });

  // Get all conversations for authenticated tenant (PROTECTED)
  app.get('/api/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      const conversations = await storage.getConversationsByTenant(tenantId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // Create a new conversation (PROTECTED)
  app.post('/api/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Validate tenant ID exists in token
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      // Parse and validate request body (server injects tenantId for security)
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData, tenantId);
      res.json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create conversation' });
      }
    }
  });

  // Analytics: Get summary metrics for authenticated tenant (PROTECTED)
  app.get(
    '/api/analytics/summary',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // Support both date range and legacy "days" parameter
        let startDate: Date;
        let endDate: Date;

        if (req.query.startDate && req.query.endDate) {
          startDate = new Date(req.query.startDate as string);
          endDate = new Date(req.query.endDate as string);
        } else {
          const days = parseInt(req.query.days as string) || 7;
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
        }

        // Get daily analytics
        const dailyData = await storage.getDailyAnalytics(tenantId, startDate, endDate);

        // Calculate totals
        const totalConversations = dailyData.reduce((sum, day) => sum + day.conversationCount, 0);
        const totalMessages = dailyData.reduce((sum, day) => sum + day.messageCount, 0);
        const totalUsers = dailyData.reduce((sum, day) => sum + day.uniqueUsers, 0);
        const avgInteractions =
          dailyData.length > 0
            ? Math.round(
                dailyData.reduce((sum, day) => sum + day.avgInteractions, 0) / dailyData.length,
              )
            : 0;

        res.json({
          totalConversations,
          totalMessages,
          uniqueUsers: totalUsers,
          avgInteractions,
          dailyData: dailyData.map((d) => ({
            date: d.date,
            conversations: d.conversationCount,
            messages: d.messageCount,
            users: d.uniqueUsers,
          })),
        });
      } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
      }
    },
  );

  // End a conversation (and its Retell chat session)
  // End conversation (PROTECTED)
  app.post(
    '/api/conversations/:conversationId/end',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const { conversationId } = req.params;

        // Get the conversation and verify it belongs to user's tenant
        const conversation = await storage.getConversation(conversationId, tenantId);
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        // End the Retell chat session if it exists
        const metadata = conversation.metadata as {
          retellChatId?: string;
        } | null;
        const retellChatId = metadata?.retellChatId;
        if (retellChatId) {
          try {
            // Get tenant's widget config for API key
            const widgetConfig = await storage.getWidgetConfig(tenantId);
            if (widgetConfig?.retellApiKey) {
              const tenantRetellClient = new Retell({ apiKey: widgetConfig.retellApiKey });
              console.log('[Retell] Ending chat session:', retellChatId);
              await tenantRetellClient.chat.end(retellChatId);
              console.log('[Retell] Chat session ended successfully');
            } else {
              console.warn('[Retell] No API key configured for tenant, cannot end chat session.');
            }
          } catch (retellError) {
            console.error('[Retell] Error ending chat session:', retellError);
            // Continue even if Retell end fails
          }
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error ending conversation:', error);
        res.status(500).json({ error: 'Failed to end conversation' });
      }
    },
  );

  // ===== Widget Configuration Endpoints =====

  // Get widget config for authenticated tenant (PROTECTED)
  app.get(
    '/api/widget-config',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const config = await storage.getWidgetConfig(tenantId);

        if (!config) {
          return res.status(404).json({ error: 'Widget configuration not found' });
        }

        // SECURITY: Client admins cannot view Retell AI credentials
        // Only platform admins can see retellApiKey and retellAgentId
        // Strip these sensitive fields from the response
        const { retellApiKey, retellAgentId, ...safeConfig } = config;

        res.json(safeConfig);
      } catch (error) {
        console.error('Error fetching widget config:', error);
        res.status(500).json({ error: 'Failed to fetch widget configuration' });
      }
    },
  );

  // Create widget config for authenticated tenant (PROTECTED)
  app.post(
    '/api/widget-config',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // Check if config already exists
        const existingConfig = await storage.getWidgetConfig(tenantId);
        if (existingConfig) {
          return res.status(400).json({
            error: 'Widget configuration already exists. Use PATCH to update.',
          });
        }

        // SECURITY: Reject requests that include Retell AI credentials
        // Client admins cannot set retellApiKey or retellAgentId
        // Only platform admins can configure these during client onboarding
        if ('retellApiKey' in req.body || 'retellAgentId' in req.body) {
          return res.status(400).json({
            error: 'Client admins cannot configure Retell AI credentials. Contact platform admin.',
          });
        }

        // Parse and validate request body using safe create schema
        const validatedData = safeWidgetConfigCreateSchema.parse(req.body);

        // Create config with server-injected tenantId (without Retell credentials)
        const config = await storage.createWidgetConfig({
          ...validatedData,
          tenantId,
        });

        // Return safe config (Retell credentials excluded by type)
        const { retellApiKey, retellAgentId, ...safeConfig } = config;
        res.json(safeConfig);
      } catch (error) {
        console.error('Error creating widget config:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Failed to create widget configuration' });
      }
    },
  );

  // Update widget config for authenticated tenant (PROTECTED)
  app.patch(
    '/api/widget-config',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // SECURITY: Reject requests that include Retell AI credentials
        // Client admins cannot update retellApiKey or retellAgentId
        // Only platform admins can configure these during client onboarding
        if ('retellApiKey' in req.body || 'retellAgentId' in req.body) {
          return res.status(400).json({
            error: 'Client admins cannot modify Retell AI credentials. Contact platform admin.',
          });
        }

        // Parse and validate request body using safe update schema (partial updates allowed)
        const validatedData = safeWidgetConfigUpdateSchema.parse(req.body);

        // Update config
        const config = await storage.updateWidgetConfig(tenantId, validatedData);

        if (!config) {
          return res.status(404).json({ error: 'Widget configuration not found' });
        }

        // Return safe config (Retell credentials excluded by type)
        const { retellApiKey, retellAgentId, ...safeConfig } = config;
        res.json(safeConfig);
      } catch (error) {
        console.error('Error updating widget config:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Failed to update widget configuration' });
      }
    },
  );

  // ===== API Key Management Endpoints =====

  // List all API keys for authenticated tenant (PROTECTED)
  app.get(
    '/api/api-keys',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const apiKeys = await storage.getApiKeysByTenant(tenantId);

        // Never return the key hash - only return safe fields
        const safeKeys = apiKeys.map((key) => ({
          id: key.id,
          keyPrefix: key.keyPrefix,
          name: key.name,
          lastUsed: key.lastUsed,
          createdAt: key.createdAt,
          expiresAt: key.expiresAt,
        }));

        res.json(safeKeys);
      } catch (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({ error: 'Failed to fetch API keys' });
      }
    },
  );

  // Generate a new API key for authenticated tenant (PROTECTED)
  app.post(
    '/api/api-keys',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // Parse optional name from request
        const nameSchema = z.object({
          name: z.string().optional(),
        });
        const { name } = nameSchema.parse(req.body);

        // Generate a secure random API key (32 bytes = 64 hex chars)
        const apiKey = randomBytes(32).toString('hex');
        const keyPrefix = apiKey.substring(0, 8); // First 8 chars for display
        const fullApiKey = `embellics_${apiKey}`;

        // Hash the FULL API key (with embellics_ prefix) using bcrypt for secure storage
        const keyHash = await hashPassword(fullApiKey);

        // Create API key record
        const apiKeyRecord = await storage.createApiKey({
          tenantId,
          keyHash,
          keyPrefix,
          name: name || null,
        });

        // Return the full API key ONLY on creation (never again)
        res.json({
          id: apiKeyRecord.id,
          apiKey: fullApiKey, // Prefix for identification
          keyPrefix: apiKeyRecord.keyPrefix,
          name: apiKeyRecord.name,
          createdAt: apiKeyRecord.createdAt,
          warning: "Save this API key now. You won't be able to see it again.",
        });
      } catch (error) {
        console.error('Error creating API key:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Failed to create API key' });
      }
    },
  );

  // Delete an API key for authenticated tenant (PROTECTED)
  app.delete(
    '/api/api-keys/:id',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        const { id } = req.params;

        // Delete the API key (storage layer ensures tenant isolation)
        await storage.deleteApiKey(id, tenantId);

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting API key:', error);
        res.status(500).json({ error: 'Failed to delete API key' });
      }
    },
  );

  // ===== Analytics Endpoints =====

  // Get analytics from Retell AI (PROTECTED)
  app.get(
    '/api/analytics/retell',
    requireAuth,
    requireClientAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Validate tenant ID exists in token
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;

        // Get tenant's widget config to find their Retell API key
        const widgetConfig = await storage.getWidgetConfig(tenantId);

        // If no widget config or no API key configured, return empty analytics
        if (!widgetConfig?.retellApiKey) {
          console.log(`[Analytics] No Retell API key configured for tenant: ${tenantId}`);
          return res.json({
            totalCalls: 0,
            completedCalls: 0,
            averageDuration: 0,
            averageLatency: 0,
            successRate: 0,
            sentimentBreakdown: {
              Positive: 0,
              Negative: 0,
              Neutral: 0,
              Unknown: 0,
            },
            disconnectionReasons: {},
            callStatusBreakdown: {},
            callsOverTime: [],
            directionBreakdown: { inbound: 0, outbound: 0 },
          });
        }

        // Create a Retell client using the tenant's own API key
        const tenantRetellClient = new Retell({
          apiKey: widgetConfig.retellApiKey,
        });

        // Get time range from query params (default to all time)
        const { start_date, end_date } = req.query;

        // Build filter for time range (NO agent_id filter - we want ALL agents in this account)
        const filter: any = {};

        // Add time filtering if provided
        if (start_date) {
          filter.start_timestamp = {
            gte: new Date(start_date as string).getTime(),
          };
        }
        if (end_date) {
          filter.start_timestamp = {
            ...filter.start_timestamp,
            lte: new Date(end_date as string).getTime(),
          };
        }

        let calls: any[] = [];
        let agentNames: Record<string, string> = {}; // Declare in outer scope

        console.log(`[Analytics] Fetching account-wide calls for tenant: ${tenantId}`);
        console.log(`[Analytics] Filter criteria:`, JSON.stringify(filter, null, 2));

        try {
          // First, fetch list of active (non-deleted) agents and store their names
          let activeAgentIds: Set<string>;
          try {
            const activeAgents = await tenantRetellClient.agent.list();
            activeAgentIds = new Set(activeAgents.map((agent: any) => agent.agent_id));
            activeAgents.forEach((agent: any) => {
              if (agent.agent_id && agent.agent_name) {
                agentNames[agent.agent_id] = agent.agent_name;
              }
            });
            console.log(`[Analytics] Found ${activeAgentIds.size} active agents in account`);
          } catch (agentError) {
            console.warn(
              `[Analytics] Could not fetch agent list, including all calls:`,
              agentError,
            );
            activeAgentIds = new Set(); // Empty set means we'll include all calls
          }

          // Fetch ALL calls from tenant's Retell account with pagination
          // Retell uses pagination_key (last call_id) for pagination
          let paginationKey: string | undefined = undefined;
          let pageCount = 0;
          const maxLimit = 1000; // Retell's max limit per request

          do {
            pageCount++;
            const pageParams: any = {
              filter_criteria: Object.keys(filter).length > 0 ? filter : undefined,
              limit: maxLimit,
              sort_order: 'descending', // Most recent first
            };

            if (paginationKey) {
              pageParams.pagination_key = paginationKey;
            }

            console.log(
              `[Analytics] Fetching page ${pageCount} with params:`,
              JSON.stringify({ limit: maxLimit, has_pagination_key: !!paginationKey }, null, 2),
            );

            const response: any = await tenantRetellClient.call.list(pageParams);

            // Retell returns an array of calls
            if (Array.isArray(response) && response.length > 0) {
              calls.push(...response);
              console.log(
                `[Analytics] Page ${pageCount}: Fetched ${response.length} calls (total so far: ${calls.length})`,
              );

              // If we got the max limit, there might be more pages
              // Use the last call's ID as pagination key for next request
              if (response.length === maxLimit) {
                const lastCall = response[response.length - 1];
                paginationKey = lastCall.call_id;
                console.log(
                  `[Analytics] More pages available, next pagination_key: ${paginationKey}`,
                );
              } else {
                // Got fewer than max limit, this is the last page
                paginationKey = undefined;
                console.log(`[Analytics] Last page reached (got ${response.length} < ${maxLimit})`);
              }
            } else {
              // Empty response or not an array
              paginationKey = undefined;
              console.log(`[Analytics] No more calls to fetch`);
            }

            // Safety limit: prevent infinite loops (max 100 pages = 100,000 calls)
            if (pageCount >= 100) {
              console.warn(
                `[Analytics] Reached pagination safety limit (100 pages, ${calls.length} total calls)`,
              );
              break;
            }
          } while (paginationKey);

          console.log(
            `[Analytics] ✓ Fetched ${calls.length} total calls across ${pageCount} pages`,
          );

          // Filter out calls from deleted agents (if we successfully fetched agent list)
          if (activeAgentIds.size > 0) {
            const callsBeforeFilter = calls.length;
            calls = calls.filter((call: any) => activeAgentIds.has(call.agent_id));
            const callsRemoved = callsBeforeFilter - calls.length;

            if (callsRemoved > 0) {
              console.log(`[Analytics] Filtered out ${callsRemoved} calls from deleted agents`);
              console.log(
                `[Analytics] Remaining: ${calls.length} calls from ${activeAgentIds.size} active agents`,
              );
            }
          }

          // Filter by date range manually (Retell API doesn't respect filter_criteria for dates)
          if (Object.keys(filter).length > 0 && filter.start_timestamp) {
            const beforeDateFilter = calls.length;
            calls = calls.filter((call: any) => {
              if (!call.start_timestamp) return false;

              if (filter.start_timestamp.gte && call.start_timestamp < filter.start_timestamp.gte) {
                return false;
              }
              if (filter.start_timestamp.lte && call.start_timestamp > filter.start_timestamp.lte) {
                return false;
              }
              return true;
            });

            const dateFiltered = beforeDateFilter - calls.length;
            if (dateFiltered > 0) {
              console.log(
                `[Analytics] Filtered out ${dateFiltered} calls outside date range (${beforeDateFilter} → ${calls.length})`,
              );
            }
          }

          if (calls.length > 0) {
            const agentIds = Array.from(new Set(calls.map((c: any) => c.agent_id)));
            console.log(
              `[Analytics] Final dataset: ${calls.length} calls across ${agentIds.length} agents:`,
              agentIds,
            );

            // Log call status breakdown to debug discrepancies
            const statusCounts: Record<string, number> = {};
            const typeCounts: Record<string, number> = {};
            const directionCounts: Record<string, number> = {};

            calls.forEach((call: any) => {
              const status = call.call_status || 'unknown';
              statusCounts[status] = (statusCounts[status] || 0) + 1;

              const type = call.call_type || 'unknown';
              typeCounts[type] = (typeCounts[type] || 0) + 1;

              const direction = call.direction || 'unknown';
              directionCounts[direction] = (directionCounts[direction] || 0) + 1;
            });

            console.log(`[Analytics] Call status breakdown:`, statusCounts);
            console.log(`[Analytics] Call type breakdown:`, typeCounts);
            console.log(`[Analytics] Call direction breakdown:`, directionCounts);

            // Check for calls with zero/null duration (might be filtered by Retell)
            const zeroDurationCalls = calls.filter(
              (c: any) => !c.duration_ms || c.duration_ms === 0,
            );
            if (zeroDurationCalls.length > 0) {
              console.log(
                `[Analytics] Found ${zeroDurationCalls.length} calls with zero/null duration`,
              );
            }

            // Check web_call vs phone_call
            const webCalls = calls.filter((c: any) => c.call_type === 'web_call');
            console.log(
              `[Analytics] Web calls: ${webCalls.length}, Phone calls: ${
                calls.length - webCalls.length
              }`,
            );

            // Check date range of actual calls received
            if (calls.length > 0) {
              const timestamps = calls
                .map((c: any) => c.start_timestamp)
                .filter(Boolean)
                .sort((a, b) => a - b);
              if (timestamps.length > 0) {
                const earliest = new Date(timestamps[0]).toISOString();
                const latest = new Date(timestamps[timestamps.length - 1]).toISOString();
                console.log(`[Analytics] Actual call date range: ${earliest} to ${latest}`);
              }
            }
          }
        } catch (retellError: any) {
          console.error('[Retell] Error fetching calls:', retellError);
          console.error('[Retell] Error details:', JSON.stringify(retellError, null, 2));
          console.error('[Retell] Error message:', retellError.message);
          // Return empty analytics if Retell API fails (don't break the dashboard)
          return res.json({
            totalCalls: 0,
            completedCalls: 0,
            averageDuration: 0,
            averageLatency: 0,
            successRate: 0,
            sentimentBreakdown: {
              Positive: 0,
              Negative: 0,
              Neutral: 0,
              Unknown: 0,
            },
            disconnectionReasons: {},
            callStatusBreakdown: {},
            callsOverTime: [],
            directionBreakdown: { inbound: 0, outbound: 0 },
          });
        }

        // Aggregate analytics data
        let totalDuration = 0;
        let totalLatency = 0;
        let successfulCalls = 0;
        let completedCalls = 0;
        let pickedUpCalls = 0;
        let transferredCalls = 0;
        let voicemailCalls = 0;

        const sentimentCounts: Record<string, number> = {};
        const disconnectionReasons: Record<string, number> = {};
        const callStatusBreakdown: Record<string, number> = {};
        const callsByDate: Record<string, number> = {};
        const directionBreakdown: Record<string, number> = {
          inbound: 0,
          outbound: 0,
        };

        // Additional tracking for charts
        const callsByDateStacked: Record<string, any> = {};
        const agentMetrics: Record<string, any> = {};

        for (const call of calls) {
          const agentId = call.agent_id;
          const dateKey = call.start_timestamp
            ? new Date(call.start_timestamp).toISOString().split('T')[0]
            : 'unknown';

          // Initialize agent metrics if not exists
          if (agentId && !agentMetrics[agentId]) {
            agentMetrics[agentId] = {
              totalCalls: 0,
              successfulCalls: 0,
              pickedUpCalls: 0,
              transferredCalls: 0,
              voicemailCalls: 0,
            };
          }

          // Initialize date metrics if not exists
          if (!callsByDateStacked[dateKey]) {
            callsByDateStacked[dateKey] = {
              successful: 0,
              unsuccessful: 0,
              agentHangup: 0,
              callTransfer: 0,
              userHangup: 0,
              otherDisconnection: 0,
              positive: 0,
              neutral: 0,
              negative: 0,
              otherSentiment: 0,
            };
          }

          // Count call status
          if (call.call_status) {
            callStatusBreakdown[call.call_status] =
              (callStatusBreakdown[call.call_status] || 0) + 1;
          }

          // Count direction (for all calls, not just completed)
          if (call.direction) {
            directionBreakdown[call.direction] = (directionBreakdown[call.direction] || 0) + 1;
          }

          // Track all calls metrics (not just ended)
          if (agentId) {
            agentMetrics[agentId].totalCalls++;
          }

          // Only analyze completed calls
          if (call.call_status === 'ended') {
            completedCalls++;

            // Duration
            if (call.duration_ms) {
              totalDuration += call.duration_ms;
            }

            // Latency (use e2e p50 if available)
            if (call.latency?.e2e?.p50) {
              totalLatency += call.latency.e2e.p50;
            }

            // Success rate (call_successful)
            const isSuccessful = call.call_analysis?.call_successful === true;
            if (isSuccessful) {
              successfulCalls++;
              if (agentId) agentMetrics[agentId].successfulCalls++;
              callsByDateStacked[dateKey].successful++;
            } else {
              callsByDateStacked[dateKey].unsuccessful++;
            }

            // Pickup rate (if call was answered/picked up)
            // A call is picked up if it wasn't disconnected before being answered
            if (
              call.disconnection_reason !== 'voicemail' &&
              call.disconnection_reason !== 'no_answer'
            ) {
              pickedUpCalls++;
              if (agentId) agentMetrics[agentId].pickedUpCalls++;
            }

            // Transfer rate
            if (call.disconnection_reason === 'call_transfer') {
              transferredCalls++;
              if (agentId) agentMetrics[agentId].transferredCalls++;
              callsByDateStacked[dateKey].callTransfer++;
            }

            // Voicemail rate
            if (call.disconnection_reason === 'voicemail') {
              voicemailCalls++;
              if (agentId) agentMetrics[agentId].voicemailCalls++;
            }

            // Sentiment
            const sentiment = call.call_analysis?.user_sentiment || 'unknown';
            sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;

            // Sentiment by date for stacked chart
            if (sentiment === 'positive') {
              callsByDateStacked[dateKey].positive++;
            } else if (sentiment === 'neutral') {
              callsByDateStacked[dateKey].neutral++;
            } else if (sentiment === 'negative') {
              callsByDateStacked[dateKey].negative++;
            } else {
              callsByDateStacked[dateKey].otherSentiment++;
            }

            // Disconnection reason
            const disconnectReason = call.disconnection_reason || 'unknown';
            disconnectionReasons[disconnectReason] =
              (disconnectionReasons[disconnectReason] || 0) + 1;

            // Disconnection by date for stacked chart
            if (disconnectReason === 'agent_hangup') {
              callsByDateStacked[dateKey].agentHangup++;
            } else if (disconnectReason === 'user_hangup') {
              callsByDateStacked[dateKey].userHangup++;
            } else if (disconnectReason !== 'call_transfer') {
              callsByDateStacked[dateKey].otherDisconnection++;
            }

            // Calls over time
            if (call.start_timestamp) {
              const date = new Date(call.start_timestamp).toISOString().split('T')[0];
              callsByDate[date] = (callsByDate[date] || 0) + 1;
            }
          }
        }

        // Calculate averages
        const averageDuration = completedCalls > 0 ? totalDuration / completedCalls : 0;
        const averageLatency = completedCalls > 0 ? totalLatency / completedCalls : 0;
        const successRate = completedCalls > 0 ? (successfulCalls / completedCalls) * 100 : 0;
        const pickupRate = completedCalls > 0 ? (pickedUpCalls / completedCalls) * 100 : 0;
        const transferRate = completedCalls > 0 ? (transferredCalls / completedCalls) * 100 : 0;
        const voicemailRate = completedCalls > 0 ? (voicemailCalls / completedCalls) * 100 : 0;

        // Format sentiment breakdown as percentages
        const sentimentBreakdown: Record<string, number> = {};
        for (const [sentiment, count] of Object.entries(sentimentCounts)) {
          sentimentBreakdown[sentiment] = completedCalls > 0 ? (count / completedCalls) * 100 : 0;
        }

        // Calculate per-date metrics for time-series charts
        const dailyMetrics: Record<string, any> = {};

        for (const call of calls) {
          if (call.call_status !== 'ended') continue;

          const dateKey = call.start_timestamp
            ? new Date(call.start_timestamp).toISOString().split('T')[0]
            : 'unknown';

          if (!dailyMetrics[dateKey]) {
            dailyMetrics[dateKey] = {
              totalCalls: 0,
              successfulCalls: 0,
              pickedUpCalls: 0,
              transferredCalls: 0,
              voicemailCalls: 0,
              totalDuration: 0,
              totalLatency: 0,
              callsWithLatency: 0,
            };
          }

          dailyMetrics[dateKey].totalCalls++;

          if (call.call_analysis?.call_successful) {
            dailyMetrics[dateKey].successfulCalls++;
          }

          if (
            call.disconnection_reason !== 'voicemail' &&
            call.disconnection_reason !== 'no_answer'
          ) {
            dailyMetrics[dateKey].pickedUpCalls++;
          }

          if (call.disconnection_reason === 'call_transfer') {
            dailyMetrics[dateKey].transferredCalls++;
          }

          if (call.disconnection_reason === 'voicemail') {
            dailyMetrics[dateKey].voicemailCalls++;
          }

          if (call.duration_ms) {
            dailyMetrics[dateKey].totalDuration += call.duration_ms;
          }

          if (call.latency?.e2e?.p50) {
            dailyMetrics[dateKey].totalLatency += call.latency.e2e.p50;
            dailyMetrics[dateKey].callsWithLatency++;
          }
        }

        // Format daily metrics for time-series charts
        const dailyMetricsArray = Object.entries(dailyMetrics)
          .map(([date, metrics]: [string, any]) => ({
            date,
            pickupRate:
              metrics.totalCalls > 0
                ? Math.round((metrics.pickedUpCalls / metrics.totalCalls) * 100)
                : 0,
            successRate:
              metrics.totalCalls > 0
                ? Math.round((metrics.successfulCalls / metrics.totalCalls) * 100)
                : 0,
            transferRate:
              metrics.totalCalls > 0
                ? Math.round((metrics.transferredCalls / metrics.totalCalls) * 100)
                : 0,
            voicemailRate:
              metrics.totalCalls > 0
                ? Math.round((metrics.voicemailCalls / metrics.totalCalls) * 100)
                : 0,
            avgDuration:
              metrics.totalCalls > 0
                ? Math.round(metrics.totalDuration / metrics.totalCalls / 1000)
                : 0, // seconds
            avgLatency:
              metrics.callsWithLatency > 0
                ? Math.round(metrics.totalLatency / metrics.callsWithLatency)
                : 0, // ms
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Format calls over time for charting
        const callsOverTime = Object.entries(callsByDate)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Format stacked data for charts
        const callsByDateStackedArray = Object.entries(callsByDateStacked)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Format agent metrics for horizontal bar charts
        const agentMetricsArray = Object.entries(agentMetrics).map(
          ([agentId, metrics]: [string, any]) => ({
            agentId,
            agentName: agentNames[agentId] || agentId, // Use agent name if available, fallback to ID
            successRate:
              metrics.totalCalls > 0 ? (metrics.successfulCalls / metrics.totalCalls) * 100 : 0,
            pickupRate:
              metrics.totalCalls > 0 ? (metrics.pickedUpCalls / metrics.totalCalls) * 100 : 0,
            transferRate:
              metrics.totalCalls > 0 ? (metrics.transferredCalls / metrics.totalCalls) * 100 : 0,
            voicemailRate:
              metrics.totalCalls > 0 ? (metrics.voicemailCalls / metrics.totalCalls) * 100 : 0,
            totalCalls: metrics.totalCalls,
          }),
        );

        // IMPORTANT: Retell's dashboard applies multiple filters:
        // 1. Only "ended" status calls (not error, ongoing, etc.)
        // 2. Only phone_call type (exclude web_call)
        // 3. Only calls with positive duration (exclude null/zero duration)
        const endedCalls = calls.filter(
          (call: any) =>
            call.call_status === 'ended' &&
            call.call_type === 'phone_call' &&
            call.duration_ms &&
            call.duration_ms > 0,
        );
        console.log(
          `[Analytics] Filtered to phone calls with duration: ${endedCalls.length} out of ${calls.length} total`,
        );

        res.json({
          totalCalls: endedCalls.length, // Only count completed/ended calls to match Retell dashboard
          completedCalls,
          averageDuration: Math.round(averageDuration / 1000), // Convert to seconds
          averageLatency: Math.round(averageLatency), // Already in ms
          successRate: Math.round(successRate),
          pickupRate: Math.round(pickupRate),
          transferRate: Math.round(transferRate),
          voicemailRate: Math.round(voicemailRate),
          sentimentBreakdown,
          disconnectionReasons,
          callStatusBreakdown,
          callsOverTime,
          dailyMetrics: dailyMetricsArray, // Per-date metrics for time-series charts
          callsByDateStacked: callsByDateStackedArray,
          agentMetrics: agentMetricsArray,
          directionBreakdown,
        });
      } catch (error) {
        console.error('Error fetching Retell analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
      }
    },
  );

  /**
   * OLD RETELL API ANALYTICS ENDPOINT - REMOVED
   *
   * The endpoint `/api/platform/analytics/retell/:tenantId` has been deprecated and removed.
   * It previously made direct calls to Retell's API to fetch analytics data.
   *
   * Migration path:
   * - Use /api/platform/tenants/:tenantId/analytics/overview for unified analytics
   * - Configure Retell webhooks to send call.ended events to /api/retell/call-ended
   * - Analytics will be stored in the database and queried from there
   *
   * Benefits of new approach:
   * - Faster performance (no external API calls)
   * - Historical data storage
   * - No rate limits
   * - Cost tracking included
   * - Unified voice + chat analytics
   */

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // WebSocket endpoint for real-time updates (auth via first message)
  (app as any).ws('/api/ws', (ws: WebSocket, req: any) => {
    let authenticated = false;
    let tenantId: string | null = null;
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        console.log('[WebSocket] Authentication timeout');
        ws.close(1008, 'Authentication timeout');
      }
    }, 5000); // 5 second timeout for authentication

    ws.on('message', (msg: string) => {
      try {
        const data = JSON.parse(msg.toString());

        // First message must be authentication
        if (!authenticated) {
          if (data.type !== 'auth' || !data.token) {
            console.log('[WebSocket] First message must be auth');
            ws.close(1008, 'Authentication required');
            return;
          }

          // Verify token
          const payload = verifyToken(data.token);
          if (!payload || !payload.tenantId) {
            console.log('[WebSocket] Invalid token');
            ws.close(1008, 'Invalid authentication');
            return;
          }

          tenantId = payload.tenantId;
          authenticated = true;
          clearTimeout(authTimeout);

          // Register client with their tenant ID for scoped broadcasting
          registerClient(ws, tenantId);

          console.log(`[WebSocket] Client authenticated for tenant: ${tenantId}`);

          // Send authentication success message
          ws.send(JSON.stringify({ type: 'auth:success', payload: { tenantId } }));
          return;
        }

        // Handle other message types after authentication
        console.log('[WebSocket] Received message:', data);
      } catch (error) {
        console.error('[WebSocket] Message handling error:', error);
        if (!authenticated) {
          ws.close(1008, 'Invalid message format');
        }
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (authenticated && tenantId) {
        console.log(`[WebSocket] Client disconnected for tenant: ${tenantId}`);
      } else {
        console.log('[WebSocket] Unauthenticated client disconnected');
      }
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket] Error:`, error);
      clearTimeout(authTimeout);
    });

    console.log('[WebSocket] Connection opened, awaiting authentication');
  });

  // ===== Human Agent Management Endpoints =====

  // Get all human agents for tenant
  app.get('/api/human-agents', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const agents = await storage.getHumanAgentsByTenant(tenantId);
      res.json(agents);
    } catch (error) {
      console.error('Error fetching human agents:', error);
      res.status(500).json({ error: 'Failed to fetch human agents' });
    }
  });

  // Create a new human agent
  app.post('/api/human-agents', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const agentData = insertHumanAgentSchema.parse(req.body);
      const agent = await storage.createHumanAgent(agentData, tenantId);
      res.json(agent);
    } catch (error) {
      console.error('Error creating human agent:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create human agent' });
      }
    }
  });

  // Update human agent status
  app.patch('/api/human-agents/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const { status } = z.object({ status: z.string() }).parse(req.body);

      await storage.updateHumanAgentStatus(id, status, tenantId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating agent status:', error);
      res.status(500).json({ error: 'Failed to update agent status' });
    }
  });

  // Get available human agents
  app.get('/api/human-agents/available', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const agents = await storage.getAvailableHumanAgents(tenantId);
      res.json(agents);
    } catch (error) {
      console.error('Error fetching available agents:', error);
      res.status(500).json({ error: 'Failed to fetch available agents' });
    }
  });

  // ============================================
  // WIDGET HANDOFF MANAGEMENT ENDPOINTS (PROTECTED)
  // ============================================

  // Get all widget handoffs for tenant
  app.get('/api/widget-handoffs', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const handoffs = await storage.getWidgetHandoffsByTenant(tenantId);
      res.json(handoffs);
    } catch (error) {
      console.error('Error fetching widget handoffs:', error);
      res.status(500).json({ error: 'Failed to fetch handoffs' });
    }
  });

  // Get pending widget handoffs
  app.get('/api/widget-handoffs/pending', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const handoffs = await storage.getPendingWidgetHandoffs(tenantId);
      res.json(handoffs);
    } catch (error) {
      console.error('Error fetching pending handoffs:', error);
      res.status(500).json({ error: 'Failed to fetch pending handoffs' });
    }
  });

  // Get active widget handoffs
  app.get('/api/widget-handoffs/active', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const handoffs = await storage.getActiveWidgetHandoffs(tenantId);
      res.json(handoffs);
    } catch (error) {
      console.error('Error fetching active handoffs:', error);
      res.status(500).json({ error: 'Failed to fetch active handoffs' });
    }
  });

  // Get specific widget handoff
  app.get('/api/widget-handoffs/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { id } = req.params;
      const handoff = await storage.getWidgetHandoff(id);

      if (!handoff || handoff.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      res.json(handoff);
    } catch (error) {
      console.error('Error fetching handoff:', error);
      res.status(500).json({ error: 'Failed to fetch handoff' });
    }
  });

  // Pick up a widget handoff (agent claims it)
  app.post(
    '/api/widget-handoffs/:id/pickup',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;
        const { id } = req.params;

        if (!req.user?.email) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const handoff = await storage.getWidgetHandoff(id);

        if (!handoff || handoff.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Handoff not found' });
        }

        if (handoff.status !== 'pending') {
          return res.status(400).json({ error: 'Handoff is not available' });
        }

        // Find agent record for this user
        const agents = await storage.getHumanAgentsByTenant(tenantId);
        const agent = agents.find((a) => a.email === req.user?.email);

        if (!agent) {
          return res.status(404).json({ error: 'Agent record not found' });
        }

        // Assign handoff to agent
        const updatedHandoff = await storage.assignHandoffToAgent(id, agent.id, tenantId);

        // Increment agent's active chats
        await storage.incrementActiveChats(agent.id, tenantId);

        // Broadcast via WebSocket
        const wss = (req as any).ws;
        if (wss) {
          wss.clients.forEach((client: any) => {
            if (client.tenantId === tenantId && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: 'handoff_picked_up',
                  handoffId: id,
                  agentId: agent.id,
                  agentName: agent.name,
                }),
              );
            }
          });
        }

        res.json(updatedHandoff);
      } catch (error) {
        console.error('Error picking up handoff:', error);
        res.status(500).json({ error: 'Failed to pick up handoff' });
      }
    },
  );

  // Resolve a widget handoff
  app.post(
    '/api/widget-handoffs/:id/resolve',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;
        const { id } = req.params;

        const handoff = await storage.getWidgetHandoff(id);

        if (!handoff || handoff.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Handoff not found' });
        }

        if (handoff.status !== 'active') {
          return res.status(400).json({ error: 'Handoff is not active' });
        }

        // Find agent record for authorization check
        const agents = await storage.getHumanAgentsByTenant(tenantId);
        const agent = agents.find((a) => a.email === req.user?.email);

        if (!agent) {
          return res.status(404).json({ error: 'Agent record not found' });
        }

        // Authorization check: only the assigned agent can resolve
        if (handoff.assignedAgentId !== agent.id) {
          return res.status(403).json({
            error: 'Unauthorized',
            message: 'This conversation is assigned to another agent',
          });
        }

        // Update handoff status
        const updatedHandoff = await storage.updateWidgetHandoffStatus(id, 'resolved');

        // Decrement agent's active chats
        if (handoff.assignedAgentId) {
          await storage.decrementActiveChats(handoff.assignedAgentId, tenantId);
        }

        // Broadcast via WebSocket
        const wss = (req as any).ws;
        if (wss) {
          wss.clients.forEach((client: any) => {
            if (client.tenantId === tenantId && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: 'handoff_resolved',
                  handoffId: id,
                }),
              );
            }
          });
        }

        res.json(updatedHandoff);
      } catch (error) {
        console.error('Error resolving handoff:', error);
        res.status(500).json({ error: 'Failed to resolve handoff' });
      }
    },
  );

  // Send message from agent to user (during active handoff)
  app.post(
    '/api/widget-handoffs/:id/send-message',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;
        const { id } = req.params;
        const { message } = z.object({ message: z.string().min(1) }).parse(req.body);

        const handoff = await storage.getWidgetHandoff(id);

        if (!handoff || handoff.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Handoff not found' });
        }

        if (handoff.status !== 'active') {
          return res.status(400).json({ error: 'Handoff is not active' });
        }

        // Find agent record
        const agents = await storage.getHumanAgentsByTenant(tenantId);
        const agent = agents.find((a) => a.email === req.user?.email);

        if (!agent) {
          return res.status(404).json({ error: 'Agent record not found' });
        }

        // Authorization check: only the assigned agent can send messages
        if (handoff.assignedAgentId !== agent.id) {
          return res.status(403).json({
            error: 'Unauthorized',
            message: 'This conversation is assigned to another agent',
          });
        }

        // Save message
        const savedMessage = await storage.createWidgetHandoffMessage({
          handoffId: id,
          senderType: 'agent',
          senderId: agent.id,
          content: message,
        });

        // Broadcast to widget via WebSocket (if connected)
        const wss = (req as any).ws;
        if (wss) {
          wss.clients.forEach((client: any) => {
            // Widget clients don't have userId, only chatId or handoffId
            if (client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: 'agent_message',
                  handoffId: id,
                  message: {
                    id: savedMessage.id,
                    content: savedMessage.content,
                    senderType: 'agent',
                    timestamp: savedMessage.timestamp,
                  },
                }),
              );
            }
          });
        }

        res.json(savedMessage);
      } catch (error) {
        console.error('Error sending message:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        res.status(500).json({ error: 'Failed to send message' });
      }
    },
  );

  // Get messages for a handoff
  app.get(
    '/api/widget-handoffs/:id/messages',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;
        const { id } = req.params;

        const handoff = await storage.getWidgetHandoff(id);

        if (!handoff || handoff.tenantId !== tenantId) {
          return res.status(404).json({ error: 'Handoff not found' });
        }

        const messages = await storage.getWidgetHandoffMessages(id);
        res.json(messages);
      } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
      }
    },
  );

  // ===== Handoff Management Endpoints =====
  // Note: Handoff lifecycle events (trigger/assign/complete) are broadcast-only via WebSocket.
  // They update conversation metadata but do not persist messages. Only actual chat messages
  // from users, AI, or human agents are stored via storage.createMessage with explicit senderType.

  // Trigger a handoff from AI to human agent (PROTECTED)
  app.post('/api/handoff/trigger', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { conversationId, reason } = z
        .object({
          conversationId: z.string(),
          reason: z.string().optional(),
        })
        .parse(req.body);

      const tenantId = assertTenant(req, res);
      if (!tenantId) return;

      // Get conversation
      const conversation = await storage.getConversation(conversationId, tenantId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Generate conversation summary
      const messages = await storage.getMessagesByConversation(conversationId, tenantId);
      const summary = await generateConversationSummary(messages);

      // Update conversation status to pending_handoff
      await storage.updateConversation(
        conversationId,
        {
          handoffStatus: 'pending_handoff',
          conversationSummary: summary,
          handoffTimestamp: new Date(),
          handoffReason: reason || 'user_request',
        },
        tenantId,
      );

      // Broadcast handoff event to tenant's admin dashboard
      broadcastToTenant(tenantId, 'handoff_requested', {
        conversationId,
        summary,
        reason: reason || 'user_request',
      });

      res.json({ success: true, summary });
    } catch (error) {
      console.error('Error triggering handoff:', error);
      res.status(500).json({ error: 'Failed to trigger handoff' });
    }
  });

  // Get pending handoffs for tenant
  app.get('/api/handoff/pending', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const pending = await storage.getPendingHandoffs(tenantId);
      res.json(pending);
    } catch (error) {
      console.error('Error fetching pending handoffs:', error);
      res.status(500).json({ error: 'Failed to fetch pending handoffs' });
    }
  });

  // Assign human agent to widget handoff
  app.post('/api/handoff/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { conversationId, humanAgentId } = z
        .object({
          conversationId: z.string(), // This is actually the widget_handoff ID
          humanAgentId: z.string(),
        })
        .parse(req.body);

      console.log(`[Assign Handoff] Assigning handoff ${conversationId} to agent ${humanAgentId}`);

      // Get the widget handoff
      const handoff = await storage.getWidgetHandoff(conversationId);

      if (!handoff || handoff.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      if (handoff.status !== 'pending') {
        return res.status(400).json({ error: 'Handoff is not available for assignment' });
      }

      // Update widget handoff status to active and assign agent
      await storage.assignHandoffToAgent(conversationId, humanAgentId, tenantId);

      // Increment agent's active chats
      await storage.incrementActiveChats(humanAgentId, tenantId);

      console.log(
        `[Assign Handoff] Successfully assigned handoff ${conversationId} to agent ${humanAgentId}`,
      );

      // Broadcast assignment via WebSocket
      const wss = (req as any).ws;
      if (wss) {
        wss.clients.forEach((client: any) => {
          if (client.tenantId === tenantId && client.readyState === 1) {
            client.send(
              JSON.stringify({
                type: 'handoff_assigned',
                handoffId: conversationId,
                agentId: humanAgentId,
              }),
            );
          }
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error assigning handoff:', error);
      res.status(500).json({ error: 'Failed to assign handoff' });
    }
  });

  // Get ALL active handoffs for tenant (all agents)
  app.get('/api/handoff/active', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const activeChats = await storage.getActiveHandoffs(tenantId);
      res.json(activeChats);
    } catch (error) {
      console.error('Error fetching active handoffs:', error);
      res.status(500).json({ error: 'Failed to fetch active handoffs' });
    }
  });

  // Get active chats for a specific human agent
  app.get(
    '/api/handoff/agent/:agentId/active',
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = assertTenant(req, res);
        if (!tenantId) return;
        const { agentId } = req.params;

        const conversations = await storage.getConversationsByTenant(tenantId);
        const activeChats = conversations.filter(
          (c) => c.handoffStatus === 'with_human' && c.humanAgentId === agentId,
        );

        res.json(activeChats);
      } catch (error) {
        console.error('Error fetching active chats:', error);
        res.status(500).json({ error: 'Failed to fetch active chats' });
      }
    },
  );

  // Send message from human agent
  app.post('/api/handoff/send-message', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { conversationId, content, humanAgentId } = z
        .object({
          conversationId: z.string(),
          content: z.string(),
          humanAgentId: z.string(),
        })
        .parse(req.body);

      // Verify conversation is assigned to this agent
      const conversation = await storage.getConversation(conversationId, tenantId);
      if (!conversation || conversation.humanAgentId !== humanAgentId) {
        return res.status(403).json({ error: 'Not authorized for this conversation' });
      }

      // Create message
      const message = await storage.createMessage(
        {
          conversationId,
          role: 'assistant',
          content,
          senderType: 'human',
          humanAgentId,
        },
        tenantId,
      );

      // Broadcast message to chat widget
      broadcastToTenant(tenantId, 'human_agent_message', {
        conversationId,
        message,
      });

      res.json(message);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Complete handoff (end human agent session)
  app.post('/api/handoff/complete', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { conversationId, humanAgentId } = z
        .object({
          conversationId: z.string(),
          humanAgentId: z.string(),
        })
        .parse(req.body);

      // Update conversation status
      await storage.updateConversation(
        conversationId,
        {
          handoffStatus: 'completed',
        },
        tenantId,
      );

      // Decrement agent's active chats
      await storage.decrementActiveChats(humanAgentId, tenantId);

      // Broadcast completion
      broadcastToTenant(tenantId, 'handoff_completed', {
        conversationId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error completing handoff:', error);
      res.status(500).json({ error: 'Failed to complete handoff' });
    }
  });

  // ===== Widget Embed Endpoints (Public) =====

  // Serve widget.js with CORS headers for embedding
  app.get('/widget.js', async (_req, res) => {
    try {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');

      // In development, disable caching for easier iteration
      // In production, cache for 1 hour
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }

      // In production, serve from dist/public
      // In development, serve from client/public
      const fs = await import('fs');
      const path = await import('path');

      const widgetPath = isDev
        ? path.resolve(process.cwd(), 'client/public/widget.js')
        : path.resolve(import.meta.dirname, 'public/widget.js');

      if (!fs.existsSync(widgetPath)) {
        return res.status(404).json({ error: 'Widget file not found' });
      }

      const widgetContent = fs.readFileSync(widgetPath, 'utf-8');
      res.send(widgetContent);
    } catch (error) {
      console.error('Error serving widget.js:', error);
      res.status(500).json({ error: 'Failed to load widget' });
    }
  });

  // Helper function to validate domain restrictions for widget endpoints
  function validateWidgetDomain(widgetConfig: any, referrer: string | undefined): boolean {
    // If no domains configured, allow all
    if (!widgetConfig.allowedDomains || widgetConfig.allowedDomains.length === 0) {
      return true;
    }

    // If no referrer provided, block (should always have referrer from widget)
    if (!referrer) {
      return false;
    }

    // Check if referrer matches any allowed domain
    return widgetConfig.allowedDomains.some((domain: string) => {
      // Support wildcard subdomains (*.example.com)
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return referrer.endsWith(baseDomain) || referrer === baseDomain.replace('*.', '');
      }
      return referrer === domain || referrer.endsWith('.' + domain);
    });
  }

  // Widget initialization endpoint - validates API key and returns configuration
  app.post('/api/widget/init', async (req, res) => {
    try {
      const { apiKey, referrer } = z
        .object({
          apiKey: z.string(),
          referrer: z.string().optional(),
        })
        .parse(req.body);

      // Enable CORS for widget embedding
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      let tenantId: string;
      let widgetConfig;

      // Check if this is a platform admin test token
      if (apiKey.startsWith('test_')) {
        console.log('[Widget Test] Received test token:', apiKey);
        console.log('[Widget Test] Available tokens:', Array.from(widgetTestTokens.keys()));

        const testTokenData = widgetTestTokens.get(apiKey);

        if (!testTokenData) {
          console.log('[Widget Test] Test token not found in map');
          return res.status(401).json({ error: 'Invalid or expired test token' });
        }

        tenantId = testTokenData.tenantId;
        console.log('[Widget Test] Platform admin testing widget for tenant:', tenantId);
      } else {
        // Normal API key validation - get all keys for tenant and verify with bcrypt
        const allApiKeys = await storage.getAllApiKeys();
        let apiKeyRecord = null;

        for (const key of allApiKeys) {
          const isMatch = await verifyPassword(apiKey, key.keyHash);
          if (isMatch) {
            apiKeyRecord = key;
            break;
          }
        }

        if (!apiKeyRecord) {
          return res.status(401).json({ error: 'Invalid API key' });
        }

        // Update last used timestamp
        await storage.updateApiKeyLastUsed(apiKeyRecord.id);
        tenantId = apiKeyRecord.tenantId;
      }

      // Get widget configuration for this tenant
      widgetConfig = await storage.getWidgetConfig(tenantId);

      if (!widgetConfig) {
        return res.status(404).json({ error: 'Widget configuration not found' });
      }

      // Check domain restrictions if configured
      if (widgetConfig.allowedDomains && widgetConfig.allowedDomains.length > 0 && referrer) {
        const isAllowed = widgetConfig.allowedDomains.some((domain: string) => {
          // Support wildcard subdomains (*.example.com)
          if (domain.startsWith('*.')) {
            const baseDomain = domain.slice(2);
            return referrer.endsWith(baseDomain) || referrer === baseDomain.replace('*.', '');
          }
          return referrer === domain || referrer.endsWith('.' + domain);
        });

        if (!isAllowed) {
          return res.status(403).json({
            error: 'Domain not allowed',
            message: `This widget is restricted to: ${widgetConfig.allowedDomains.join(', ')}`,
          });
        }
      }

      // Get tenant integration for WhatsApp config
      const integration = await storage.getTenantIntegration(tenantId);
      let whatsappPhoneNumber = null;

      // Check if WhatsApp is available - either through integration OR if widget has whatsappAgentId
      const hasWhatsappIntegration = integration?.whatsappEnabled && integration?.whatsappConfig;
      const hasWhatsappAgent = !!widgetConfig.whatsappAgentId;

      if (hasWhatsappIntegration) {
        try {
          const config = integration.whatsappConfig as any;
          whatsappPhoneNumber = config.phoneNumber || null;
        } catch (e) {
          console.error('[Widget Init] Error parsing WhatsApp config:', e);
        }
      }

      // WhatsApp is available if we have BOTH agent ID and phone number
      const whatsappAvailable = hasWhatsappAgent && !!whatsappPhoneNumber;

      // Return safe configuration (exclude sensitive data)
      res.json({
        tenantId: tenantId,
        greeting: widgetConfig.greeting,
        primaryColor: widgetConfig.primaryColor || '#9b7ddd',
        textColor: widgetConfig.textColor || '#ffffff',
        borderRadius: widgetConfig.borderRadius || '12px',
        position: widgetConfig.position || 'bottom-right',
        whatsappAvailable: whatsappAvailable,
        whatsappPhoneNumber: whatsappPhoneNumber,
      });
    } catch (error) {
      console.error('Error initializing widget:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to initialize widget' });
    }
  });

  // Handle CORS preflight for widget init
  app.options('/api/widget/init', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  // Widget chat endpoint for text-based conversations
  app.post('/api/widget/chat', async (req, res) => {
    try {
      const { apiKey, message, chatId, referrer } = z
        .object({
          apiKey: z.string(),
          message: z.string().min(1),
          chatId: z.string().nullable().optional(),
          referrer: z.string().optional(),
        })
        .parse(req.body);

      // Enable CORS for widget embedding
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      let tenantId: string;

      // Check if this is a platform admin test token
      if (apiKey.startsWith('test_')) {
        const testTokenData = widgetTestTokens.get(apiKey);

        if (!testTokenData) {
          return res.status(401).json({ error: 'Invalid or expired test token' });
        }

        tenantId = testTokenData.tenantId;
        console.log('[Widget Test] Platform admin chat message for tenant:', tenantId);
      } else {
        // Validate API key - get all keys and verify with bcrypt
        const allApiKeys = await storage.getAllApiKeys();
        let apiKeyRecord = null;

        for (const key of allApiKeys) {
          const isMatch = await verifyPassword(apiKey, key.keyHash);
          if (isMatch) {
            apiKeyRecord = key;
            break;
          }
        }

        if (!apiKeyRecord) {
          return res.status(401).json({ error: 'Invalid API key' });
        }

        tenantId = apiKeyRecord.tenantId;
      }

      // Get widget configuration for this tenant
      const widgetConfig = await storage.getWidgetConfig(tenantId);

      if (!widgetConfig || !widgetConfig.retellApiKey || !widgetConfig.retellAgentId) {
        return res.status(400).json({
          error: 'Widget not configured',
          message: 'Please configure Retell AI credentials in the admin panel',
        });
      }

      // Check domain restrictions
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig?.allowedDomains?.join(', ')}`,
        });
      }

      // Create a Retell client using the tenant's API key
      const tenantRetellClient = new Retell({
        apiKey: widgetConfig.retellApiKey,
      });

      // Use existing chatId or create new session
      let retellChatId = chatId;
      let isNewSession = false;

      if (!retellChatId) {
        console.log('[Widget Chat] Creating new chat session');
        const chatSession = await tenantRetellClient.chat.create({
          agent_id: widgetConfig.retellAgentId,
          metadata: {
            tenantId: tenantId,
            source: 'widget',
          },
        });
        retellChatId = chatSession.chat_id;
        isNewSession = true;
        console.log('[Widget Chat] Created session:', retellChatId);

        // Give Retell a moment to fully initialize the new session
        // This prevents the first message from failing due to session not being ready
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Send message to Retell and get response with retry logic for new sessions
      console.log('[Widget Chat] Sending message:', message);
      let completion;
      let retries = isNewSession ? 3 : 1;
      let lastError;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          completion = await tenantRetellClient.chat.createChatCompletion({
            chat_id: retellChatId,
            content: message,
          });
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          console.error(`[Widget Chat] Attempt ${attempt}/${retries} failed:`, error.message);

          if (attempt < retries) {
            // Exponential backoff: 300ms, 600ms
            const delay = 300 * attempt;
            console.log(`[Widget Chat] Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!completion) {
        throw lastError || new Error('Failed to get completion from Retell');
      }

      // Extract ALL agent responses from this interaction
      const messages = completion.messages || [];
      const assistantMessages = messages.filter(
        (msg: any) =>
          (msg.role === 'agent' || msg.role === 'assistant') &&
          typeof msg.content === 'string' &&
          msg.content.trim().length > 0,
      );

      // Return all messages as an array for client-side display with delays
      let responseMessages = ["I'm processing your request..."];
      if (assistantMessages.length > 0) {
        responseMessages = assistantMessages.map((msg: any) => msg.content);
      }

      console.log('[Widget Chat] Total assistant messages:', assistantMessages.length);

      // Save messages to database for history persistence
      try {
        // Save user message
        await storage.createWidgetChatMessage({
          tenantId: tenantId,
          chatId: retellChatId,
          role: 'user',
          content: message,
        });

        // Save combined assistant response
        const combinedResponse = responseMessages.join('\n\n');
        await storage.createWidgetChatMessage({
          tenantId: tenantId,
          chatId: retellChatId,
          role: 'assistant',
          content: combinedResponse,
        });

        console.log('[Widget Chat] Messages saved to database');
      } catch (dbError) {
        console.error('[Widget Chat] Failed to save messages to database:', dbError);
        // Don't fail the request if database save fails
      }

      // Return all messages for client-side sequential display
      res.json({
        messages: responseMessages,
        chatId: retellChatId,
      });
    } catch (error: any) {
      console.error('[Widget Chat] Error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }

      // Provide more specific error messages
      let errorMessage = 'Failed to process chat message';
      if (error.message?.includes('chat_id')) {
        errorMessage = 'Chat session error. Please try again.';
      } else if (error.message?.includes('agent_id')) {
        errorMessage = 'AI agent configuration error. Please contact support.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }

      res.status(500).json({
        error: errorMessage,
        message: error.message, // Include detailed error for debugging
      });
    }
  });

  // Handle CORS preflight for chat endpoint
  app.options('/api/widget/chat', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  // Get complete session history (chat + handoff messages)
  app.get('/api/widget/session/:chatId/history', async (req, res) => {
    try {
      const { chatId } = req.params;
      const { apiKey, handoffId, referrer } = z
        .object({
          apiKey: z.string(),
          handoffId: z.string().optional(),
          referrer: z.string().optional(),
        })
        .parse(req.query);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Get widget configuration for domain validation
      const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
      if (!widgetConfig) {
        return res.status(500).json({ error: 'Widget configuration not found' });
      }

      // Validate domain restriction
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
        });
      }

      // Get chat messages from database
      const chatMessages = await storage.getWidgetChatMessages(chatId);

      // Get handoff messages if handoffId provided
      let handoffMessages: any[] = [];
      let handoffStatus = 'none';

      if (handoffId) {
        handoffMessages = await storage.getWidgetHandoffMessages(handoffId);

        // Get handoff status
        const handoff = await storage.getWidgetHandoff(handoffId);
        if (handoff) {
          handoffStatus = handoff.status;
        }
      }

      // Merge and sort all messages by timestamp
      const allMessages = [
        ...chatMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        ...handoffMessages.map((msg) => ({
          id: msg.id,
          role: msg.senderType === 'agent' ? 'agent' : msg.senderType,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      console.log(`[Widget History] Returning ${allMessages.length} messages for chat ${chatId}`);

      // Return complete history
      res.json({
        chatId,
        handoffId: handoffId || null,
        handoffStatus,
        messages: allMessages,
      });
    } catch (error) {
      console.error('[Widget History] Error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to fetch session history' });
    }
  }); // Handle CORS preflight for session history endpoint
  app.options('/api/widget/session/:chatId/history', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  // ============================================
  // WIDGET HANDOFF ENDPOINTS
  // ============================================

  // Request human agent handoff
  app.post('/api/widget/handoff', async (req, res) => {
    try {
      const {
        apiKey,
        chatId,
        conversationHistory,
        lastUserMessage,
        userEmail,
        userMessage,
        referrer,
      } = z
        .object({
          apiKey: z.string(),
          chatId: z.string(),
          conversationHistory: z.array(z.any()).optional(),
          lastUserMessage: z.string().optional(),
          userEmail: z.string().email().optional(),
          userMessage: z.string().optional(),
          referrer: z.string().optional(),
        })
        .parse(req.body);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Get widget configuration for domain validation
      const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
      if (!widgetConfig) {
        return res.status(500).json({ error: 'Widget configuration not found' });
      }

      // Validate domain restriction
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
        });
      }

      // Check if agents are available
      const availableAgents = await storage.getAvailableHumanAgents(apiKeyRecord.tenantId);
      const hasAvailableAgents = availableAgents.some(
        (agent) => agent.status === 'available' && agent.activeChats < agent.maxChats,
      );

      // Create handoff request
      const handoff = await storage.createWidgetHandoff({
        tenantId: apiKeyRecord.tenantId,
        chatId,
        status: hasAvailableAgents ? 'pending' : 'pending', // Will be 'pending' either way
        conversationHistory: conversationHistory || null,
        lastUserMessage: lastUserMessage || null,
        userEmail: userEmail || null,
        userMessage: userMessage || null,
        metadata: null,
        assignedAgentId: null,
        pickedUpAt: null,
        resolvedAt: null,
      });

      // Broadcast to agents via WebSocket (if available)
      const wss = (req as any).ws;
      if (wss) {
        wss.clients.forEach((client: any) => {
          if (
            client.tenantId === apiKeyRecord.tenantId &&
            client.readyState === 1 // OPEN
          ) {
            client.send(
              JSON.stringify({
                type: 'new_handoff',
                handoff: {
                  id: handoff.id,
                  chatId: handoff.chatId,
                  lastUserMessage: handoff.lastUserMessage,
                  requestedAt: handoff.requestedAt,
                },
              }),
            );
          }
        });
      }

      res.json({
        handoffId: handoff.id,
        status: hasAvailableAgents ? 'pending' : 'after-hours',
        message: hasAvailableAgents
          ? 'Handoff request created. An agent will be with you shortly.'
          : 'No agents available. Please leave your contact information.',
      });
    } catch (error) {
      console.error('[Widget Handoff] Error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create handoff request' });
    }
  });

  // Get handoff status
  app.get('/api/widget/handoff/:handoffId/status', async (req, res) => {
    try {
      const { handoffId } = req.params;
      const { apiKey, referrer } = z
        .object({
          apiKey: z.string(),
          referrer: z.string().optional(),
        })
        .parse(req.query);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Get widget configuration for domain validation
      const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
      if (!widgetConfig) {
        return res.status(500).json({ error: 'Widget configuration not found' });
      }

      // Validate domain restriction
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
        });
      }

      const handoff = await storage.getWidgetHandoff(handoffId);

      if (!handoff || handoff.tenantId !== apiKeyRecord.tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      let agentName = null;
      if (handoff.assignedAgentId) {
        const agent = await storage.getHumanAgent(handoff.assignedAgentId);
        agentName = agent?.name || null;
      }

      res.json({
        status: handoff.status,
        agentName,
        pickedUpAt: handoff.pickedUpAt,
        resolvedAt: handoff.resolvedAt,
      });
    } catch (error) {
      console.error('[Widget Handoff Status] Error:', error);
      res.status(500).json({ error: 'Failed to get handoff status' });
    }
  });

  // Send message during handoff
  app.post('/api/widget/handoff/:handoffId/message', async (req, res) => {
    try {
      const { handoffId } = req.params;
      const { apiKey, message, referrer } = z
        .object({
          apiKey: z.string(),
          message: z.string().min(1),
          referrer: z.string().optional(),
        })
        .parse(req.body);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Get widget configuration for domain validation
      const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
      if (!widgetConfig) {
        return res.status(500).json({ error: 'Widget configuration not found' });
      }

      // Validate domain restriction
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
        });
      }

      const handoff = await storage.getWidgetHandoff(handoffId);

      if (!handoff || handoff.tenantId !== apiKeyRecord.tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      if (handoff.status !== 'active') {
        return res.status(400).json({ error: 'Handoff is not active' });
      }

      // Save user message
      const savedMessage = await storage.createWidgetHandoffMessage({
        handoffId,
        senderType: 'user',
        senderId: null,
        content: message,
      });

      // Send to agent via WebSocket
      const wss = (req as any).ws;
      if (wss && handoff.assignedAgentId) {
        wss.clients.forEach((client: any) => {
          if (
            client.userId === handoff.assignedAgentId &&
            client.readyState === 1 // OPEN
          ) {
            client.send(
              JSON.stringify({
                type: 'handoff_message',
                handoffId,
                message: {
                  id: savedMessage.id,
                  content: savedMessage.content,
                  senderType: 'user',
                  timestamp: savedMessage.timestamp,
                },
              }),
            );
          }
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Widget Handoff Message] Error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Get handoff messages (for polling)
  app.get('/api/widget/handoff/:handoffId/messages', async (req, res) => {
    try {
      const { handoffId } = req.params;
      const { apiKey, since, referrer } = z
        .object({
          apiKey: z.string(),
          since: z.string().optional(),
          referrer: z.string().optional(),
        })
        .parse(req.query);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Get widget configuration for domain validation
      const widgetConfig = await storage.getWidgetConfig(apiKeyRecord.tenantId);
      if (!widgetConfig) {
        return res.status(500).json({ error: 'Widget configuration not found' });
      }

      // Validate domain restriction
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
        });
      }

      const handoff = await storage.getWidgetHandoff(handoffId);

      if (!handoff || handoff.tenantId !== apiKeyRecord.tenantId) {
        return res.status(404).json({ error: 'Handoff not found' });
      }

      let messages;
      if (since) {
        const sinceDate = new Date(since);
        messages = await storage.getWidgetHandoffMessagesSince(handoffId, sinceDate);
      } else {
        messages = await storage.getWidgetHandoffMessages(handoffId);
      }

      res.json({ messages });
    } catch (error) {
      console.error('[Widget Handoff Messages] Error:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  });

  // CORS preflight handlers
  app.options('/api/widget/handoff', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  app.options('/api/widget/handoff/:handoffId/status', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  app.options('/api/widget/handoff/:handoffId/message', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  app.options('/api/widget/handoff/:handoffId/messages', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  // End chat (user-initiated) - Resolves active handoff if exists
  app.post('/api/widget/end-chat', async (req, res) => {
    try {
      const { apiKey, chatId, handoffId, referrer } = z
        .object({
          apiKey: z.string(),
          chatId: z.string(),
          handoffId: z.string().optional(),
          referrer: z.string().optional(),
        })
        .parse(req.body);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Validate API key - get all keys and verify with bcrypt
      const allApiKeys = await storage.getAllApiKeys();
      let apiKeyRecord = null;

      for (const key of allApiKeys) {
        const isMatch = await verifyPassword(apiKey, key.keyHash);
        if (isMatch) {
          apiKeyRecord = key;
          break;
        }
      }

      if (!apiKeyRecord) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const tenantId = apiKeyRecord.tenantId;

      // Get widget configuration for domain validation
      const widgetConfig = await storage.getWidgetConfig(tenantId);
      if (!widgetConfig) {
        return res.status(500).json({ error: 'Widget configuration not found' });
      }

      // Validate domain restriction
      if (!validateWidgetDomain(widgetConfig, referrer)) {
        return res.status(403).json({
          error: 'Domain not allowed',
          message: `This widget is restricted to: ${widgetConfig.allowedDomains?.join(', ')}`,
        });
      }

      // If there's an active handoff, resolve it
      if (handoffId) {
        const handoff = await storage.getWidgetHandoff(handoffId);

        if (handoff && handoff.tenantId === tenantId && handoff.status === 'active') {
          // Update handoff status to resolved
          await storage.updateWidgetHandoffStatus(handoffId, 'resolved');

          // Decrement agent's active chats
          if (handoff.assignedAgentId) {
            await storage.decrementActiveChats(handoff.assignedAgentId, tenantId);
          }

          // Add system message that user ended the chat
          await storage.createWidgetHandoffMessage({
            handoffId,
            senderType: 'system',
            senderId: null,
            content: 'User ended the chat',
          });

          // Broadcast via WebSocket to agent
          const wss = (req as any).ws;
          if (wss) {
            wss.clients.forEach((client: any) => {
              if (client.tenantId === tenantId && client.readyState === 1) {
                client.send(
                  JSON.stringify({
                    type: 'handoff_resolved',
                    handoffId: handoffId,
                    resolvedBy: 'user',
                  }),
                );
              }
            });
          }
        }
      }

      res.json({
        success: true,
        message: 'Chat ended successfully',
      });
    } catch (error) {
      console.error('[Widget End Chat] Error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to end chat' });
    }
  });

  // CORS preflight for end chat
  app.options('/api/widget/end-chat', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });

  // ============================================
  // OAUTH CREDENTIAL MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Initiate WhatsApp OAuth authorization
   * GET /api/platform/tenants/:tenantId/oauth/whatsapp/authorize
   *
   * Redirects user to Meta's OAuth authorization page using tenant's configured OAuth app
   */
  app.get(
    '/api/platform/tenants/:tenantId/oauth/whatsapp/authorize',
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;

        // Get tenant's OAuth credential configuration
        const credential = await storage.getOAuthCredential(tenantId, 'whatsapp');

        if (!credential || !credential.clientId) {
          return res.status(400).json({
            error: 'WhatsApp OAuth app not configured',
            message: 'Please configure your WhatsApp App ID and App Secret first',
          });
        }

        const clientId = credential.clientId;
        const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/platform/oauth/callback/whatsapp`;
        const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');

        // Scopes for WhatsApp Business API
        const scopes = ['whatsapp_business_management', 'whatsapp_business_messaging'].join(',');

        const authUrl =
          `https://www.facebook.com/v21.0/dialog/oauth?` +
          `client_id=${clientId}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&state=${state}` +
          `&scope=${scopes}` +
          `&response_type=code`;

        console.log('[OAuth] WhatsApp authorization initiated for tenant:', tenantId);

        res.redirect(authUrl);
      } catch (error) {
        console.error('[OAuth] Error initiating WhatsApp authorization:', error);
        res.status(500).json({ error: 'Failed to initiate authorization' });
      }
    },
  );

  /**
   * Handle WhatsApp OAuth callback
   * GET /api/platform/oauth/callback/whatsapp
   *
   * Receives authorization code from Meta and exchanges it for access token
   */
  app.get('/api/platform/oauth/callback/whatsapp', async (req: Request, res: Response) => {
    try {
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        console.error('[OAuth] Authorization error:', oauthError);
        return res.redirect(`/?oauth_error=${oauthError}`);
      }

      if (!code || !state) {
        return res.status(400).json({ error: 'Missing authorization code or state' });
      }

      // Decode state to get tenant ID
      const { tenantId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

      // Get tenant's OAuth credential configuration
      const credential = await storage.getOAuthCredential(tenantId, 'whatsapp');

      if (!credential || !credential.clientId || !credential.clientSecret) {
        console.error('[OAuth] Tenant OAuth app not configured for callback');
        return res.redirect(`/?oauth_error=app_not_configured`);
      }

      // Decrypt clientSecret for token exchange
      const clientSecret = decrypt(credential.clientSecret);

      // Exchange authorization code for access token
      const tokenUrl = 'https://graph.facebook.com/v21.0/oauth/access_token';
      const params = new URLSearchParams({
        client_id: credential.clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: `${process.env.APP_URL || 'http://localhost:3000'}/api/platform/oauth/callback/whatsapp`,
      });

      const tokenResponse = await fetch(`${tokenUrl}?${params.toString()}`);
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('[OAuth] Token exchange failed:', errorData);
        throw new Error('Failed to exchange authorization code for token');
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        token_type: string;
        expires_in?: number;
      };

      console.log('[OAuth] Successfully obtained WhatsApp access token for tenant:', tenantId);

      // Encrypt access token before storing
      const encryptedAccessToken = encrypt(tokenData.access_token);

      // Calculate token expiry (default to 60 days if not provided)
      const expiresIn = tokenData.expires_in || 60 * 24 * 60 * 60; // 60 days in seconds
      const tokenExpiry = new Date(Date.now() + expiresIn * 1000);

      // Update existing credential with new access token
      await storage.updateOAuthCredential(credential.id, {
        accessToken: encryptedAccessToken,
        tokenExpiry,
        isActive: true,
      });
      console.log('[OAuth] Updated WhatsApp access token for tenant:', tenantId);

      // Redirect back to integration management page with success
      res.redirect('/?oauth_success=whatsapp');
    } catch (error) {
      console.error('[OAuth] Error handling WhatsApp callback:', error);
      res.redirect('/?oauth_error=token_exchange_failed');
    }
  });

  /**
   * Get OAuth credential status for a tenant
   * GET /api/platform/tenants/:tenantId/oauth/:provider
   *
   * Returns connection status without exposing credentials
   */
  app.get(
    '/api/platform/tenants/:tenantId/oauth/:provider',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { tenantId, provider } = req.params;

        // Verify user has access to this tenant
        const userTenantId = assertTenant(req, res);
        if (!userTenantId || userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }

        const credential = await storage.getOAuthCredential(tenantId, provider);

        if (!credential) {
          return res.json({
            connected: false,
            configured: false,
            provider,
          });
        }

        // Check if app is configured (has clientId and clientSecret)
        const isConfigured = Boolean(credential.clientId && credential.clientSecret);
        const isConnected = Boolean(credential.accessToken && credential.isActive);

        res.json({
          connected: isConnected,
          configured: isConfigured,
          provider: credential.provider,
          isActive: credential.isActive,
          tokenExpiry: credential.tokenExpiry,
          scopes: credential.scopes,
          lastUsedAt: credential.lastUsedAt,
          createdAt: credential.createdAt,
        });
      } catch (error) {
        console.error('[OAuth] Error fetching credential status:', error);
        res.status(500).json({ error: 'Failed to fetch credential status' });
      }
    },
  );

  /**
   * Disconnect OAuth credential for a tenant
   * DELETE /api/platform/tenants/:tenantId/oauth/:provider
   *
   * Removes stored OAuth credential
   */
  app.delete(
    '/api/platform/tenants/:tenantId/oauth/:provider',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { tenantId, provider } = req.params;

        // Verify user has access to this tenant
        const userTenantId = assertTenant(req, res);
        if (!userTenantId || userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }

        const credential = await storage.getOAuthCredential(tenantId, provider);

        if (!credential) {
          return res.status(404).json({ error: 'OAuth credential not found' });
        }

        await storage.deleteOAuthCredential(credential.id);

        console.log(
          '[OAuth] Deleted OAuth credential for tenant:',
          tenantId,
          'provider:',
          provider,
        );

        res.json({ success: true });
      } catch (error) {
        console.error('[OAuth] Error deleting credential:', error);
        res.status(500).json({ error: 'Failed to delete credential' });
      }
    },
  );

  /**
   * Configure OAuth app credentials for a tenant
   * POST /api/platform/tenants/:tenantId/oauth/:provider/configure
   *
   * Allows tenant to set their OAuth App ID and App Secret before connecting
   */
  app.post(
    '/api/platform/tenants/:tenantId/oauth/:provider/configure',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { tenantId, provider } = req.params;
        const { clientId, clientSecret } = req.body;

        // Verify user has access to this tenant
        const userTenantId = assertTenant(req, res);
        if (!userTenantId || userTenantId !== tenantId) {
          return res.status(403).json({ error: 'Access denied to this tenant' });
        }

        // Validate input
        if (!clientId || !clientSecret) {
          return res.status(400).json({
            error: 'Missing required fields',
            message: 'Both App ID and App Secret are required',
          });
        }

        // Encrypt the client secret
        const encryptedClientSecret = encrypt(clientSecret);

        // Check if credential already exists
        const existingCredential = await storage.getOAuthCredential(tenantId, provider);

        if (existingCredential) {
          // Update existing credential's app configuration
          await storage.updateOAuthCredential(existingCredential.id, {
            clientId,
            clientSecret: encryptedClientSecret,
          });
          console.log(
            '[OAuth] Updated app configuration for tenant:',
            tenantId,
            'provider:',
            provider,
          );
        } else {
          // Create new credential with app configuration (but no tokens yet)
          await storage.createOAuthCredential({
            tenantId,
            provider,
            clientId,
            clientSecret: encryptedClientSecret,
            scopes:
              provider === 'whatsapp'
                ? ['whatsapp_business_management', 'whatsapp_business_messaging']
                : [],
            isActive: false, // Not active until OAuth flow completes
          });
          console.log(
            '[OAuth] Created app configuration for tenant:',
            tenantId,
            'provider:',
            provider,
          );
        }

        res.json({
          success: true,
          message: 'OAuth app configured successfully. You can now connect.',
        });
      } catch (error) {
        console.error('[OAuth] Error configuring app credentials:', error);
        res.status(500).json({ error: 'Failed to configure OAuth app' });
      }
    },
  );

  // ============================================
  // WHATSAPP PROXY API ENDPOINTS
  // ============================================

  /**
   * Middleware to validate N8N webhook secret
   * Ensures only authorized N8N instances can call proxy APIs
   */
  const validateN8NSecret = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error('[Proxy] N8N_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Proxy authentication not configured' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (token !== expectedSecret) {
      console.warn('[Proxy] Invalid N8N webhook secret attempted');
      return res.status(401).json({ error: 'Invalid authorization token' });
    }

    next();
  };

  /**
   * Helper function to get and decrypt WhatsApp access token
   * Automatically refreshes token if expired (future enhancement)
   */
  async function getWhatsAppAccessToken(tenantId: string): Promise<string> {
    const credential = await storage.getOAuthCredential(tenantId, 'whatsapp');

    if (!credential || !credential.isActive) {
      throw new Error('WhatsApp credential not found or inactive');
    }

    // Check if token is expired
    if (credential.tokenExpiry && new Date() >= new Date(credential.tokenExpiry)) {
      console.warn('[Proxy] WhatsApp token expired for tenant:', tenantId);
      // TODO: Implement token refresh logic when Meta supports refresh tokens
      throw new Error('WhatsApp token expired. Please reconnect your WhatsApp account.');
    }

    // Decrypt the access token
    if (!credential.accessToken) {
      throw new Error('WhatsApp access token not found');
    }
    const accessToken = decrypt(credential.accessToken);

    // Update last used timestamp
    await storage.markOAuthCredentialUsed(credential.id);

    return accessToken;
  }

  /**
   * Send WhatsApp message
   * POST /api/proxy/:tenantId/whatsapp/send
   *
   * Proxies WhatsApp send message requests from N8N
   * Body: { to, type, template, text, etc. }
   */
  app.post(
    '/api/proxy/:tenantId/whatsapp/send',
    validateN8NSecret,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;
        const messageData = req.body;

        console.log('[Proxy] WhatsApp send request for tenant:', tenantId);

        // Get decrypted access token from database
        const accessToken = await getWhatsAppAccessToken(tenantId);

        // Get phone number ID from credential metadata or use environment default
        const credential = await storage.getOAuthCredential(tenantId, 'whatsapp');
        const phoneNumberId =
          (credential?.metadata as any)?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!phoneNumberId) {
          throw new Error('WhatsApp phone number ID not configured');
        }

        // Send message to WhatsApp Business API
        const whatsappUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

        const response = await fetch(whatsappUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        });

        const responseData = await response.json();

        if (!response.ok) {
          console.error('[Proxy] WhatsApp API error:', responseData);
          return res.status(response.status).json({
            error: 'WhatsApp API request failed',
            details: responseData,
          });
        }

        console.log('[Proxy] WhatsApp message sent successfully:', responseData.messages?.[0]?.id);

        res.json(responseData);
      } catch (error) {
        console.error('[Proxy] Error sending WhatsApp message:', error);
        res.status(500).json({
          error: 'Failed to send WhatsApp message',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * Get WhatsApp message templates
   * GET /api/proxy/:tenantId/whatsapp/templates
   *
   * Proxies WhatsApp templates request from N8N
   */
  app.get(
    '/api/proxy/:tenantId/whatsapp/templates',
    validateN8NSecret,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;

        console.log('[Proxy] WhatsApp templates request for tenant:', tenantId);

        // Get decrypted access token from database
        const accessToken = await getWhatsAppAccessToken(tenantId);

        // Get business account ID from credential metadata or environment
        const credential = await storage.getOAuthCredential(tenantId, 'whatsapp');
        const businessAccountId =
          (credential?.metadata as any)?.businessAccountId ||
          process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

        if (!businessAccountId) {
          throw new Error('WhatsApp business account ID not configured');
        }

        // Fetch templates from WhatsApp Business API
        const whatsappUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;

        const response = await fetch(whatsappUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const responseData = await response.json();

        if (!response.ok) {
          console.error('[Proxy] WhatsApp API error:', responseData);
          return res.status(response.status).json({
            error: 'WhatsApp API request failed',
            details: responseData,
          });
        }

        console.log(
          '[Proxy] WhatsApp templates fetched successfully:',
          responseData.data?.length || 0,
          'templates',
        );

        res.json(responseData);
      } catch (error) {
        console.error('[Proxy] Error fetching WhatsApp templates:', error);
        res.status(500).json({
          error: 'Failed to fetch WhatsApp templates',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * Get WhatsApp media (for handling incoming media in webhooks)
   * GET /api/proxy/:tenantId/whatsapp/media/:mediaId
   *
   * Proxies WhatsApp media download request from N8N
   */
  app.get(
    '/api/proxy/:tenantId/whatsapp/media/:mediaId',
    validateN8NSecret,
    async (req: Request, res: Response) => {
      try {
        const { tenantId, mediaId } = req.params;

        console.log('[Proxy] WhatsApp media request for tenant:', tenantId, 'media:', mediaId);

        // Get decrypted access token from database
        const accessToken = await getWhatsAppAccessToken(tenantId);

        // Fetch media URL from WhatsApp Business API
        const whatsappUrl = `https://graph.facebook.com/v21.0/${mediaId}`;

        const response = await fetch(whatsappUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const responseData = await response.json();

        if (!response.ok) {
          console.error('[Proxy] WhatsApp API error:', responseData);
          return res.status(response.status).json({
            error: 'WhatsApp API request failed',
            details: responseData,
          });
        }

        console.log('[Proxy] WhatsApp media URL fetched successfully');

        res.json(responseData);
      } catch (error) {
        console.error('[Proxy] Error fetching WhatsApp media:', error);
        res.status(500).json({
          error: 'Failed to fetch WhatsApp media',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
   * Test WhatsApp connection
   * GET /api/proxy/:tenantId/whatsapp/test
   *
   * Tests WhatsApp connection by fetching phone number info
   */
  app.get(
    '/api/proxy/:tenantId/whatsapp/test',
    validateN8NSecret,
    async (req: Request, res: Response) => {
      try {
        const { tenantId } = req.params;

        console.log('[Proxy] WhatsApp connection test for tenant:', tenantId);

        // Get decrypted access token from database
        const accessToken = await getWhatsAppAccessToken(tenantId);

        // Get phone number ID from credential metadata or environment
        const credential = await storage.getOAuthCredential(tenantId, 'whatsapp');
        const phoneNumberId =
          (credential?.metadata as any)?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!phoneNumberId) {
          throw new Error('WhatsApp phone number ID not configured');
        }

        // Fetch phone number info from WhatsApp Business API
        const whatsappUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}`;

        const response = await fetch(whatsappUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const responseData = await response.json();

        if (!response.ok) {
          console.error('[Proxy] WhatsApp API error:', responseData);
          return res.status(response.status).json({
            error: 'WhatsApp API request failed',
            details: responseData,
            connected: false,
          });
        }

        console.log('[Proxy] WhatsApp connection test successful');

        res.json({
          connected: true,
          phoneNumber: responseData.display_phone_number,
          verifiedName: responseData.verified_name,
          quality: responseData.quality_rating,
        });
      } catch (error) {
        console.error('[Proxy] Error testing WhatsApp connection:', error);
        res.status(500).json({
          connected: false,
          error: 'Failed to test WhatsApp connection',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );
}

// Helper function to get response from Retell AI agent
async function getRetellAgentResponse(
  userMessage: string,
  conversationId: string,
  conversation: any,
  tenantId: string,
): Promise<string> {
  try {
    // Get tenant's widget config to find their Retell agent ID
    const widgetConfig = await storage.getWidgetConfig(tenantId);

    // Enforce tenant isolation: no agent ID = no chat
    if (!widgetConfig?.retellAgentId) {
      console.error(`[Retell] Tenant ${tenantId} has no configured Retell agent ID`);
      throw new Error(
        'Retell agent ID not configured. Please complete your widget configuration to enable AI chat.',
      );
    }

    const agentId = widgetConfig.retellAgentId;

    // Check if this conversation already has a Retell chat session
    let retellChatId = conversation.metadata?.retellChatId;

    // If no Retell session exists, create one
    if (!widgetConfig?.retellApiKey) {
      throw new Error('Retell API key not configured for this tenant.');
    }
    if (!retellChatId) {
      console.log('[Retell] Creating new chat session for conversation:', conversationId);
      console.log('[Retell] Using agent ID:', agentId);

      const tenantRetellClient = new Retell({ apiKey: widgetConfig.retellApiKey });
      const chatSession = await tenantRetellClient.chat.create({
        agent_id: agentId,
        metadata: {
          conversationId: conversationId,
          tenantId: tenantId,
        },
      });

      retellChatId = chatSession.chat_id;

      // Save Retell chat ID to conversation metadata (with tenantId for security)
      await storage.updateConversationMetadata(
        conversationId,
        {
          retellChatId: retellChatId,
        },
        tenantId,
      );

      console.log('[Retell] Created chat session:', retellChatId);
    }

    // Send message to Retell and get response
    const tenantRetellClient = new Retell({ apiKey: widgetConfig.retellApiKey });
    console.log('[Retell] Sending message to agent:', userMessage);
    const completion = await tenantRetellClient.chat.createChatCompletion({
      chat_id: retellChatId,
      content: userMessage,
    });

    // Extract the agent's response from the completion
    // The response includes full conversation history, we want the last assistant message
    const messages = completion.messages || [];

    // Debug: Log the response structure
    console.log('[Retell] Messages array length:', messages.length);
    if (messages.length > 0) {
      console.log(
        '[Retell] Message roles:',
        messages.map((m: any) => m.role),
      );
    }

    // Find the last agent message
    const lastAssistantMessage = messages
      .reverse()
      .find((msg: any) => msg.role === 'agent' || msg.role === 'assistant');

    if (!lastAssistantMessage) {
      // Sometimes the agent is processing tools and hasn't generated a response yet
      // Check if there are only tool messages
      const hasToolMessages = messages.some(
        (msg: any) => msg.role === 'tool_call_invocation' || msg.role === 'tool_call_result',
      );

      if (hasToolMessages) {
        console.log(
          '[Retell] Agent is processing, no text response yet. Treating as acknowledgment.',
        );
        return "I'm processing your request...";
      }

      console.error('[Retell] No agent/assistant message found and no tool processing detected');
      console.error('[Retell] Full response:', JSON.stringify(completion, null, 2));
      throw new Error('No agent response in Retell completion');
    }

    const content = (lastAssistantMessage as any).content;
    if (typeof content === 'string') {
      console.log('[Retell] Received response:', content.slice(0, 100) + '...');
      return content;
    }

    console.error('[Retell] Message content is not a string:', typeof content);
    throw new Error('Invalid message content format from Retell');
  } catch (error) {
    console.error('[Retell] Error getting agent response:', error);
    throw new Error('Failed to get response from Retell agent');
  }
}

// Helper function to generate conversation summary
async function generateConversationSummary(messages: any[]): Promise<string> {
  try {
    // If no messages, return default summary
    if (!messages || messages.length === 0) {
      return 'New conversation with no messages yet.';
    }

    // Create a simple summary from the conversation
    const userMessages = messages.filter((m) => m.role === 'user');
    const assistantMessages = messages.filter((m) => m.role === 'assistant');

    const summary = `Conversation Summary:
- Total messages: ${messages.length}
- User messages: ${userMessages.length}
- Assistant messages: ${assistantMessages.length}
- Latest user message: ${userMessages[userMessages.length - 1]?.content || 'N/A'}
- Topic: Customer inquiry requiring human assistance`;

    return summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Unable to generate summary';
  }
}
