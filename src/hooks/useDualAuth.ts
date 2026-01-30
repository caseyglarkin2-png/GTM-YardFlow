/**
 * T97.0: Dual Auth Hook
 * 
 * Uses AuthBridge to provide seamless authentication during Firebase→Railway migration.
 * Automatically handles fallback and user migration.
 */

import { useState, useEffect, useCallback } from 'react';
import { authBridge } from '../services/AuthBridge';
import { featureFlags } from '../config/featureFlags';
import type { RailwayUser } from '../types/railway';
import type { User as FirebaseUser } from 'firebase/auth';

// =============================================================================
// Types
// =============================================================================

interface DualAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: RailwayUser | FirebaseUser | null;
  authSource: 'railway' | 'firebase' | null;
  error: string | null;
}

interface DualAuthActions {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export type UseDualAuthReturn = DualAuthState & DualAuthActions;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useDualAuth(): UseDualAuthReturn {
  const [state, setState] = useState<DualAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    authSource: null,
    error: null,
  });

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    
    // Subscribe to auth state changes
    const unsubscribe = authBridge.onAuthStateChange((result) => {
      if (result) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: result.user ?? null,
          authSource: result.source,
          error: null,
        });
      } else {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          authSource: null,
          error: null,
        });
      }
    });

    return unsubscribe;
  }, []);

  const checkAuth = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await authBridge.checkAuth();
      
      if (result) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: result.user ?? null,
          authSource: result.source,
          error: null,
        });
      } else {
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          authSource: null,
          error: null,
        });
      }
    } catch (error) {
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        authSource: null,
        error: error instanceof Error ? error.message : 'Auth check failed',
      });
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await authBridge.authenticate(email, password);

      if (result.success) {
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: result.user ?? null,
          authSource: result.source,
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
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await authBridge.logout();
      
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        authSource: null,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        authSource: null,
        error: null,
      });
    }
  }, []);

  return {
    ...state,
    login,
    logout,
    checkAuth,
  };
}

/**
 * Get display info about current auth source
 */
export function useAuthSourceInfo() {
  const { authSource } = useDualAuth();

  return {
    isRailway: authSource === 'railway',
    isFirebase: authSource === 'firebase',
    isMigrated: authSource === 'railway',
    displayName: authSource === 'railway' ? 'Railway' : 'Firebase',
    migrationEnabled: featureFlags.FIREBASE_AUTH_FALLBACK,
  };
}

export default useDualAuth;
