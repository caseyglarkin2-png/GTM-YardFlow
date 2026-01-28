/**
 * Tenant Context - YardFlow Hub
 * 
 * React context for multi-tenant functionality:
 * - Current tenant state
 * - Current user state
 * - Permission checking hooks
 * - Tenant switching (for multi-org users)
 */

import React, { createContext, useContext, useCallback, useMemo, useReducer } from 'react';
import type { Tenant, User, ResourceType, Action, Team } from '../types/tenant';
import { hasPermission, getAllowedActions, hasFeature, canManageUsers, canAddResource } from './TenantService';

// ============================================
// Context Types
// ============================================

interface TenantState {
  tenant: Tenant | null;
  user: User | null;
  teams: Team[];
  isLoading: boolean;
  error: string | null;
}

type TenantAction =
  | { type: 'SET_TENANT'; payload: Tenant }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_TEAMS'; payload: Team[] }
  | { type: 'UPDATE_TENANT'; payload: Partial<Tenant> }
  | { type: 'UPDATE_USER'; payload: Partial<User> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_SESSION' };

interface TenantContextValue extends TenantState {
  // Actions
  setTenant: (tenant: Tenant) => void;
  setUser: (user: User) => void;
  setTeams: (teams: Team[]) => void;
  updateTenant: (updates: Partial<Tenant>) => void;
  updateUser: (updates: Partial<User>) => void;
  clearSession: () => void;
  
  // Permission helpers
  can: (resource: ResourceType, action: Action) => boolean;
  canAccess: (resource: ResourceType) => boolean;
  getActionsFor: (resource: ResourceType) => Action[];
  
  // Feature helpers
  hasFeatureEnabled: (feature: keyof Tenant['settings']['features']) => boolean;
  
  // Usage helpers
  checkResourceLimit: (resourceType: 'users' | 'prospects' | 'sequences' | 'emails' | 'aiCredits', count?: number) => {
    allowed: boolean;
    remaining: number;
    limit: number;
  };
  
  // Role helpers
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageTeam: boolean;
}

// ============================================
// Initial State & Reducer
// ============================================

const initialState: TenantState = {
  tenant: null,
  user: null,
  teams: [],
  isLoading: false,
  error: null,
};

function tenantReducer(state: TenantState, action: TenantAction): TenantState {
  switch (action.type) {
    case 'SET_TENANT':
      return { ...state, tenant: action.payload, error: null };
    
    case 'SET_USER':
      return { ...state, user: action.payload, error: null };
    
    case 'SET_TEAMS':
      return { ...state, teams: action.payload };
    
    case 'UPDATE_TENANT':
      if (!state.tenant) return state;
      return {
        ...state,
        tenant: { ...state.tenant, ...action.payload },
      };
    
    case 'UPDATE_USER':
      if (!state.user) return state;
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'CLEAR_SESSION':
      return initialState;
    
    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

const TenantContext = createContext<TenantContextValue | null>(null);

// ============================================
// Provider Component
// ============================================

interface TenantProviderProps {
  children: React.ReactNode;
  initialTenant?: Tenant;
  initialUser?: User;
}

export function TenantProvider({ 
  children, 
  initialTenant, 
  initialUser 
}: TenantProviderProps) {
  const [state, dispatch] = useReducer(tenantReducer, {
    ...initialState,
    tenant: initialTenant ?? null,
    user: initialUser ?? null,
  });
  
  // Actions
  const setTenant = useCallback((tenant: Tenant) => {
    dispatch({ type: 'SET_TENANT', payload: tenant });
  }, []);
  
  const setUser = useCallback((user: User) => {
    dispatch({ type: 'SET_USER', payload: user });
  }, []);
  
  const setTeams = useCallback((teams: Team[]) => {
    dispatch({ type: 'SET_TEAMS', payload: teams });
  }, []);
  
  const updateTenant = useCallback((updates: Partial<Tenant>) => {
    dispatch({ type: 'UPDATE_TENANT', payload: updates });
  }, []);
  
  const updateUser = useCallback((updates: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates });
  }, []);
  
  const clearSession = useCallback(() => {
    dispatch({ type: 'CLEAR_SESSION' });
  }, []);
  
  // Permission helpers
  const can = useCallback((resource: ResourceType, action: Action): boolean => {
    if (!state.user) return false;
    return hasPermission(state.user, resource, action);
  }, [state.user]);
  
  const canAccess = useCallback((resource: ResourceType): boolean => {
    if (!state.user) return false;
    return getAllowedActions(state.user, resource).length > 0;
  }, [state.user]);
  
  const getActionsFor = useCallback((resource: ResourceType): Action[] => {
    if (!state.user) return [];
    return getAllowedActions(state.user, resource);
  }, [state.user]);
  
  // Feature helpers
  const hasFeatureEnabled = useCallback((feature: keyof Tenant['settings']['features']): boolean => {
    if (!state.tenant) return false;
    return hasFeature(state.tenant, feature);
  }, [state.tenant]);
  
  // Usage helpers
  const checkResourceLimit = useCallback((
    resourceType: 'users' | 'prospects' | 'sequences' | 'emails' | 'aiCredits',
    count: number = 1
  ) => {
    if (!state.tenant) {
      return { allowed: false, remaining: 0, limit: 0 };
    }
    return canAddResource(state.tenant, resourceType, count);
  }, [state.tenant]);
  
  // Role helpers
  const roleHelpers = useMemo(() => ({
    isOwner: state.user?.role === 'owner',
    isAdmin: state.user?.role === 'admin' || state.user?.role === 'owner',
    isManager: ['owner', 'admin', 'manager'].includes(state.user?.role ?? ''),
    canManageTeam: state.user ? canManageUsers(state.user) : false,
  }), [state.user]);
  
  const value: TenantContextValue = useMemo(() => ({
    ...state,
    setTenant,
    setUser,
    setTeams,
    updateTenant,
    updateUser,
    clearSession,
    can,
    canAccess,
    getActionsFor,
    hasFeatureEnabled,
    checkResourceLimit,
    ...roleHelpers,
  }), [
    state,
    setTenant,
    setUser,
    setTeams,
    updateTenant,
    updateUser,
    clearSession,
    can,
    canAccess,
    getActionsFor,
    hasFeatureEnabled,
    checkResourceLimit,
    roleHelpers,
  ]);
  
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to access tenant context
 */
export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

/**
 * Hook to check permissions
 */
export function usePermission(resource: ResourceType, action: Action): boolean {
  const { can } = useTenant();
  return can(resource, action);
}

/**
 * Hook to check if user can access a resource at all
 */
export function useCanAccess(resource: ResourceType): boolean {
  const { canAccess } = useTenant();
  return canAccess(resource);
}

/**
 * Hook for feature flags
 */
export function useFeature(feature: keyof Tenant['settings']['features']): boolean {
  const { hasFeatureEnabled } = useTenant();
  return hasFeatureEnabled(feature);
}

/**
 * Hook for resource limits
 */
export function useResourceLimit(resourceType: 'users' | 'prospects' | 'sequences' | 'emails' | 'aiCredits') {
  const { checkResourceLimit } = useTenant();
  return checkResourceLimit(resourceType);
}

/**
 * Hook for current user role checks
 */
export function useRole() {
  const { isOwner, isAdmin, isManager, canManageTeam, user } = useTenant();
  return {
    role: user?.role,
    isOwner,
    isAdmin,
    isManager,
    canManageTeam,
  };
}

/**
 * HOC to require a specific permission
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  resource: ResourceType,
  action: Action,
  FallbackComponent?: React.ComponentType
) {
  return function PermissionWrapper(props: P) {
    const hasAccess = usePermission(resource, action);
    
    if (!hasAccess) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }
    
    return <WrappedComponent {...props} />;
  };
}

/**
 * HOC to require a feature flag
 */
export function withFeature<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  feature: keyof Tenant['settings']['features'],
  FallbackComponent?: React.ComponentType
) {
  return function FeatureWrapper(props: P) {
    const isEnabled = useFeature(feature);
    
    if (!isEnabled) {
      return FallbackComponent ? <FallbackComponent /> : null;
    }
    
    return <WrappedComponent {...props} />;
  };
}
