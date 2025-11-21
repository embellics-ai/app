import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RoleProtectedRoute } from '@/components/role-protected-route';
import { useAuth } from '@/contexts/auth-context';
import { useLocation } from 'wouter';

// Mock dependencies
vi.mock('@/contexts/auth-context');
vi.mock('wouter');

describe('RoleProtectedRoute Component', () => {
  const mockSetLocation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useLocation as any).mockReturnValue(['/', mockSetLocation]);
  });

  it('should show loading state', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isLoading: true,
    });

    render(
      <RoleProtectedRoute allowedRoles={['client_admin']}>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render children for user with allowed role', () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'client_admin' },
      isLoading: false,
    });

    render(
      <RoleProtectedRoute allowedRoles={['client_admin']}>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect user without allowed role', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff' },
      isLoading: false,
    });

    render(
      <RoleProtectedRoute allowedRoles={['client_admin']}>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith('/agent-queue');
    });
  });

  it('should use custom fallback path', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff' },
      isLoading: false,
    });

    render(
      <RoleProtectedRoute allowedRoles={['client_admin']} fallbackPath="/custom-redirect">
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    await waitFor(() => {
      expect(mockSetLocation).toHaveBeenCalledWith('/custom-redirect');
    });
  });

  it('should render null when user not logged in', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      isLoading: false,
    });

    const { container } = render(
      <RoleProtectedRoute allowedRoles={['client_admin']}>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(container.textContent).toBe('');
  });

  it('should allow multiple roles', () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff' },
      isLoading: false,
    });

    render(
      <RoleProtectedRoute allowedRoles={['client_admin', 'support_staff']}>
        <div>Protected Content</div>
      </RoleProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
