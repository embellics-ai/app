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
import { registerClient, broadcastToTenant } from './websocket';
import type { WebSocket } from 'ws';

// Initialize global Retell client (legacy - for backward compatibility only)
// New tenants should use their own API keys stored in widget_configs
const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || '',
});

// DEPRECATED: Legacy global Retell agent ID - kept for reference only
// IMPORTANT: All chat sessions and analytics now use tenant-specific agent IDs from widget_configs.retellAgentId
// Tenants MUST configure their own Retell agent ID during onboarding
// TODO: Remove this constant once all legacy references are cleaned up
const RETELL_AGENT_ID = 'agent_de94cbe24ccb0228908b12dac3';

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
                primaryColor: '#667eea',
                position: 'bottom-right',
                greeting: 'Hi! How can I help you today?',
                placeholder: 'Type your message...',
                retellApiKey: null, // Platform admin will set this later
                retellAgentId: null, // Platform admin will set this later
              });

              console.log(`Created default widget config for tenant: ${tenantId}`);
            } else {
              console.log(`Widget config already exists for tenant: ${tenantId}`);
            }
          }

          // Create user account

          user = await storage.createClientUser({
            email: pendingInvitation.email,
            password: pendingInvitation.temporaryPassword, // Keep temp password for now (already hashed)
            firstName: pendingInvitation.firstName,
            lastName: pendingInvitation.lastName,
            tenantId: tenantId,
            role: pendingInvitation.role,
            isPlatformAdmin: pendingInvitation.role === 'admin',
            phoneNumber: pendingInvitation.phoneNumber || null,
            mustChangePassword: true, // Force password change on first login with temp password
            onboardingCompleted: false, // User must complete onboarding after changing password
          });

          console.log(
            `[Login] User created with password hash (first 10 chars): ${user.password.substring(
              0,
              10,
            )}...`,
          );

          // Mark invitation as accepted
          await storage.markInvitationAccepted(pendingInvitation.id, user.id);

          console.log(`User account created from invitation: ${user.email}`);
        } else {
          // No user and no pending invitation
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      } else {
        // STEP 4: User exists, verify password
        const isValidPassword = await verifyPassword(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      }

      // STEP 5: Generate JWT token with role information
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
          onboardingCompleted: user.onboardingCompleted,
          mustChangePassword: user.mustChangePassword, // Use dedicated field from database
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

  // Logout (client-side only, just returns success)
  app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
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

      // Mark token as used BEFORE updating password (prevents race conditions)
      await storage.markTokenAsUsedById(matchedToken.id);

      // Hash new password and update user
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateClientUserPassword(matchedToken.userId, hashedPassword);

      // Mark onboarding as complete if it wasn't already (in case of temp password reset)
      const user = await storage.getClientUser(matchedToken.userId);
      if (user && !user.onboardingCompleted) {
        await storage.updateClientUser(matchedToken.userId, {
          onboardingCompleted: true,
        });
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

        console.log(`[Invite User] Attempting to invite: ${data.email}`);

        // Check if user already exists
        const existingUser = await storage.getClientUserByEmail(data.email);
        if (existingUser) {
          console.log(`[Invite User] ❌ User already exists: ${data.email}`, existingUser);
          return res.status(400).json({ error: 'User with this email already exists' });
        }

        console.log(`[Invite User] ✓ Email is available: ${data.email}`);

        // Check if there's already a pending invitation for this email
        // If so, delete it and create a fresh one (allows resending invitations)
        const existingInvitation = await storage.getPendingInvitationByEmail(data.email);
        if (existingInvitation) {
          console.log(`Deleting old pending invitation for ${data.email} before creating new one`);
          await storage.deleteInvitation(existingInvitation.id);
        }

        // Generate temporary password
        const tempPassword = randomBytes(8).toString('hex');
        const hashedPassword = await hashPassword(tempPassword);

        // Determine tenant ID for client admins
        let tenantId: string | null = null;
        if (data.role === 'client_admin') {
          // Two scenarios:
          // 1. Inviting to existing tenant (tenantId provided) - additional admin
          // 2. Creating new tenant (no tenantId) - first admin

          if (data.tenantId) {
            // Validate that the tenant exists
            const existingTenant = await storage.getTenant(data.tenantId);
            if (!existingTenant) {
              return res.status(400).json({
                error: 'Specified tenant does not exist',
              });
            }
            tenantId = data.tenantId;
            console.log(`[Invite User] Inviting to existing tenant: ${tenantId}`);
          } else {
            // Creating new tenant - require company name
            if (!data.companyName) {
              return res.status(400).json({
                error: 'Company name is required when creating a new tenant',
              });
            }
            // Tenant will be created on first login
            tenantId = null;
            console.log(`[Invite User] Will create new tenant on first login`);
          }
        }

        // Create invitation record with pending status
        // Do NOT create user account yet - that happens on first login
        const invitation = await storage.createUserInvitation({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          temporaryPassword: hashedPassword,
          plainTemporaryPassword: tempPassword, // Store plain text for platform owner to view (cleared after 24h)
          role: data.role,
          tenantId: tenantId,
          companyName: data.companyName || null,
          companyPhone: data.companyPhone || null,
          invitedBy: req.user!.userId,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        // Send invitation email with temporary password
        let emailSent = false;
        let emailError: any = null;
        try {
          await sendInvitationEmail(
            data.email,
            data.firstName,
            data.lastName,
            tempPassword,
            data.role,
          );

          // Update invitation status to 'sent'
          await storage.updateInvitationStatus(invitation.id, 'sent', new Date());

          console.log(`✅ Invitation email sent successfully to ${data.email}`);
          emailSent = true;
        } catch (err) {
          emailError = err;
          console.error('❌ Failed to send invitation email:', err);
          console.error('Email error details:', {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          // Don't fail the whole request if email fails
          // Invitation is still created and temp password can be viewed by platform owner
        }

        // Return invitation with temp password (only for platform owner)
        // Frontend will show this to admin@embellics.com only
        res.json({
          invitation: {
            id: invitation.id,
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            role: invitation.role,
            status: invitation.status,
            createdAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
            tenantId: invitation.tenantId, // Include tenantId for test verification
          },
          temporaryPassword: tempPassword, // Only visible to platform owner (backward compatibility)
          plainTemporaryPassword: tempPassword, // Only visible to platform owner (consistent naming)
          emailSent,
          emailError: emailError
            ? emailError instanceof Error
              ? emailError.message
              : String(emailError)
            : null,
          message: emailSent
            ? 'Invitation created and email sent successfully'
            : 'Invitation created but email failed to send. Share the temporary password manually.',
        });
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
          // Only show temp password to platform owner
          plainTemporaryPassword: isOwner ? inv.plainTemporaryPassword : null,
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
            return {
              id: tenant.id,
              name: tenant.name,
              email: tenant.email,
              phone: tenant.phone,
              plan: tenant.plan,
              status: tenant.status,
              hasRetellApiKey: !!widgetConfig?.retellApiKey,
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
        const { retellApiKey, retellAgentId } = req.body;

        if (!retellApiKey || typeof retellApiKey !== 'string') {
          return res.status(400).json({ error: 'Retell API key is required' });
        }

        console.log(
          `[Update Retell API Key] Platform admin updating API key for tenant: ${tenantId}`,
        );

        // Check if tenant exists
        const tenant = await storage.getTenant(tenantId);
        if (!tenant) {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        // Get or create widget config for this tenant
        let widgetConfig = await storage.getWidgetConfig(tenantId);

        const updateData: any = {
          retellApiKey: retellApiKey.trim(),
        };

        // Include retellAgentId if provided
        if (retellAgentId) {
          updateData.retellAgentId = retellAgentId;
        }

        if (!widgetConfig) {
          // Create a new widget config with the Retell API key
          console.log(`[Update Retell API Key] Creating new widget config for tenant: ${tenantId}`);
          widgetConfig = await storage.createWidgetConfig({
            tenantId,
            ...updateData,
          });
        } else {
          // Update existing widget config
          console.log(
            `[Update Retell API Key] Updating existing widget config for tenant: ${tenantId}`,
          );
          widgetConfig = await storage.updateWidgetConfig(tenantId, updateData);
        }

        if (!widgetConfig) {
          return res.status(500).json({ error: 'Failed to update Retell API key' });
        }

        console.log(
          `[Update Retell API Key] ✓ Successfully updated Retell API key for tenant: ${tenantId}`,
        );

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
        try {
          await sendPasswordResetEmail(
            user.email,
            user.firstName || 'User',
            user.lastName || '',
            tempPassword,
          );
          console.log(`Password reset email sent to ${user.email}`);
        } catch (emailError) {
          console.error('Failed to send password reset email:', emailError);
          // Don't fail the request if email fails - temp password is still returned
        }

        res.json({
          message: 'Password reset successfully',
          temporaryPassword: tempPassword,
          email: user.email,
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
        res.json(invitations);
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

        // Generate temporary password
        const tempPassword = randomBytes(8).toString('hex');
        const hashedPassword = await hashPassword(tempPassword);

        // Security: Force invitation to use caller's tenantId (prevent cross-tenant invitation)
        const invitation = await storage.createUserInvitation({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          temporaryPassword: hashedPassword,
          plainTemporaryPassword: tempPassword, // Store plain text for viewing in Invitations tab
          role: data.role,
          tenantId: tenantId, // Always use authenticated user's tenant
          invitedBy: req.user?.userId ?? null,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        // Send invitation email
        let emailSent = false;
        let emailError: string | null = null;

        try {
          await sendInvitationEmail(
            data.email,
            data.firstName,
            data.lastName,
            tempPassword,
            data.role,
          );
          await storage.updateInvitationStatus(invitation.id, 'sent', new Date());
          console.log(`✅ Team member invitation email sent successfully to ${data.email}`);
          emailSent = true;
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
          console.error('❌ Failed to send team member invitation email:', err);
        }

        res.json({
          invitation: {
            id: invitation.id,
            email: invitation.email,
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            role: invitation.role,
            status: invitation.status,
            createdAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
            tenantId: invitation.tenantId,
          },
          temporaryPassword: tempPassword,
          plainTemporaryPassword: tempPassword,
          emailSent,
          emailError,
          message: emailSent
            ? 'Team member invitation created and email sent successfully'
            : 'Team member invitation created but email failed to send. Share the temporary password manually.',
        });
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
            console.log('[Retell] Ending chat session:', retellChatId);
            await retellClient.chat.end(retellChatId);
            console.log('[Retell] Chat session ended successfully');
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

        // Hash the API key for secure storage
        const keyHash = createHash('sha256').update(apiKey).digest('hex');

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
          apiKey: `embellics_${apiKey}`, // Prefix for identification
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

  // Get analytics for specific tenant (Platform Admin only)
  app.get(
    '/api/platform/analytics/retell/:tenantId',
    requireAuth,
    requirePlatformAdmin,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { tenantId } = req.params;

        // Get tenant's widget config to find their Retell API key
        const widgetConfig = await storage.getWidgetConfig(tenantId);

        // If no widget config or no API key configured, return empty analytics
        if (!widgetConfig?.retellApiKey) {
          console.log(`[Platform Analytics] No Retell API key configured for tenant: ${tenantId}`);
          return res.json({
            totalCalls: 0,
            completedCalls: 0,
            averageDuration: 0,
            averageLatency: 0,
            successRate: 0,
            pickupRate: 0,
            transferRate: 0,
            voicemailRate: 0,
            sentimentBreakdown: {
              Positive: 0,
              Negative: 0,
              Neutral: 0,
              Unknown: 0,
            },
            disconnectionReasons: {},
            callStatusBreakdown: {},
            callsOverTime: [],
            dailyMetrics: [],
            callsByDateStacked: [],
            agentMetrics: [],
            directionBreakdown: { inbound: 0, outbound: 0 },
          });
        }

        // Create a Retell client using the tenant's own API key
        const tenantRetellClient = new Retell({
          apiKey: widgetConfig.retellApiKey,
        });

        // Get time range from query params (default to all time)
        const { start_date, end_date } = req.query;

        // Build filter for time range
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
        let agentNames: Record<string, string> = {};

        console.log(`[Platform Analytics] Fetching account-wide calls for tenant: ${tenantId}`);
        console.log(`[Platform Analytics] Filter criteria:`, JSON.stringify(filter, null, 2));

        try {
          // Fetch list of active agents and store their names
          let activeAgentIds: Set<string>;
          try {
            const activeAgents = await tenantRetellClient.agent.list();
            activeAgentIds = new Set(activeAgents.map((agent: any) => agent.agent_id));
            activeAgents.forEach((agent: any) => {
              if (agent.agent_id && agent.agent_name) {
                agentNames[agent.agent_id] = agent.agent_name;
              }
            });
            console.log(
              `[Platform Analytics] Found ${activeAgentIds.size} active agents in account`,
            );
          } catch (agentError) {
            console.warn(
              `[Platform Analytics] Could not fetch agent list, including all calls:`,
              agentError,
            );
            activeAgentIds = new Set();
          }

          // Fetch ALL calls from tenant's Retell account with pagination
          let paginationKey: string | undefined = undefined;
          let pageCount = 0;
          const maxLimit = 1000;

          do {
            pageCount++;
            const pageParams: any = {
              filter_criteria: Object.keys(filter).length > 0 ? filter : undefined,
              limit: maxLimit,
              sort_order: 'descending',
            };

            if (paginationKey) {
              pageParams.pagination_key = paginationKey;
            }

            const response: any = await tenantRetellClient.call.list(pageParams);

            if (Array.isArray(response) && response.length > 0) {
              calls.push(...response);

              if (response.length === maxLimit) {
                const lastCall = response[response.length - 1];
                paginationKey = lastCall.call_id;
              } else {
                paginationKey = undefined;
              }
            } else {
              paginationKey = undefined;
            }

            if (pageCount >= 100) {
              console.warn(`[Platform Analytics] Reached pagination safety limit`);
              break;
            }
          } while (paginationKey);

          console.log(
            `[Platform Analytics] ✓ Fetched ${calls.length} total calls across ${pageCount} pages`,
          );

          // Filter out calls from deleted agents
          if (activeAgentIds.size > 0) {
            calls = calls.filter((call: any) => activeAgentIds.has(call.agent_id));
          }

          // Filter by date range manually
          if (Object.keys(filter).length > 0 && filter.start_timestamp) {
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
          }
        } catch (retellError: any) {
          console.error('[Platform Analytics] Error fetching calls:', retellError);
          return res.json({
            totalCalls: 0,
            completedCalls: 0,
            averageDuration: 0,
            averageLatency: 0,
            successRate: 0,
            pickupRate: 0,
            transferRate: 0,
            voicemailRate: 0,
            sentimentBreakdown: {
              Positive: 0,
              Negative: 0,
              Neutral: 0,
              Unknown: 0,
            },
            disconnectionReasons: {},
            callStatusBreakdown: {},
            callsOverTime: [],
            dailyMetrics: [],
            callsByDateStacked: [],
            agentMetrics: [],
            directionBreakdown: { inbound: 0, outbound: 0 },
          });
        }

        // Aggregate analytics data (same logic as regular analytics endpoint)
        let totalDuration = 0;
        let totalLatency = 0;
        let callsWithLatency = 0;
        let completedCalls = 0;
        let successfulCalls = 0;
        let pickedUpCalls = 0;
        let transferredCalls = 0;
        let voicemailCalls = 0;

        const sentimentBreakdown: Record<string, number> = {
          Positive: 0,
          Negative: 0,
          Neutral: 0,
          Unknown: 0,
        };
        const disconnectionReasons: Record<string, number> = {};
        const callStatusBreakdown: Record<string, number> = {};
        const callsByDate: Record<string, number> = {};
        const callsByDateStacked: Record<string, any> = {};
        const agentMetrics: Record<string, any> = {};
        const directionBreakdown: Record<string, number> = {
          inbound: 0,
          outbound: 0,
        };

        for (const call of calls) {
          if (call.call_status === 'ended') {
            completedCalls++;

            if (call.duration_ms) {
              totalDuration += call.duration_ms;
            }

            if (call.latency?.e2e?.p50) {
              totalLatency += call.latency.e2e.p50;
              callsWithLatency++;
            }

            if (call.call_analysis?.call_successful) {
              successfulCalls++;
            }

            if (
              call.disconnection_reason !== 'voicemail' &&
              call.disconnection_reason !== 'no_answer'
            ) {
              pickedUpCalls++;
            }

            if (call.disconnection_reason === 'call_transfer') {
              transferredCalls++;
            }

            if (call.disconnection_reason === 'voicemail') {
              voicemailCalls++;
            }
          }

          const sentiment = call.call_analysis?.user_sentiment || 'Unknown';
          sentimentBreakdown[sentiment] = (sentimentBreakdown[sentiment] || 0) + 1;

          const reason = call.disconnection_reason || 'Unknown';
          disconnectionReasons[reason] = (disconnectionReasons[reason] || 0) + 1;

          const status = call.call_status || 'Unknown';
          callStatusBreakdown[status] = (callStatusBreakdown[status] || 0) + 1;

          const direction = call.direction || 'Unknown';
          directionBreakdown[direction] = (directionBreakdown[direction] || 0) + 1;

          const dateKey = call.start_timestamp
            ? new Date(call.start_timestamp).toISOString().split('T')[0]
            : 'unknown';
          callsByDate[dateKey] = (callsByDate[dateKey] || 0) + 1;

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

          if (call.call_status === 'ended') {
            if (call.call_analysis?.call_successful) {
              callsByDateStacked[dateKey].successful++;
            } else {
              callsByDateStacked[dateKey].unsuccessful++;
            }

            if (call.disconnection_reason === 'agent_hangup') {
              callsByDateStacked[dateKey].agentHangup++;
            } else if (call.disconnection_reason === 'call_transfer') {
              callsByDateStacked[dateKey].callTransfer++;
            } else if (call.disconnection_reason === 'user_hangup') {
              callsByDateStacked[dateKey].userHangup++;
            } else {
              callsByDateStacked[dateKey].otherDisconnection++;
            }

            const sentiment = call.call_analysis?.user_sentiment || 'Unknown';
            if (sentiment === 'Positive') {
              callsByDateStacked[dateKey].positive++;
            } else if (sentiment === 'Neutral') {
              callsByDateStacked[dateKey].neutral++;
            } else if (sentiment === 'Negative') {
              callsByDateStacked[dateKey].negative++;
            } else {
              callsByDateStacked[dateKey].otherSentiment++;
            }
          }

          const agentId = call.agent_id;
          if (!agentMetrics[agentId]) {
            agentMetrics[agentId] = {
              totalCalls: 0,
              successfulCalls: 0,
              pickedUpCalls: 0,
              transferredCalls: 0,
              voicemailCalls: 0,
            };
          }
          if (call.call_status === 'ended') {
            agentMetrics[agentId].totalCalls++;
            if (call.call_analysis?.call_successful) {
              agentMetrics[agentId].successfulCalls++;
            }
            if (
              call.disconnection_reason !== 'voicemail' &&
              call.disconnection_reason !== 'no_answer'
            ) {
              agentMetrics[agentId].pickedUpCalls++;
            }
            if (call.disconnection_reason === 'call_transfer') {
              agentMetrics[agentId].transferredCalls++;
            }
            if (call.disconnection_reason === 'voicemail') {
              agentMetrics[agentId].voicemailCalls++;
            }
          }
        }

        const averageDuration = completedCalls > 0 ? totalDuration / completedCalls : 0;
        const averageLatency = callsWithLatency > 0 ? totalLatency / callsWithLatency : 0;
        const successRate = completedCalls > 0 ? (successfulCalls / completedCalls) * 100 : 0;
        const pickupRate = completedCalls > 0 ? (pickedUpCalls / completedCalls) * 100 : 0;
        const transferRate = completedCalls > 0 ? (transferredCalls / completedCalls) * 100 : 0;
        const voicemailRate = completedCalls > 0 ? (voicemailCalls / completedCalls) * 100 : 0;

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
                : 0,
            avgLatency:
              metrics.callsWithLatency > 0
                ? Math.round(metrics.totalLatency / metrics.callsWithLatency)
                : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const callsOverTime = Object.entries(callsByDate)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const callsByDateStackedArray = Object.entries(callsByDateStacked)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const agentMetricsArray = Object.entries(agentMetrics).map(
          ([agentId, metrics]: [string, any]) => ({
            agentId,
            agentName: agentNames[agentId] || agentId,
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

        const endedCalls = calls.filter(
          (call: any) =>
            call.call_status === 'ended' &&
            call.call_type === 'phone_call' &&
            call.duration_ms &&
            call.duration_ms > 0,
        );

        res.json({
          totalCalls: endedCalls.length,
          completedCalls,
          averageDuration: Math.round(averageDuration / 1000),
          averageLatency: Math.round(averageLatency),
          successRate: Math.round(successRate),
          pickupRate: Math.round(pickupRate),
          transferRate: Math.round(transferRate),
          voicemailRate: Math.round(voicemailRate),
          sentimentBreakdown,
          disconnectionReasons,
          callStatusBreakdown,
          callsOverTime,
          dailyMetrics: dailyMetricsArray,
          callsByDateStacked: callsByDateStackedArray,
          agentMetrics: agentMetricsArray,
          directionBreakdown,
        });
      } catch (error) {
        console.error('Error fetching platform analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
      }
    },
  );

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

  // Assign human agent to conversation
  app.post('/api/handoff/assign', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const tenantId = assertTenant(req, res);
      if (!tenantId) return;
      const { conversationId, humanAgentId } = z
        .object({
          conversationId: z.string(),
          humanAgentId: z.string(),
        })
        .parse(req.body);

      // Update conversation
      await storage.updateConversation(
        conversationId,
        {
          handoffStatus: 'with_human',
          humanAgentId,
        },
        tenantId,
      );

      // Increment agent's active chats
      await storage.incrementActiveChats(humanAgentId, tenantId);

      // Broadcast assignment to chat widget
      broadcastToTenant(tenantId, 'handoff_assigned', {
        conversationId,
        humanAgentId,
      });

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
    if (!retellChatId) {
      console.log('[Retell] Creating new chat session for conversation:', conversationId);
      console.log('[Retell] Using agent ID:', agentId);

      const chatSession = await retellClient.chat.create({
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
    console.log('[Retell] Sending message to agent:', userMessage);
    const completion = await retellClient.chat.createChatCompletion({
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
