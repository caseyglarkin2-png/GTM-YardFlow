/**
 * T100.2: Error Tracking Service
 * 
 * Centralized error tracking using Sentry for production monitoring.
 * Includes performance monitoring, user context, and custom event tracking.
 */

import * as Sentry from '@sentry/react';
import { featureFlags } from '../config/featureFlags';

// =============================================================================
// Configuration
// =============================================================================

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_ENV || 'development';
const RELEASE = import.meta.env.VITE_APP_VERSION || '1.0.0';

// =============================================================================
// Initialization
// =============================================================================

export function initErrorTracking(): void {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `yardflow-gtm@${RELEASE}`,
    
    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    
    // Sample rates
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Filter out noisy errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      
      // Browser extensions
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      
      // User-triggered
      'ResizeObserver loop',
      'AbortError',
      
      // Firebase (will be removed after migration)
      'Firebase: Error',
    ],
    
    // Filter transactions
    beforeSend(event) {
      // Don't send in development
      if (ENVIRONMENT === 'development') {
        console.log('[Sentry] Would send:', event);
        return null;
      }
      
      return event;
    },
    
    // Custom tags
    initialScope: {
      tags: {
        railwayEnabled: String(featureFlags.RAILWAY_ENABLED),
        railwayAuth: String(featureFlags.RAILWAY_AUTH_ENABLED),
      },
    },
  });

  console.log(`[Sentry] Initialized for ${ENVIRONMENT}`);
}

// =============================================================================
// User Context
// =============================================================================

export interface UserContext {
  id: string;
  email?: string;
  name?: string;
  tenant?: string;
}

export function setUserContext(user: UserContext | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
    
    if (user.tenant) {
      Sentry.setTag('tenant', user.tenant);
    }
  } else {
    Sentry.setUser(null);
  }
}

// =============================================================================
// Error Tracking
// =============================================================================

export function captureError(
  error: Error,
  context?: Record<string, unknown>
): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

// =============================================================================
// Custom Events
// =============================================================================

export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>
): void {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: name,
    level: 'info',
    data,
  });
}

// Track Railway API calls
export function trackRailwayCall(
  endpoint: string,
  success: boolean,
  latencyMs: number
): void {
  Sentry.addBreadcrumb({
    category: 'railway-api',
    message: `${success ? '✓' : '✗'} ${endpoint}`,
    level: success ? 'info' : 'warning',
    data: {
      endpoint,
      success,
      latencyMs,
    },
  });
}

// Track auth events
export function trackAuthEvent(
  event: 'login' | 'logout' | 'refresh' | 'error',
  source: 'railway' | 'firebase',
  success: boolean
): void {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: `${event} via ${source}`,
    level: success ? 'info' : 'warning',
    data: { event, source, success },
  });
  
  if (!success && event === 'login') {
    captureMessage('Login failed', 'warning', { source });
  }
}

// =============================================================================
// Performance Monitoring
// =============================================================================

export function startTransaction(
  name: string,
  op: string = 'custom'
): ReturnType<typeof Sentry.startInactiveSpan> {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

// =============================================================================
// Error Boundary Integration
// =============================================================================

export const SentryErrorBoundary = Sentry.ErrorBoundary;

export function withProfiler<P extends object>(
  Component: React.ComponentType<P>,
  name?: string
): React.ComponentType<P> {
  return Sentry.withProfiler(Component, { name });
}

// =============================================================================
// Exports
// =============================================================================

export { Sentry };

export default {
  init: initErrorTracking,
  setUser: setUserContext,
  captureError,
  captureMessage,
  trackEvent,
  trackRailwayCall,
  trackAuthEvent,
  startTransaction,
  ErrorBoundary: SentryErrorBoundary,
  withProfiler,
};
