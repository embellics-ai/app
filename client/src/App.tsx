import { Switch, Route, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useWebSocket } from '@/hooks/use-websocket';
import { useHeartbeat } from '@/hooks/use-heartbeat';
import { ProtectedRoute } from '@/components/protected-route';
import { RoleProtectedRoute } from '@/components/role-protected-route';
import { ChangePasswordRequired } from '@/components/change-password-required';
import Chat from '@/pages/chat';
import Analytics from '@/pages/analytics';
import UnifiedAnalytics from '@/pages/unified-analytics';
import PlatformAnalytics from '@/pages/platform-analytics';
import WidgetConfigPage from '@/pages/widget-config';
import ApiKeysPage from '@/pages/api-keys';
import AgentDashboard from '@/pages/agent-dashboard';
import AgentQueue from '@/pages/agent-queue';
import AgentChat from '@/pages/agent-chat';
import PlatformAdminPage from '@/pages/platform-admin';
import TeamManagementPage from '@/pages/team-management';
import ChangePasswordPage from '@/pages/change-password';
import OnboardingPage from '@/pages/onboarding';
import Login from '@/pages/login';
import ForgotPassword from '@/pages/forgot-password';
import ResetPassword from '@/pages/reset-password';
import NotFound from '@/pages/not-found';
import { useEffect } from 'react';

function Router() {
  return (
    <Switch>
      {/* Public routes - no ProtectedRoute wrapper */}
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Protected routes - wrapped with ProtectedRoute */}
      <Route path="/">
        <ProtectedRoute path="/">
          <Chat />
        </ProtectedRoute>
      </Route>
      <Route path="/test-chat">
        <ProtectedRoute path="/test-chat">
          <Chat />
        </ProtectedRoute>
      </Route>
      <Route path="/analytics">
        <ProtectedRoute path="/analytics">
          <UnifiedAnalytics />
        </ProtectedRoute>
      </Route>
      <Route path="/platform-analytics">
        <ProtectedRoute path="/platform-analytics">
          <PlatformAnalytics />
        </ProtectedRoute>
      </Route>
      <Route path="/widget-config">
        <ProtectedRoute path="/widget-config">
          <WidgetConfigPage />
        </ProtectedRoute>
      </Route>
      <Route path="/api-keys">
        <ProtectedRoute path="/api-keys">
          <RoleProtectedRoute allowedRoles={['client_admin', 'owner']} fallbackPath="/agent-queue">
            <ApiKeysPage />
          </RoleProtectedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/agent-dashboard">
        <ProtectedRoute path="/agent-dashboard">
          <RoleProtectedRoute allowedRoles={['client_admin', 'owner']} fallbackPath="/agent-queue">
            <AgentDashboard />
          </RoleProtectedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/agent-queue">
        <ProtectedRoute path="/agent-queue">
          <AgentQueue />
        </ProtectedRoute>
      </Route>
      <Route path="/agent-chat/:id">
        <ProtectedRoute path="/agent-chat/:id">
          <AgentChat />
        </ProtectedRoute>
      </Route>
      <Route path="/platform-admin">
        <ProtectedRoute path="/platform-admin">
          <PlatformAdminPage />
        </ProtectedRoute>
      </Route>
      <Route path="/team-management">
        <ProtectedRoute path="/team-management">
          <RoleProtectedRoute allowedRoles={['client_admin', 'owner']} fallbackPath="/agent-queue">
            <TeamManagementPage />
          </RoleProtectedRoute>
        </ProtectedRoute>
      </Route>
      <Route path="/change-password">
        <ProtectedRoute path="/change-password">
          <ChangePasswordPage />
        </ProtectedRoute>
      </Route>
      <Route path="/onboarding">
        <ProtectedRoute path="/onboarding">
          <OnboardingPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp({ user, style }: { user: any; style: any }) {
  // WebSocket is now conditionally enabled only on pages that need it
  // (Agent Dashboard, Agent Queue, etc.)
  // No global connection - saves resources when not chatting

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <SidebarTrigger data-testid="button-sidebar-toggle" />
      <div className="flex items-center gap-3">
        <ThemeToggle />
      </div>
    </header>
  );
}

function ProtectedAppContent() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // Initialize heartbeat for agents (support_staff and client_admin)
  useHeartbeat();

  const style = {
    '--sidebar-width': '16rem',
    '--sidebar-width-icon': '3rem',
  };

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/reset-password'];
  const isPublicRoute = (path: string) => {
    // Check exact matches
    if (publicRoutes.includes(path)) return true;
    // Check if path starts with a public route (for query params like /reset-password?token=...)
    return publicRoutes.some((route) => path.startsWith(route));
  };

  // Redirect to login if not authenticated (except for public routes)
  useEffect(() => {
    if (!isLoading && !user && !isPublicRoute(location)) {
      setLocation('/login');
    }
  }, [user, isLoading, location, setLocation]);

  // Remove forced onboarding redirect - users can access onboarding page optionally

  // Redirect users from home page to their appropriate dashboard
  useEffect(() => {
    if (!isLoading && user && location === '/') {
      if (user.isPlatformAdmin) {
        setLocation('/platform-admin');
      } else if (user.role === 'support_staff') {
        setLocation('/agent-queue'); // Support staff goes to their queue, NOT dashboard
      } else if (user.role === 'client_admin') {
        setLocation('/analytics');
      } else {
        // Fallback for any other role
        setLocation('/analytics');
      }
    }
  }, [user, isLoading, location, setLocation]);

  // Show public pages without sidebar
  if (isPublicRoute(location)) {
    return (
      <main className="h-screen">
        <Router />
      </main>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show dashboard with sidebar for authenticated users
  if (user) {
    return (
      <>
        <AuthenticatedApp user={user} style={style} />
        {/* Force password change modal - blocks everything until password is changed */}
        {user.mustChangePassword && <ChangePasswordRequired />}
      </>
    );
  }

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <ProtectedAppContent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
