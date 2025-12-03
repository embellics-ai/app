/**
 * Authentication Middleware
 * Re-exports authentication and authorization middleware from auth.ts
 */

export {
  type AuthenticatedRequest,
  type JWTPayload,
  requireAuth,
  requirePlatformAdmin,
  requireClientAdmin,
  requireSupportStaff,
  requireClientOrSupport,
  assertTenant,
  generateToken,
  verifyToken,
  hashPassword,
  verifyPassword,
} from '../auth';
