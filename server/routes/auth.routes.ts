/**
 * Authentication Routes
 * Handles user authentication, password management, and session control
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { storage } from '../storage';
import {
  type AuthenticatedRequest,
  requireAuth,
  assertTenant,
  generateToken,
  verifyPassword,
  hashPassword,
} from '../middleware/auth.middleware';

const router = Router();

// NOTE: This is an invitation-only platform
// No public registration allowed - users must be invited by platform admins

/**
 * POST /api/auth/login
 * User login endpoint
 * Supports both existing users and first-time invitation acceptance
 */
router.post('/login', async (req: Request, res: Response) => {
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
          isPlatformAdmin: pendingInvitation.role === 'owner' || pendingInvitation.role === 'admin',
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
            console.log(`[Login] Updated agent status to 'available' and last_seen: ${user.email}`);
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

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/heartbeat
 * Update agent last_seen timestamp and ensure status is 'available'
 */
router.post('/heartbeat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;

    if (user && user.tenantId && (user.role === 'support_staff' || user.role === 'client_admin')) {
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

/**
 * POST /api/auth/logout
 * Logout and update agent status to offline
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (user && user.tenantId && (user.role === 'support_staff' || user.role === 'client_admin')) {
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

/**
 * POST /api/auth/complete-onboarding
 * Mark user onboarding as complete
 */
router.post(
  '/complete-onboarding',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
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
  },
);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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

/**
 * POST /api/auth/forgot-password
 * Request password reset (Public - user enters email)
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
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
    const { sendForgotPasswordEmail } = await import('../email');

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

/**
 * POST /api/auth/reset-password
 * Reset password with token (Public)
 */
router.post('/reset-password', async (req: Request, res: Response) => {
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

/**
 * POST /api/auth/accept-invitation
 * Accept user invitation and create account
 */
router.post('/accept-invitation', async (req: Request, res: Response) => {
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

export default router;
