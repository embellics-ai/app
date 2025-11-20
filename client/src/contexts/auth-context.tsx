import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, type QueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { queryClient } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  isPlatformAdmin: boolean;
  onboardingCompleted: boolean;
  mustChangePassword: boolean; // True when logging in with temporary password
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });
  const [, setLocation] = useLocation();

  // Fetch current user if token exists
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: false,
    meta: {
      skipDefaultFetch: true,
    },
    queryFn: async () => {
      console.log('[Auth Context] useQuery fetching user data with token');
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Token is invalid, clear it
        console.log('[Auth Context] Token invalid, clearing');
        localStorage.removeItem('auth_token');
        setToken(null);
        throw new Error('Not authenticated');
      }

      const data = await response.json();
      console.log('[Auth Context] useQuery user data:', {
        id: data.id,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId,
      });
      return data;
    },
  });

  const login = async (newToken: string) => {
    console.log('[Auth Context] Login called with new token');

    // Clear any existing cached data to prevent stale data issues
    queryClient.removeQueries({ queryKey: ['/api/auth/me'] });

    localStorage.setItem('auth_token', newToken);
    setToken(newToken);

    // Explicitly fetch user data to ensure hydration before navigation (prevents UI flash)
    const userData = await queryClient.fetchQuery({
      queryKey: ['/api/auth/me'],
      queryFn: async () => {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          localStorage.removeItem('auth_token');
          setToken(null);
          throw new Error('Not authenticated');
        }

        const data = await response.json();
        console.log('[Auth Context] User data fetched after login:', {
          id: data.id,
          email: data.email,
          role: data.role,
          tenantId: data.tenantId,
        });
        return data;
      },
    });
  };

  const logout = () => {
    console.log('[Auth Context] Logging out - clearing all localStorage and cache');

    // Save theme preference before clearing
    const savedTheme = localStorage.getItem('theme');

    // Clear ALL localStorage to prevent any cached data from persisting
    localStorage.clear();

    // Restore theme preference
    if (savedTheme) {
      localStorage.setItem('theme', savedTheme);
    }

    setToken(null);
    queryClient.clear();
    setLocation('/login');
  };

  const value: AuthContextType = {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
