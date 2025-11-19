import { storage } from '../storage';
import { randomBytes } from 'crypto';
import { hashPassword } from '../auth';
import { sendInvitationEmail } from '../email';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

type Inviter = {
  userId?: string | null;
  role?: string | null;
  tenantId?: string | null;
  isPlatformAdmin?: boolean;
  email?: string | null;
};

type InvitePayload = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
};

export async function inviteUser(inviter: Inviter, payload: InvitePayload) {
  const inviterRole = inviter.role || (inviter.isPlatformAdmin ? 'admin' : null);
  const targetRole = payload.role;

  const isPlatformAdmin =
    !!inviter.isPlatformAdmin || inviterRole === 'admin' || inviterRole === 'owner';

  let tenantIdToAssign: string | null = null;

  if (isPlatformAdmin) {
    if (targetRole === 'client_admin') {
      if (payload.tenantId) {
        const existingTenant = await storage.getTenant(payload.tenantId);
        if (!existingTenant) throw new HttpError(400, 'Specified tenant does not exist');
        tenantIdToAssign = payload.tenantId;
      } else {
        if (!payload.companyName) {
          throw new HttpError(
            400,
            'tenantId or companyName is required when creating a client_admin',
          );
        }
        tenantIdToAssign = null;
      }
    } else if (targetRole === 'admin' || targetRole === 'owner') {
      tenantIdToAssign = null;
    } else {
      throw new HttpError(403, 'Platform admins cannot create the requested role');
    }
  } else if (inviterRole === 'client_admin') {
    if (payload.tenantId) throw new HttpError(403, 'Client admins are not allowed to set tenantId');
    if (!inviter.tenantId) throw new HttpError(500, 'Invoker tenant information missing');
    if (targetRole !== 'client_admin' && targetRole !== 'support_staff') {
      throw new HttpError(403, 'Client admins cannot create the requested role');
    }
    tenantIdToAssign = inviter.tenantId;
  } else {
    throw new HttpError(403, 'Insufficient privileges to invite users');
  }

  const existingUser = await storage.getClientUserByEmail(payload.email);
  if (existingUser) throw new HttpError(409, 'User with this email already exists');

  const existingInvitation = await storage.getPendingInvitationByEmail(payload.email);
  if (existingInvitation) await storage.deleteInvitation(existingInvitation.id);

  const tempPassword = randomBytes(8).toString('hex');
  const hashedPassword = await hashPassword(tempPassword);

  const invitation = await storage.createUserInvitation({
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    temporaryPassword: hashedPassword,
    plainTemporaryPassword: tempPassword,
    role: targetRole,
    tenantId: tenantIdToAssign ?? null,
    companyName: payload.companyName ?? null,
    companyPhone: payload.companyPhone ?? null,
    invitedBy: inviter.userId ?? null,
    status: 'pending',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  let emailSent = false;
  let emailError: any = null;
  try {
    await sendInvitationEmail(
      payload.email,
      payload.firstName,
      payload.lastName,
      tempPassword,
      targetRole,
    );
    await storage.updateInvitationStatus(invitation.id, 'sent', new Date());
    emailSent = true;
    // SECURITY: Clear any stored plaintext temporary password once the invitation
    // email has been sent successfully so it doesn't remain in persistent storage.
    try {
      if (typeof storage.clearInvitationPlainPassword === 'function') {
        await storage.clearInvitationPlainPassword(invitation.id);
      }
    } catch (clearErr) {
      // Non-fatal: log and continue. We don't want this to break invite creation.
      console.warn(
        '[InviteService] Failed to clear plaintext password for invitation:',
        invitation.id,
        clearErr instanceof Error ? clearErr.message : clearErr,
      );
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
  }

  return {
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
    emailSent,
    emailError,
    message: emailSent
      ? 'Invitation created and email sent successfully'
      : 'Invitation created but email failed to send. Share the temporary password manually.',
  };
}
