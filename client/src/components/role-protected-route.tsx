import { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
  fallbackPath?: string;
}

/**
 * Role-based route protection component.
 * Redirects users who don't have the required role to a fallback path.
 */
export function RoleProtectedRoute({
  children,
  allowedRoles,
  fallbackPath = '/agent-queue',
}: RoleProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      console.log(
        `[RoleProtectedRoute] User role "${user.role}" not in allowed roles [${allowedRoles.join(', ')}]. Redirecting to ${fallbackPath}`,
      );
      setLocation(fallbackPath);
    }
  }, [user, isLoading, allowedRoles, fallbackPath, setLocation]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // User not logged in - let ProtectedRoute handle this
  if (!user) {
    return null;
  }

  // User doesn't have required role - don't render
  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  // User has required role - render children
  return <>{children}</>;
}
