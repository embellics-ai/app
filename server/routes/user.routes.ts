import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { randomBytes } from 'crypto';
import {
  requireAuth,
  requirePlatformAdmin,
  type AuthenticatedRequest,
  hashPassword,
  verifyPassword,
} from '../middleware/auth.middleware';
import { inviteUser } from '../services/inviteService';
import { sendPasswordResetEmail } from '../email';

const router = Router();

// ===== Platform Admin User Management Routes =====

/**
 * Invite a new user (Platform Admin only)
 * NEW INVITATION FLOW: Creates pending invitation, sends email, user account created on first login
 *
 * Security: Platform admins can only create 'admin' and 'client_admin' roles
 * Support staff cannot be created by platform admins
 *
 * POST /api/platform/invite-user
 */
router.post(
  '/invite-user',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
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

/**
 * Get all pending invitations (Platform Admin only)
 *
 * Returns invitation list without plaintext passwords (security improvement)
 * Note: plainTemporaryPassword was only returned for platform owner (admin@embellics.com)
 *
 * GET /api/platform/invitations/pending
 */
router.get(
  '/invitations/pending',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const invitations = await storage.getPendingInvitations();

      // Return invitation list
      // Note: plainTemporaryPassword is only returned for platform owner (admin@embellics.com)
      const isOwner = req.user!.email === 'admin@embellics.com';

      const sanitizedInvitations = invitations.map((inv: any) => ({
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

/**
 * Delete a pending invitation (Platform Admin only)
 *
 * DELETE /api/platform/invitations/:invitationId
 */
router.delete(
  '/invitations/:invitationId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
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

/**
 * Get all users (Platform Admin only)
 *
 * Platform admins only see client_admin users, not support_staff
 *
 * GET /api/platform/users
 */
router.get(
  '/users',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();

      // Platform admins should only see client_admin users, not support_staff
      const filteredUsers = users.filter(
        (user: any) =>
          user.role === 'client_admin' || user.role === 'owner' || user.isPlatformAdmin,
      );

      // Don't send password hashes
      const sanitizedUsers = filteredUsers.map((user: any) => ({
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

/**
 * Delete client user (Platform Admin only - can only delete client_admin users)
 *
 * CRITICAL PROTECTION: Platform owner (admin@embellics.com) requires security answer
 * Security Question: "What is the platform owner's secret code?"
 *
 * DELETE /api/platform/users/:userId
 */
router.delete(
  '/users/:userId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
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

/**
 * Reset user password (Platform Owner only - admin@embellics.com)
 *
 * Generates new temporary password, forces password change on next login
 *
 * POST /api/platform/users/:userId/reset-password
 */
router.post(
  '/users/:userId/reset-password',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
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

/**
 * Get active invitations (Platform Admin only)
 *
 * Returns all invitations including pending and used
 *
 * GET /api/platform/invitations
 */
router.get(
  '/invitations',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Get all invitations (including used ones)
      const allInvitations = await storage.getActiveInvitations();

      // Sanitize response (don't send plaintext passwords)
      const sanitizedInvitations = allInvitations.map((inv: any) => ({
        id: inv.id,
        email: inv.email,
        firstName: inv.firstName,
        lastName: inv.lastName,
        role: inv.role,
        status: inv.status,
        companyName: inv.companyName || null,
        tenantId: inv.tenantId || null,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt || null,
        lastSentAt: inv.lastSentAt || null,
      }));

      res.json(sanitizedInvitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      res.status(500).json({ error: 'Failed to fetch invitations' });
    }
  },
);

export default router;
