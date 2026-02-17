import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { apiCallWithErrorHandling } from '../utils/api.js';

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
  role: UserRole;
  rulerName: string | null;
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
        // response.user will be null if not authenticated, or user object if authenticated
        setUser(response.user || null);
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
    window.location.href = '/api/auth/google';
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
    return user?.role || null;
  };

  const isAllianceManager = (allianceId: number): boolean => {
    if (!user) return false;
    // Admins can manage all alliances
    if (user.role === UserRole.ADMIN) return true;
    // Check if user manages this specific alliance
    return user.managedAllianceIds.includes(allianceId);
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
    isAllianceManager,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

