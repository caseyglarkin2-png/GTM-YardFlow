/**
 * T91.3: Railway Auth Hook
 * 
 * Manages Railway NextAuth authentication state.
 * Handles login, logout, session persistence, and token management.
 * 
 * Features:
 * - Session check on mount
 * - Token storage and forwarding
 * - Auto-logout on 401
 * - Session refresh before expiry
 * 
 * Usage:
 *   const { isAuthenticated, user, login, logout } = useRailwayAuth();
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { railwayClient } from '@/services/RailwayApiClient';
import type { RailwayUser, RailwaySession } from '@/types/railway';
import { featureFlags } from '@/config/featureFlags';

// =============================================================================
// Types
// =============================================================================

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: RailwayUser | null;
  session: RailwaySession | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  checkSession: () => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Hook Implementation
// =============================================================================

export function useRailwayAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  
  // If not in provider, create standalone instance
  if (!context) {
    return useRailwayAuthStandalone();
  }
  
  return context;
}

function useRailwayAuthStandalone(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    session: null,
    error: null,
  });

  // Check session on mount
  useEffect(() => {
    if (featureFlags.RAILWAY_AUTH_ENABLED) {
      checkSession();
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Set up session refresh interval
  useEffect(() => {
    if (!state.session?.expiresAt) return;

    const expiresAt = new Date(state.session.expiresAt).getTime();
    const now = Date.now();
    const timeUntilRefresh = expiresAt - now - 5 * 60 * 1000; // Refresh 5 min before expiry

    if (timeUntilRefresh <= 0) {
      refreshSession();
      return;
    }

    const timeout = setTimeout(refreshSession, timeUntilRefresh);
    return () => clearTimeout(timeout);
  }, [state.session?.expiresAt]);

  const checkSession = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await railwayClient.auth.getSession();
      
      if (result.ok && result.data) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: result.data.user,
          session: result.data,
          error: null,
        });
      } else {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          session: null,
          error: null,
        });
      }
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        session: null,
        error: error instanceof Error ? error.message : 'Session check failed',
      });
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const result = await railwayClient.auth.login({ email, password });
      
      if (result.ok && result.data) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: result.data.user,
          session: result.data,
          error: null,
        });
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Login failed',
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await railwayClient.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        session: null,
        error: null,
      });
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const result = await railwayClient.auth.refresh();
      
      if (result.ok && result.data) {
        setState(prev => ({
          ...prev,
          session: result.data ?? null,
          user: result.data?.user ?? prev.user,
        }));
      } else {
        // Refresh failed, logout
        await logout();
      }
    } catch (error) {
      console.error('Session refresh error:', error);
      await logout();
    }
  }, [logout]);

  return {
    ...state,
    login,
    logout,
    refreshSession,
    checkSession,
  };
}

// =============================================================================
// Provider Component
// =============================================================================

interface RailwayAuthProviderProps {
  children: ReactNode;
}

export function RailwayAuthProvider({ children }: RailwayAuthProviderProps) {
  const auth = useRailwayAuthStandalone();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Auth Guard Component
// =============================================================================

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function AuthGuard({ children, fallback, redirectTo = '/login' }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useRailwayAuth();

  if (isLoading) {
    return fallback ? <>{fallback}</> : (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return null;
  }

  return <>{children}</>;
}

export default useRailwayAuth;
