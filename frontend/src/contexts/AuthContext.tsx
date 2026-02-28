import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { apiCallWithErrorHandling, getApiBaseUrl } from '../utils/api.js';

export const UserRole = {
  ADMIN: 'ADMIN',
  ALLIANCE_MANAGER: 'ALLIANCE_MANAGER',
  WAR_MANAGER: 'WAR_MANAGER',
  USER: 'USER',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface User {
  id: number;
  email: string;
  roles: UserRole[];
  rulerName: string | null;
  capabilities: string[];
  managedAllianceIds: number[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  fetchAuthState: () => Promise<void>;
  getUserRole: () => UserRole | null;
  getUserRoles: () => UserRole[];
  hasCapability: (capability: string, allianceId?: number) => boolean;
  isAllianceManager: (allianceId: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  const fetchAuthState = async () => {
    try {
      setIsLoading(true);
      const response = await apiCallWithErrorHandling('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.success) {
        const u = response.user;
        if (u) {
          setUser({
            ...u,
            roles: Array.isArray(u.roles) ? u.roles : [],
            capabilities: Array.isArray(u.capabilities) ? u.capabilities : [],
          });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      // If the request fails (network error, etc.), assume not authenticated
      console.error('Error checking auth state:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = () => {
    // Redirect to backend OAuth endpoint
    const backendUrl = getApiBaseUrl();
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const logout = async () => {
    try {
      await apiCallWithErrorHandling('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setUser(null);
    }
  };

  const getUserRole = (): UserRole | null => {
    if (!user?.roles?.length) return null;
    // Primary = highest role (ADMIN > ALLIANCE_MANAGER > WAR_MANAGER > USER)
    const order: UserRole[] = [UserRole.ADMIN, UserRole.ALLIANCE_MANAGER, UserRole.WAR_MANAGER, UserRole.USER];
    for (const r of order) {
      if (user.roles.includes(r)) return r;
    }
    return user.roles[0] ?? null;
  };

  const getUserRoles = (): UserRole[] => {
    return user?.roles ?? [];
  };

  const hasCapability = (capability: string, allianceId?: number): boolean => {
    if (!user) return false;
    const caps = user.capabilities ?? [];
    if (capability === 'manage_alliance' && allianceId != null) {
      return caps.includes('manage_all_alliance') || (caps.includes('manage_alliance') && (user.managedAllianceIds ?? []).includes(allianceId));
    }
    return caps.includes(capability);
  };

  const isAllianceManager = (allianceId: number): boolean => {
    return hasCapability('manage_alliance', allianceId);
  };

  // Check auth state on mount
  useEffect(() => {
    fetchAuthState();
  }, []);

  // Check for auth success/error in URL params when location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      // Remove auth param from URL
      window.history.replaceState({}, '', location.pathname);
      
      // Fetch user state after successful login
      // Add a small delay to ensure session cookie is set
      setTimeout(() => {
        fetchAuthState();
      }, 200);
    } else if (authStatus === 'error') {
      // Remove auth param from URL
      window.history.replaceState({}, '', location.pathname);
      // Still check auth state in case user is already logged in
      fetchAuthState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    fetchAuthState,
    getUserRole,
    getUserRoles,
    hasCapability,
    isAllianceManager,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

