import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';

// Mock dependencies
vi.mock('@/contexts/auth-context');
vi.mock('wouter');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('ProtectedRoute Component', () => {
  const mockSetLocation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useLocation as any).mockReturnValue(['/', mockSetLocation]);
  });

  it('should show loading state when loading', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });

    render(
      <ProtectedRoute path="/analytics">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', async () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    render(
      <ProtectedRoute path="/analytics">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith('/login');
    });
  });

  it('should render children for authenticated user with correct role', () => {
    (useAuth as any).mockReturnValue({
      user: {
        role: 'client_admin',
        isPlatformAdmin: false,
        onboardingCompleted: true,
        mustChangePassword: false,
      },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute path="/analytics">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect platform admin away from tenant-only routes', async () => {
    (useAuth as any).mockReturnValue({
      user: {
        role: 'admin',
        isPlatformAdmin: true,
        onboardingCompleted: true,
        mustChangePassword: false,
      },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute path="/widget-config">
        <div>Protected Content</div>
      </ProtectedRoute>,
    );

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalled();
    });
  });

  it('should allow platform admin to access platform routes', () => {
    (useAuth as any).mockReturnValue({
      user: {
        role: 'admin',
        isPlatformAdmin: true,
        onboardingCompleted: true,
        mustChangePassword: false,
      },
      isLoading: false,
      isAuthenticated: true,
    });

    render(
      <ProtectedRoute path="/platform-admin">
        <div>Platform Admin Content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText('Platform Admin Content')).toBeInTheDocument();
  });
});
