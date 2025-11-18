import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'client_admin' | 'support_staff' | 'owner';

interface RouteAccess {
  path: string;
  allowedRoles: UserRole[];
  requirePlatformAdmin?: boolean;
  requireOnboarding?: boolean;
}

// Route access control matrix
const ROUTE_ACCESS: RouteAccess[] = [
  // Platform Admin routes
  { path: '/platform-admin', requirePlatformAdmin: true, allowedRoles: ['admin', 'owner'] },
  { path: '/platform-analytics', requirePlatformAdmin: true, allowedRoles: ['admin', 'owner'] },

  // Client Admin routes
  { path: '/analytics', requirePlatformAdmin: false, allowedRoles: ['client_admin'] },
  { path: '/widget-config', requirePlatformAdmin: false, allowedRoles: ['client_admin'] },
  { path: '/api-keys', requirePlatformAdmin: false, allowedRoles: ['client_admin'] },
  { path: '/team-management', requirePlatformAdmin: false, allowedRoles: ['client_admin'] },
  {
    path: '/test-chat',
    requirePlatformAdmin: false,
    allowedRoles: ['client_admin', 'support_staff'],
  },

  // Support Staff / Agent routes
  {
    path: '/agent-dashboard',
    requirePlatformAdmin: false,
    allowedRoles: ['client_admin', 'support_staff'],
  },

  // Shared routes (all authenticated users)
  {
    path: '/change-password',
    requirePlatformAdmin: undefined,
    allowedRoles: ['admin', 'client_admin', 'support_staff', 'owner'],
  },

  // Public routes (handled separately)
  { path: '/login', requirePlatformAdmin: undefined, allowedRoles: [] },

  // Optional onboarding route (accessible to authenticated client_admin users)
  { path: '/onboarding', requirePlatformAdmin: false, allowedRoles: ['client_admin'] },
];

function getDefaultRouteForUser(user: any): string {
  if (!user) return '/login';

  // Removed forced onboarding redirect - users can access onboarding optionally via sidebar

  if (user.isPlatformAdmin) return '/platform-admin';

  if (user.role === 'client_admin') return '/analytics';

  if (user.role === 'support_staff') return '/agent-dashboard';

  return '/analytics';
}

function canAccessRoute(path: string, user: any): boolean {
  if (!user) return false;

  const routeConfig = ROUTE_ACCESS.find((r) => r.path === path);

  // If route not in config, assume it's accessible (for not-found page)
  if (!routeConfig) return true;

  // Check platform admin requirement
  if (routeConfig.requirePlatformAdmin !== undefined) {
    if (routeConfig.requirePlatformAdmin && !user.isPlatformAdmin) {
      return false;
    }
    if (!routeConfig.requirePlatformAdmin && user.isPlatformAdmin) {
      return false;
    }
  }

  // Check role requirement
  if (routeConfig.allowedRoles.length > 0 && !routeConfig.allowedRoles.includes(user.role)) {
    return false;
  }

  return true;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  path: string;
}

export function ProtectedRoute({ children, path }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Redirect to login if not authenticated (except for public routes)
    if (!user && path !== '/login') {
      setLocation('/login');
      return;
    }

    // Handle home route - redirect to appropriate dashboard
    if (user && path === '/') {
      const defaultRoute = getDefaultRouteForUser(user);
      setLocation(defaultRoute);
      return;
    }

    // If authenticated, check access
    if (user && !canAccessRoute(path, user)) {
      const defaultRoute = getDefaultRouteForUser(user);

      toast({
        title: 'Access Denied',
        description: "You don't have permission to access this page.",
        variant: 'destructive',
      });

      setLocation(defaultRoute);
    }
  }, [user, isLoading, path, setLocation, toast, location]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show content if authorized
  if (user && canAccessRoute(path, user)) {
    return <>{children}</>;
  }

  // Show loading for redirect
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  );
}
