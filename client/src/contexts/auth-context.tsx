import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, type QueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

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
    return localStorage.getItem("auth_token");
  });
  const [, setLocation] = useLocation();

  // Fetch current user if token exists
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    enabled: !!token,
    retry: false,
    meta: {
      skipDefaultFetch: true,
    },
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Token is invalid, clear it
        localStorage.removeItem("auth_token");
        setToken(null);
        throw new Error("Not authenticated");
      }

      return response.json();
    },
  });

  const login = async (newToken: string) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
    // Explicitly fetch user data to ensure hydration before navigation (prevents UI flash)
    await queryClient.fetchQuery({
      queryKey: ["/api/auth/me"],
      queryFn: async () => {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
          credentials: "include",
        });
        
        if (!response.ok) {
          localStorage.removeItem("auth_token");
          setToken(null);
          throw new Error("Not authenticated");
        }
        
        return response.json();
      },
    });
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    queryClient.clear();
    setLocation("/login");
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
