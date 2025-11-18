import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// Validate SESSION_SECRET is set
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set!');
  console.error('JWT tokens cannot be securely generated without a secret.');
  throw new Error('SESSION_SECRET is required for authentication');
}

const JWT_SECRET = process.env.SESSION_SECRET;
const SALT_ROUNDS = 10;

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT token generation and verification
export interface JWTPayload {
  userId: string;
  tenantId: string | null; // Null for platform admins who aren't tied to a single tenant
  email: string;
  role: string; // owner, admin, client_admin, support_staff
  isPlatformAdmin: boolean;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Extended Request type with user info
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Authentication middleware
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user info to request
  req.user = payload;
  next();
}

// Optional authentication middleware (doesn't fail if no token)
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload) {
      req.user = payload;
    }
  }

  next();
}

// Helper to assert tenant ID exists in authenticated request
// Use this at the start of every protected route to prevent crafted tokens from bypassing tenant isolation
export function assertTenant(req: AuthenticatedRequest, res?: Response): string | null {
  if (!req.user?.tenantId || req.user.tenantId.trim() === '') {
    if (res) {
      res.status(401).json({ error: 'Invalid token: missing tenant ID' });
    }
    return null;
  }
  return req.user.tenantId;
}

// Role-based authentication middleware
export function requirePlatformAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Assumes requireAuth has already validated and populated req.user
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Check if user is platform admin (owner or admin role)
  if (!req.user.isPlatformAdmin || (req.user.role !== 'owner' && req.user.role !== 'admin')) {
    res.status(403).json({ error: 'Forbidden: Platform admin access required' });
    return;
  }

  next();
}

export function requireClientAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Assumes requireAuth has already validated and populated req.user
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Check if user is client admin
  if (req.user.role !== 'client_admin') {
    res.status(403).json({ error: 'Forbidden: Client admin access required' });
    return;
  }

  // Client admins must have a tenant ID
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'Forbidden: client admin must belong to a tenant' });
    return;
  }

  next();
}

export function requireSupportStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Assumes requireAuth has already validated and populated req.user
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Check if user is support staff
  if (req.user.role !== 'support_staff') {
    res.status(403).json({ error: 'Forbidden: Support staff access required' });
    return;
  }

  // Support staff must have a tenant ID
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'Forbidden: support staff must belong to a tenant' });
    return;
  }

  next();
}

// Helper middleware: Allow both client admins and support staff (for Agent Dashboard)
export function requireClientOrSupport(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Assumes requireAuth has already validated and populated req.user
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Allow client_admin or support_staff
  if (req.user.role !== 'client_admin' && req.user.role !== 'support_staff') {
    res.status(403).json({ error: 'Forbidden: Client admin or support staff access required' });
    return;
  }

  // Must have a tenant ID
  if (!req.user.tenantId) {
    res.status(403).json({ error: 'Forbidden: must belong to a tenant' });
    return;
  }

  next();
}
